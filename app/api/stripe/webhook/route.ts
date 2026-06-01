import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendIVRPaymentConfirmation, sendOrderConfirmation, sendSmsWithFallback } from "@/lib/sms";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Verification failed";
    console.error("Stripe webhook verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("💳 Stripe event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "account.updated":
        await handleConnectAccountUpdate(event.data.object as Stripe.Account);
        break;
      case "transfer.created":
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;
      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Webhook handler error";
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

async function bumpCustomerStats(phoneRaw: string | null | undefined, amount: number) {
  if (!phoneRaw?.trim()) return;
  const cleaned = phoneRaw.replace(/\D/g, "");
  const formatted = `+1${cleaned.slice(-10)}`;

  const { data: cust } = await supabaseAdmin
    .from("customers")
    .select("id, total_orders, total_spent")
    .eq("phone", formatted)
    .maybeSingle();

  if (!cust) return;

  const prevSpent = Number(cust.total_spent ?? 0);
  const add = Number(amount) || 0;

  await supabaseAdmin
    .from("customers")
    .update({
      total_orders: (cust.total_orders ?? 0) + 1,
      total_spent: prevSpent + add,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cust.id);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (existing?.payment_status === "paid") {
    console.log(`Checkout session complete skipped — order ${orderId} already paid`);
    return;
  }

  const piId = paymentIntentIdFromSession(session);

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "accepted",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: piId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*, restaurants(*)")
    .eq("id", orderId)
    .single();

  if (!order) return;

  const restaurant = order.restaurants as { name?: string } | null;
  const restaurantName = restaurant?.name || "the restaurant";
  const phone =
    (session.metadata?.customer_phone && String(session.metadata.customer_phone).trim()) ||
    order.customer_phone ||
    "";

  const totalNum =
    typeof order.total === "string" ? parseFloat(order.total) : Number(order.total);

  console.log(`✅ Order ${order.order_number} marked paid (checkout.session.completed)`);

  if (phone) {
    const confirmationBody = `✅ Payment confirmed for your order at ${restaurantName}!

Order: ${order.order_number}
Total paid: $${totalNum.toFixed(2)}

Your food will be ready in approximately 25 minutes. Thank you for using DigiVoceEats!

Reply STOP to opt out.`;

    await sendSmsWithFallback(phone, confirmationBody);
  }

  await bumpCustomerStats(phone || order.customer_phone, totalNum);

  await supabaseAdmin.from("notifications").insert({
    restaurant_id: order.restaurant_id,
    type: "payment_received",
    title: "Payment Received!",
    message: `$${totalNum.toFixed(2)} received for order ${order.order_number}`,
    order_id: orderId,
  });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*, restaurants(*)")
    .eq("id", orderId)
    .single();

  if (!order) return;
  if (order.payment_status === "paid") return;

  const restaurant = order.restaurants as {
    name?: string;
    stripe_account_id?: string | null;
  } | null;

  // Connect Checkout / destination charges: Stripe routes funds; do not create a second Transfer.
  if (paymentIntent.transfer_data?.destination) {
    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        status: "accepted",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (order.customer_phone) {
      if (order.payment_method === "ivr" && paymentIntent.latest_charge) {
        const chargeData = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
        await sendIVRPaymentConfirmation({
          to: order.customer_phone,
          restaurantName: restaurant?.name || "Restaurant",
          orderNumber: order.order_number,
          total: typeof order.total === "string" ? parseFloat(order.total) : Number(order.total),
          last4: chargeData.payment_method_details?.card?.last4 || "****",
        });
      } else {
        await sendOrderConfirmation({
          to: order.customer_phone,
          restaurantName: restaurant?.name || "Restaurant",
          orderNumber: order.order_number,
          items: Array.isArray(order.items)
            ? order.items.map((i: { name?: string; qty?: number }) => ({
                name: String(i?.name ?? ""),
                qty: Number(i?.qty) || 1,
              }))
            : [],
          total: typeof order.total === "string" ? parseFloat(order.total) : Number(order.total),
        });
      }
    }

    await supabaseAdmin.from("notifications").insert({
      restaurant_id: order.restaurant_id,
      type: "payment_received",
      title: "Payment Received!",
      message: `$${Number(order.total).toFixed(2)} received for order ${order.order_number}`,
      order_id: orderId,
    });

    console.log("✅ Payment processed (destination charge):", order.order_number);
    return;
  }

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "accepted",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (restaurant?.stripe_account_id) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(order.restaurant_payout) * 100),
        currency: "usd",
        destination: restaurant.stripe_account_id,
        source_transaction: paymentIntent.latest_charge as string | undefined,
        metadata: {
          order_id: orderId,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
        },
      });

      await supabaseAdmin.from("orders").update({ stripe_transfer_id: transfer.id }).eq("id", orderId);

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
      const chargeData = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
      await sendIVRPaymentConfirmation({
        to: order.customer_phone,
        restaurantName: restaurant?.name || "Restaurant",
        orderNumber: order.order_number,
        total: typeof order.total === "string" ? parseFloat(order.total) : Number(order.total),
        last4: chargeData.payment_method_details?.card?.last4 || "****",
      });
    } else {
      await sendOrderConfirmation({
        to: order.customer_phone,
        restaurantName: restaurant?.name || "Restaurant",
        orderNumber: order.order_number,
        items: Array.isArray(order.items)
          ? order.items.map((i: { name?: string; qty?: number }) => ({
              name: String(i?.name ?? ""),
              qty: Number(i?.qty) || 1,
            }))
          : [],
        total: typeof order.total === "string" ? parseFloat(order.total) : Number(order.total),
      });
    }
  }

  await supabaseAdmin.from("notifications").insert({
    restaurant_id: order.restaurant_id,
    type: "payment_received",
    title: "Payment Received!",
    message: `$${Number(order.total).toFixed(2)} received for order ${order.order_number}`,
    order_id: orderId,
  });

  console.log("✅ Payment processed for order:", order.order_number);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  await supabaseAdmin
    .from("orders")
    .update({ payment_status: "failed", status: "cancelled" })
    .eq("id", orderId);

  console.log("❌ Payment failed for order:", orderId);
}

async function handleConnectAccountUpdate(account: Stripe.Account) {
  const isComplete =
    Boolean(account.charges_enabled) &&
    Boolean(account.payouts_enabled) &&
    Boolean(account.details_submitted);

  await supabaseAdmin
    .from("restaurants")
    .update({ stripe_onboarding_complete: isComplete })
    .eq("stripe_account_id", account.id);

  console.log(`Stripe account ${account.id} updated — complete: ${isComplete}`);
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const orderId = transfer.metadata?.order_id;
  if (!orderId) return;

  await supabaseAdmin.from("payouts").update({ status: "in_transit" }).eq("stripe_transfer_id", transfer.id);
}
