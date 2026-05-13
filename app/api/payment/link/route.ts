import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSMSPaymentLink } from "@/lib/stripe";
import { sendPaymentLink, formatPhone } from "@/lib/twilio";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { orderId, sendTo } = body;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*, restaurants(*)")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const restaurant = order.restaurants as any;

    if (!restaurant?.stripe_account_id) {
      return NextResponse.json(
        { error: "Restaurant Stripe account not configured" },
        { status: 400 }
      );
    }

    const { paymentLinkId, paymentLinkUrl, expiresAt } = await createSMSPaymentLink({
      orderId: order.id,
      orderNumber: order.order_number,
      restaurantName: restaurant.name,
      restaurantStripeAccountId: restaurant.stripe_account_id,
      items: order.items,
      total: order.total,
      platformFee: order.platform_fee,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "sms_link",
        payment_status: "awaiting_payment",
        stripe_payment_link_id: paymentLinkId,
        stripe_payment_link_url: paymentLinkUrl,
        payment_link_sent_at: new Date().toISOString(),
        payment_link_expires_at: expiresAt,
      })
      .eq("id", orderId);

    const phone = sendTo || order.customer_phone;
    if (phone) {
      await sendPaymentLink({
        to: formatPhone(phone),
        restaurantName: restaurant.name,
        orderNumber: order.order_number,
        total: order.total,
        paymentUrl: paymentLinkUrl,
      });
    }

    return NextResponse.json({
      success: true,
      paymentLinkUrl,
      expiresAt,
      smsSent: !!phone,
    });
  } catch (error: any) {
    console.error("Payment link error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
