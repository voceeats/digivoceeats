import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    const normalized = String(code || "").trim().toUpperCase();

    if (!/^[A-Z0-9]{4}$/.test(normalized)) {
      return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
    }

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*, restaurants(name)")
      .ilike("order_number", `%${normalized}`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const matches = (orders || []).filter(
      (o) => String(o.order_number || "").slice(-4).toUpperCase() === normalized,
    );

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
