import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendDirectPaymentLink } from "@/lib/sms";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+1${digits}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const customPhone = body.phone ? normalizePhone(String(body.phone)) : null;

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

    const phoneToUse = customPhone || order.customer_phone;

    if (!phoneToUse) {
      return NextResponse.json({ error: "No phone number provided" }, { status: 400 });
    }

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("name")
      .eq("id", order.restaurant_id)
      .single();

    const sent = await sendDirectPaymentLink({
      to: phoneToUse,
      restaurantName: restaurant?.name ?? "Restaurant",
      orderNumber: order.order_number,
      orderId: order.id,
      total: Number(order.total),
    });

    if (!sent) {
      return NextResponse.json({ error: "SMS failed to send" }, { status: 500 });
    }

    // Update phone number in DB if a different one was used
    if (customPhone && customPhone !== order.customer_phone) {
      await supabaseAdmin
        .from("orders")
        .update({ customer_phone: customPhone })
        .eq("id", order.id);
    }

    return NextResponse.json({ success: true, sent_to: phoneToUse });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Resend SMS] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
