import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function phoneFormats(rawPhone: string): string[] {
  const digits = rawPhone.replace(/\D/g, "");
  const tenDigits = digits.slice(-10);
  const e164 = tenDigits.length === 10 ? `+1${tenDigits}` : rawPhone.trim();
  return Array.from(
    new Set(
      [e164, `1${tenDigits}`, tenDigits, `+${digits}`, rawPhone.trim()].filter(Boolean),
    ),
  );
}

function formatItemsSummary(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((i: { name?: string; qty?: unknown }) => {
      const name = String(i?.name ?? "Item");
      const qty = Math.max(1, Math.round(toNum(i?.qty)) || 1);
      return qty > 1 ? `${qty}x ${name}` : name;
    })
    .join(", ");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get("phone");
    console.log("📞 lookup-by-phone received phone:", JSON.stringify(rawPhone));

    if (!rawPhone?.trim()) {
      return NextResponse.json({ found: false, message: "No phone provided" });
    }

    const formats = phoneFormats(rawPhone);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    console.log("🔎 lookup-by-phone trying formats:", formats, "since:", twoHoursAgo);

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("order_number, payment_code, total, items, customer_phone, created_at")
      .in("customer_phone", formats)
      .eq("payment_status", "unpaid")
      .eq("status", "pending_payment")
      .gte("created_at", twoHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("lookup-by-phone query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const order = orders?.[0];
    if (!order) {
      console.log("lookup-by-phone: no unpaid order found for", formats);
      return NextResponse.json({ found: false, message: "No pending unpaid order found" });
    }

    const response = {
      found: true,
      order_number: order.order_number,
      payment_code: order.payment_code ?? null,
      total: toNum(order.total),
      items_summary: formatItemsSummary(order.items),
    };
    console.log("✅ lookup-by-phone found order:", JSON.stringify(response));
    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    console.error("❌ lookup-by-phone error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
