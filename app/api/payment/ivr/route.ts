import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { chargeIVRCard } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendIVRPaymentConfirmation, formatPhone } from "@/lib/twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const step = url.searchParams.get("step") || "start";
  const orderId = url.searchParams.get("order_id") || "";

  const formData = await request.formData();
  const digits = formData.get("Digits") as string;
  const callerId = formData.get("From") as string;

  const twiml = new VoiceResponse();

  switch (step) {
    case "start":
      return startIVR(twiml, orderId);
    case "card":
      return collectExpiry(twiml, orderId, digits);
    case "expiry":
      return collectCVC(twiml, orderId, digits, url.searchParams.get("card") || "");
    case "cvc":
      return processPayment(
        twiml, orderId,
        url.searchParams.get("card") || "",
        url.searchParams.get("expiry") || "",
        digits, callerId
      );
    default:
      twiml.say({ voice: "Polly.Joanna" }, "An error occurred. Please call back.");
      return twimlResponse(twiml);
  }
}

function twimlResponse(twiml: any) {
  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}

function startIVR(twiml: any, orderId: string) {
  const gather = twiml.gather({
    input: "dtmf",
    timeout: 15,
    numDigits: 16,
    action: `/api/payment/ivr?step=card&order_id=${orderId}`,
    method: "POST",
  });
  gather.say(
    { voice: "Polly.Joanna", language: "en-US" },
    "Welcome to VoceEats secure payment. " +
    "Please enter your 16 digit card number now."
  );
  twiml.say({ voice: "Polly.Joanna" }, "We did not receive your card number. Please call back.");
  return twimlResponse(twiml);
}

function collectExpiry(twiml: any, orderId: string, cardNumber: string) {
  const gather = twiml.gather({
    input: "dtmf",
    timeout: 10,
    numDigits: 6,
    action: `/api/payment/ivr?step=expiry&order_id=${orderId}&card=${encodeURIComponent(cardNumber)}`,
    method: "POST",
  });
  gather.say(
    { voice: "Polly.Joanna" },
    "Thank you. Now please enter your card expiry date. " +
    "Enter 2 digits for the month, then 4 digits for the year. " +
    "For example, January 2028 would be 0 1 2 0 2 8."
  );
  twiml.redirect(`/api/payment/ivr?step=start&order_id=${orderId}`);
  return twimlResponse(twiml);
}

function collectCVC(twiml: any, orderId: string, expiryDigits: string, cardNumber: string) {
  const gather = twiml.gather({
    input: "dtmf",
    timeout: 10,
    numDigits: 4,
    action: `/api/payment/ivr?step=cvc&order_id=${orderId}&card=${encodeURIComponent(cardNumber)}&expiry=${encodeURIComponent(expiryDigits)}`,
    method: "POST",
  });
  gather.say(
    { voice: "Polly.Joanna" },
    "Now please enter your 3 or 4 digit security code from the back of your card."
  );
  return twimlResponse(twiml);
}

async function processPayment(
  twiml: any, orderId: string, cardNumber: string,
  expiryDigits: string, cvc: string, callerPhone: string
) {
  try {
    const expMonth = parseInt(expiryDigits.substring(0, 2));
    const expYear = parseInt(expiryDigits.substring(2));

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*, restaurants(*)")
      .eq("id", orderId)
      .single();

    if (!order) {
      twiml.say({ voice: "Polly.Joanna" }, "Order not found. Please call us directly.");
      twiml.hangup();
      return twimlResponse(twiml);
    }

    const restaurant = order.restaurants as any;

    const paymentIntent = await chargeIVRCard({
      cardNumber: cardNumber.replace(/\s/g, ""),
      expMonth,
      expYear,
      cvc,
      amount: order.total,
      restaurantStripeAccountId: restaurant.stripe_account_id,
      platformFee: order.platform_fee,
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        restaurant_id: order.restaurant_id,
      },
    });

    if (paymentIntent.status === "succeeded") {
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: "ivr",
          stripe_payment_intent_id: paymentIntent.id,
          paid_at: new Date().toISOString(),
          status: "pending",
        })
        .eq("id", orderId);

      if (callerPhone) {
        await sendIVRPaymentConfirmation({
          to: formatPhone(callerPhone),
          restaurantName: restaurant.name,
          orderNumber: order.order_number,
          total: order.total,
          last4: cardNumber.slice(-4),
        });
      }

      twiml.say(
        { voice: "Polly.Joanna" },
        `Payment of $${order.total.toFixed(2)} accepted successfully. ` +
        `Your order number is ${order.order_number.split("").join(" ")}. ` +
        `You will receive a confirmation text shortly. ` +
        `Thank you for ordering from ${restaurant.name}!`
      );
    } else {
      twiml.say(
        { voice: "Polly.Joanna" },
        "Your payment could not be processed. " +
        "Please check your card details and try again, " +
        "or choose a different payment method."
      );
    }
  } catch (error: any) {
    console.error("IVR payment error:", error);
    twiml.say(
      { voice: "Polly.Joanna" },
      "We encountered an error processing your payment. " +
      "Please try our text payment link or pay in person."
    );
  }

  twiml.hangup();
  return twimlResponse(twiml);
}
