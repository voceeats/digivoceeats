import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ found: false, message: "No phone provided" });
    }

    // Clean phone number - remove all non-digits
    const cleaned = phone.replace(/\D/g, "");
    const formats = [
      phone,
      `+1${cleaned.slice(-10)}`,
      cleaned.slice(-10),
      `+${cleaned}`,
    ];

    // Search all possible formats
    let customer = null;
    for (const format of formats) {
      const { data } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("phone", format)
        .single();
      if (data) { customer = data; break; }
    }

    if (!customer) {
      return NextResponse.json({
        found: false,
        message: "New customer",
        phone: `+1${cleaned.slice(-10)}`,
      });
    }

    return NextResponse.json({
      found: true,
      customer_id: customer.id,
      first_name: customer.name?.split(" ")[0] || null,
      full_name: customer.name,
      phone: customer.phone,
      total_orders: customer.total_orders || 0,
      is_returning: (customer.total_orders || 0) > 0,
      message: customer.name
        ? `Returning customer: ${customer.name}`
        : "Known number, no name yet",
    });

  } catch (error: any) {
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
