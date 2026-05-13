import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendOrderConfirmation, sendIVRPaymentConfirmation } from "@/lib/twilio";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (error: any) {
    console.error("Stripe webhook verification failed:", error.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("💳 Stripe event:", event.type);

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object as any);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as any);
        break;
      case "account.updated":
        await handleConnectAccountUpdate(event.data.object as any);
        break;
      case "transfer.created":
        await handleTransferCreated(event.data.object as any);
        break;
      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSuccess(paymentIntent: any) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*, restaurants(*)")
    .eq("id", orderId)
    .single();

  if (!order) return;

  const restaurant = order.restaurants as any;

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "pending",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq("id", orderId);

  if (restaurant?.stripe_account_id) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(order.restaurant_payout * 100),
        currency: "usd",
        destination: restaurant.stripe_account_id,
        source_transaction: paymentIntent.latest_charge,
        metadata: {
          order_id: orderId,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
        },
      });

      await supabaseAdmin
        .from("orders")
        .update({ stripe_transfer_id: transfer.id })
        .eq("id", orderId);

      await supabaseAdmin.from("payouts").insert({
        restaurant_id: order.restaurant_id,
        order_id: orderId,
        stripe_transfer_id: transfer.id,
        amount: order.restaurant_payout,
        status: "pending",
      });
    } catch (error) {
      console.error("Transfer failed:", error);
    }
  }

  if (order.customer_phone) {
    if (order.payment_method === "ivr" && paymentIntent.latest_charge) {
      const chargeData = await stripe.charges.retrieve(paymentIntent.latest_charge);
      await sendIVRPaymentConfirmation({
        to: order.customer_phone,
        restaurantName: restaurant?.name || "Restaurant",
        orderNumber: order.order_number,
        total: order.total,
        last4: chargeData.payment_method_details?.card?.last4 || "****",
      });
    } else {
      await sendOrderConfirmation({
        to: order.customer_phone,
        restaurantName: restaurant?.name || "Restaurant",
        orderNumber: order.order_number,
        items: order.items,
        total: order.total,
      });
    }
  }

  await supabaseAdmin.from("notifications").insert({
    restaurant_id: order.restaurant_id,
    type: "payment_received",
    title: "Payment Received!",
    message: `$${order.total.toFixed(2)} received for order ${order.order_number}`,
    order_id: orderId,
  });

  console.log("✅ Payment processed for order:", order.order_number);
}

async function handlePaymentFailed(paymentIntent: any) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  await supabaseAdmin
    .from("orders")
    .update({ payment_status: "failed", status: "cancelled" })
    .eq("id", orderId);

  console.log("❌ Payment failed for order:", orderId);
}

async function handleConnectAccountUpdate(account: any) {
  const isComplete =
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted;

  await supabaseAdmin
    .from("restaurants")
    .update({ stripe_onboarding_complete: isComplete })
    .eq("stripe_account_id", account.id);

  console.log(`Stripe account ${account.id} updated — complete: ${isComplete}`);
}

async function handleTransferCreated(transfer: any) {
  const orderId = transfer.metadata?.order_id;
  if (!orderId) return;

  await supabaseAdmin
    .from("payouts")
    .update({ status: "in_transit" })
    .eq("stripe_transfer_id", transfer.id);
}
