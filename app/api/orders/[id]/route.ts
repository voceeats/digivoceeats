import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, createServerSupabase } from "@/lib/supabase";
import { createQRPaymentLink, chargeManualCard, createTapToPayIntent } from "@/lib/stripe";
import { sendOrderConfirmation, sendOrderRejected } from "@/lib/twilio";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, payload } = body;
    const orderId = params.id;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*, restaurants(*)")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const restaurant = order.restaurants as any;
    if (restaurant?.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    switch (action) {
      case "accept":
        return handleAccept(order, restaurant);
      case "reject":
        return handleReject(order, restaurant, payload?.reason);
      case "complete":
        return handleComplete(order);
      case "mark_cash":
        return handleCashPayment(order);
      case "in_person_tap":
        return handleTapToPay(order, restaurant);
      case "in_person_manual":
        return handleManualCard(order, restaurant, payload?.paymentMethodId);
      case "in_person_qr":
        return handleQRPayment(order, restaurant);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleAccept(order: any, restaurant: any) {
  await supabaseAdmin
    .from("orders")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", order.id);

  if (order.payment_status === "pending" && order.customer_phone) {
    await sendOrderConfirmation({
      to: order.customer_phone,
      restaurantName: restaurant.name,
      orderNumber: order.order_number,
      items: order.items,
      total: order.total,
    });
  }

  return NextResponse.json({ success: true, status: "accepted" });
}

async function handleReject(order: any, restaurant: any, reason?: string) {
  await supabaseAdmin
    .from("orders")
    .update({ status: "rejected" })
    .eq("id", order.id);

  if (order.customer_phone) {
    await sendOrderRejected({
      to: order.customer_phone,
      restaurantName: restaurant.name,
      orderNumber: order.order_number,
      reason,
    });
  }

  return NextResponse.json({ success: true, status: "rejected" });
}

async function handleComplete(order: any) {
  await supabaseAdmin
    .from("orders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", order.id);

  return NextResponse.json({ success: true, status: "completed" });
}

async function handleCashPayment(order: any) {
  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "cash_collected",
      payment_method: "cash",
      paid_at: new Date().toISOString(),
      status: "accepted",
    })
    .eq("id", order.id);

  return NextResponse.json({ success: true, payment: "cash_collected" });
}

async function handleTapToPay(order: any, restaurant: any) {
  if (!restaurant?.stripe_account_id) {
    return NextResponse.json({ error: "Stripe account not configured" }, { status: 400 });
  }

  const paymentIntent = await createTapToPayIntent({
    amount: order.total,
    restaurantStripeAccountId: restaurant.stripe_account_id,
    platformFee: order.platform_fee,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      restaurant_id: order.restaurant_id,
    },
  });

  await supabaseAdmin
    .from("orders")
    .update({
      payment_method: "in_person_tap",
      payment_status: "awaiting_payment",
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq("id", order.id);

  return NextResponse.json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
}

async function handleManualCard(order: any, restaurant: any, paymentMethodId: string) {
  if (!paymentMethodId) {
    return NextResponse.json({ error: "Payment method ID required" }, { status: 400 });
  }

  const paymentIntent = await chargeManualCard({
    paymentMethodId,
    amount: order.total,
    restaurantStripeAccountId: restaurant.stripe_account_id,
    platformFee: order.platform_fee,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      restaurant_id: order.restaurant_id,
    },
  });

  if (paymentIntent.status === "succeeded") {
    await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "in_person_manual",
        payment_status: "paid",
        stripe_payment_intent_id: paymentIntent.id,
        paid_at: new Date().toISOString(),
        status: "accepted",
      })
      .eq("id", order.id);
  }

  return NextResponse.json({
    success: paymentIntent.status === "succeeded",
    status: paymentIntent.status,
  });
}

async function handleQRPayment(order: any, restaurant: any) {
  const { url, qrUrl } = await createQRPaymentLink({
    orderId: order.id,
    amount: order.total,
    restaurantStripeAccountId: restaurant.stripe_account_id,
    platformFee: order.platform_fee,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      restaurant_id: order.restaurant_id,
    },
  });

  await supabaseAdmin
    .from("orders")
    .update({
      payment_method: "in_person_qr",
      payment_status: "awaiting_payment",
      stripe_payment_link_url: qrUrl,
    })
    .eq("id", order.id);

  return NextResponse.json({ success: true, qrUrl });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
