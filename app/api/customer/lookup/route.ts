import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get("phone");
    console.log("📞 lookup_customer received phone:", JSON.stringify(rawPhone));

    if (!rawPhone || !rawPhone.trim()) {
      console.log("⚠️ lookup_customer: no phone provided");
      return NextResponse.json({ found: false, message: "No phone provided" });
    }

    // Normalize: strip to digits, take the last 10, build E.164 (+1XXXXXXXXXX).
    // Retell ({{user_number}}) may send +12223334444, 12223334444, or 2223334444.
    const digits = rawPhone.replace(/\D/g, "");
    const tenDigits = digits.slice(-10);
    const e164 = tenDigits.length === 10 ? `+1${tenDigits}` : rawPhone.trim();

    // Try every format the DB might have stored, de-duplicated.
    const formats = Array.from(
      new Set(
        [
          e164, // +12223334444
          `1${tenDigits}`, // 12223334444
          tenDigits, // 2223334444
          `+${digits}`, // +<all digits as received>
          rawPhone.trim(), // exactly as received
        ].filter(Boolean),
      ),
    );
    console.log("🔎 lookup_customer trying formats:", formats);

    let customer = null;
    let matchedFormat: string | null = null;
    for (const format of formats) {
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("phone", format)
        .maybeSingle();
      if (error) {
        console.error(`lookup_customer query error for "${format}":`, error.message);
        continue;
      }
      if (data) {
        customer = data;
        matchedFormat = format;
        break;
      }
    }

    if (!customer) {
      console.log(`🆕 lookup_customer: no match — new customer, returning ${e164}`);
      return NextResponse.json({
        found: false,
        message: "New customer",
        phone: e164,
      });
    }

    // Always return E.164 so the AI reads a consistent, correct number.
    const response = {
      found: true,
      customer_id: customer.id,
      first_name: customer.name?.split(" ")[0] || null,
      full_name: customer.name,
      phone: e164,
      total_orders: customer.total_orders || 0,
      is_returning: (customer.total_orders || 0) > 0,
      message: customer.name
        ? `Returning customer: ${customer.name}`
        : "Known number, no name yet",
    };
    console.log(
      `✅ lookup_customer: matched on "${matchedFormat}", returning`,
      JSON.stringify(response),
    );
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("❌ lookup_customer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone, name } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }

    const cleaned = phone.replace(/\D/g, "");
    const formattedPhone = `+1${cleaned.slice(-10)}`;

    // Check if exists
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("phone", formattedPhone)
      .single();

    if (existing) {
      // Update name if provided and not already set
      if (name && !existing.name) {
        await supabaseAdmin
          .from("customers")
          .update({ name, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return NextResponse.json({
        success: true,
        customer_id: existing.id,
        action: "updated",
        first_name: name?.split(" ")[0] || existing.name?.split(" ")[0],
      });
    }

    // Create new customer
    const { data: newCustomer } = await supabaseAdmin
      .from("customers")
      .insert({
        phone: formattedPhone,
        name: name || null,
        total_orders: 0,
        total_spent: 0,
        noshows: 0,
        preferred_payment: "sms_link",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      customer_id: newCustomer?.id,
      action: "created",
      first_name: name?.split(" ")[0],
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
