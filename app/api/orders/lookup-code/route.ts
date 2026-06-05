import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    const normalized = String(code || "").trim();

    if (!/^\d{4}$/.test(normalized)) {
      return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
    }

    // Primary: match the stored 4-digit numeric payment_code.
    const { data: codeOrders, error } = await supabaseAdmin
      .from("orders")
      .select("*, restaurants(name)")
      .eq("payment_code", normalized)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let matches = codeOrders || [];

    // Legacy fallback: older orders created before payment_code existed
    // were looked up by the last 4 chars of order_number.
    if (matches.length === 0) {
      const { data: legacyOrders } = await supabaseAdmin
        .from("orders")
        .select("*, restaurants(name)")
        .is("payment_code", null)
        .ilike("order_number", `%${normalized}`)
        .order("created_at", { ascending: false })
        .limit(10);
      matches = (legacyOrders || []).filter(
        (o) => String(o.order_number || "").slice(-4) === normalized,
      );
    }

    if (matches.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order =
      matches.find(
        (o) => o.payment_status !== "paid" && o.payment_status !== "cash_collected",
      ) ?? matches[0];

    const restaurant = order.restaurants as { name?: string } | null;
    const itemsRaw = order.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((i: { name?: string; price?: unknown; qty?: unknown }) => ({
          name: String(i?.name ?? "Item"),
          price: toNum(i?.price),
          qty: Math.max(1, Math.round(toNum(i?.qty)) || 1),
        }))
      : [];

    return NextResponse.json({
      id: order.id,
      order_number: order.order_number,
      restaurant_name: restaurant?.name || "Restaurant",
      items,
      subtotal: toNum(order.subtotal),
      tax: toNum(order.tax),
      total: toNum(order.total),
      payment_status: order.payment_status,
      status: order.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
