import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, stripe_account_id, stripe_onboarding_complete, email")
      .eq("id", order.restaurant_id)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    if (!restaurant.stripe_account_id) {
      return NextResponse.json(
        {
          error: "Restaurant payment not set up yet",
          needs_stripe: true,
        },
        { status: 400 },
      );
    }

    if (!restaurant.stripe_onboarding_complete) {
      return NextResponse.json(
        {
          error: "Restaurant still completing payment setup",
          needs_stripe: true,
        },
        { status: 400 },
      );
    }

    if (order.payment_status === "paid" || order.payment_status === "cash_collected") {
      return NextResponse.json(
        {
          error: "Order already paid",
          already_paid: true,
        },
        { status: 400 },
      );
    }

    const itemsRaw = order.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((i: { name?: string; price?: unknown; qty?: unknown }) => ({
          name: String(i?.name ?? "Item"),
          price: toNum(i?.price),
          qty: Math.max(1, Math.round(toNum(i?.qty)) || 1),
        }))
      : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "Order has no line items" }, { status: 400 });
    }

    const checkoutOrder = {
      id: order.id,
      order_number: order.order_number,
      items,
      subtotal: toNum(order.subtotal),
      tax: toNum(order.tax),
      total: toNum(order.total),
      platform_fee: toNum(order.platform_fee),
      restaurant_payout: toNum(order.restaurant_payout),
      customer_phone: order.customer_phone ?? undefined,
      customer_name: order.customer_name ?? undefined,
    };

    const session = await createCheckoutSession(
      checkoutOrder,
      restaurant.stripe_account_id,
      restaurant.name,
      order.customer_email || undefined,
    );

    await supabaseAdmin
      .from("orders")
      .update({
        stripe_payment_link_url: session.url,
        payment_link_sent_at: new Date().toISOString(),
        payment_link_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .eq("id", orderId);

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Payment session error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
