import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendDirectPaymentLink } from "@/lib/sms";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_phone, total, restaurant_id, payment_status")
      .eq("id", params.id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status === "paid" || order.payment_status === "cash_collected") {
      return NextResponse.json({ error: "Order already paid" }, { status: 400 });
    }

    if (!order.customer_phone) {
      return NextResponse.json({ error: "No phone number on this order" }, { status: 400 });
    }

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("name")
      .eq("id", order.restaurant_id)
      .single();

    await sendDirectPaymentLink({
      to: order.customer_phone,
      restaurantName: restaurant?.name ?? "Restaurant",
      orderNumber: order.order_number,
      orderId: order.id,
      total: Number(order.total),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Resend SMS] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
