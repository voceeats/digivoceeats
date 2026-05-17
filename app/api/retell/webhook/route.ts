import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import twilio from "twilio";

const DEMO_RESTAURANT_ID = "339ad678-297a-4d57-9f4b-a502650829d3";

const MENU_ITEMS: Record<string, number> = {
  "fresh baked tandoori bread": 2.30,
  "tandoori bread": 2.30,
  "hummus with warm tandoori bread": 5.75,
  "hummus": 4.31,
  "vegetarian grape leaves": 4.03,
  "grape leaves": 4.03,
  "basmati rice": 3.44,
  "rice": 3.44,
  "home made lentil soup": 3.74,
  "lentil soup": 3.74,
  "shirazi": 4.03,
  "house salad": 6.33,
  "yogurt and garlic": 3.74,
  "yogurt and cucumber": 3.39,
  "torshi": 1.73,
  "ground beef skewer salad": 15.24,
  "chicken kabob salad": 15.24,
  "chicken salad": 15.24,
  "lamb kabob salad": 15.76,
  "lamb salad": 15.76,
  "beef kabob salad": 15.76,
  "beef salad": 15.76,
  "salmon kabob salad": 15.76,
  "salmon salad": 15.76,
  "kubideh kabob sandwich": 11.44,
  "kubideh sandwich": 11.44,
  "chicken sandwich": 13.74,
  "vegetarian sandwich": 11.44,
  "veggie sandwich": 11.44,
  "salmon kabob sandwich": 15.24,
  "salmon sandwich": 15.24,
  "lamb kabob sandwich": 14.66,
  "lamb sandwich": 14.66,
  "beef kabob sandwich": 13.51,
  "beef sandwich": 13.51,
  "bronzini fish": 23.00,
  "bronzini": 23.00,
  "kubideh kabob platter": 14.89,
  "kubideh platter": 14.89,
  "kubideh kabob": 14.89,
  "chicken kabob platter": 14.89,
  "chicken platter": 14.89,
  "chicken sultani kabob platter": 16.62,
  "chicken sultani": 16.62,
  "lamb kabob platter": 17.19,
  "lamb platter": 17.19,
  "lamb sultani kabob platter": 18.40,
  "lamb sultani": 18.40,
  "super lamb sultani kabob platter": 21.85,
  "beef kabob platter": 16.04,
  "beef platter": 16.04,
  "beef sultani kabob platter": 16.68,
  "beef sultani": 16.68,
  "super beef sultani kabob platter": 22.43,
  "steak kabob platter": 17.83,
  "steak platter": 17.83,
  "steak sultani kabob platter": 20.41,
  "steak sultani": 20.41,
  "veggie kabob platter": 13.17,
  "veggie platter": 13.17,
  "vegetarian platter": 13.17,
  "salmon kabob platter": 17.77,
  "salmon platter": 17.77,
  "salmon sultani kabob platter": 18.92,
  "salmon sultani": 18.92,
  "chicken lamb combo kabob platter": 20.41,
  "chicken lamb combo": 20.41,
  "combo platter": 20.41,
};

function parseOrderFromTranscript(transcript: string) {
  const items: Array<{ id: string; name: string; price: number; qty: number }> = [];
  const lower = transcript.toLowerCase();
  const addedPrices = new Set<number>();
  const sorted = Object.entries(MENU_ITEMS).sort((a, b) => b[0].length - a[0].length);

  for (const [key, price] of sorted) {
    if (lower.includes(key) && !addedPrices.has(price)) {
      const qtyMatch = lower.match(new RegExp(`(\\d+)\\s*${key.split(' ')[0]}`));
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
      const name = key.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      items.push({ id: String(items.length + 1), name, price, qty });
      addedPrices.add(price);
    }
  }
  return items;
}

function extractCustomerName(transcript: string, customData: any): string {
  if (customData?.customer_name) return customData.customer_name;
  const match = transcript.match(/(?:my name is|i am|call me|this is)\s+([A-Za-z]+)/i);
  return match ? match[1] : "Voice Customer";
}

function extractCustomerPhone(transcript: string, customData: any, callerPhone: string): string {
  if (customData?.customer_phone) return customData.customer_phone;
  // Try to find phone number mentioned in transcript
  const match = transcript.match(/(\d[\d\s\-().]{7,}\d)/);
  if (match) {
    const digits = match[1].replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11) return `+${digits}`;
  }
  return callerPhone;
}

function extractPaymentMethod(transcript: string, customData: any): string {
  if (customData?.payment_method) return customData.payment_method;
  const lower = transcript.toLowerCase();
  if (lower.includes("send") && lower.includes("link")) return "sms_link";
  if (lower.includes("text") || lower.includes("sms")) return "sms_link";
  if (lower.includes("payment link")) return "sms_link";
  if (lower.includes("card") && lower.includes("phone")) return "ivr";
  if (lower.includes("cash") || lower.includes("arrive") || lower.includes("pick up")) return "cash";
  return "sms_link";
}

async function sendPaymentSMS(to: string, restaurantName: string, orderNumber: string, total: number, orderId: string) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error("❌ Twilio credentials missing");
      return false;
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // For now send a simple payment link
    // When Stripe is set up this will be a real Stripe link
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${orderId}`;

    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
      body: `🍽️ ${restaurantName}

Order ${orderNumber} confirmed!
Total: $${total.toFixed(2)}

Pay securely here:
${paymentUrl}

Link expires in 30 minutes.
Reply STOP to opt out.`,
    });

    console.log(`✅ SMS sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error("❌ SMS error:", error.message);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type || body.event;
    console.log("📞 Retell webhook:", eventType);

    if (eventType !== "call_ended") {
      return NextResponse.json({ received: true, event: eventType });
    }

    const callData = body.call || body;
    const customData = callData.custom_data || body.custom_data || {};
    const transcript = callData.transcript || body.transcript || "";

    console.log("📝 Transcript:", transcript.slice(0, 500));

    const callerPhone = callData.from_number || null;
    const customerPhone = extractCustomerPhone(transcript, customData, callerPhone);
    const customerName = extractCustomerName(transcript, customData);
    const paymentMethod = extractPaymentMethod(transcript, customData);
    const notes = customData.special_notes || "";

    let items = customData.order_items || [];
    if (!items.length) items = parseOrderFromTranscript(transcript);

    const subtotal = parseFloat(
      items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.qty || 1)), 0).toFixed(2)
    );

    // 6% tax for Northern Virginia
    const tax = parseFloat((subtotal * 0.06).toFixed(2));
    const platformFee = parseFloat((subtotal * 0.15).toFixed(2));
    const restaurantPayout = parseFloat((subtotal - platformFee).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    const agentId = body.agent_id || callData.agent_id;
    let restaurantId = DEMO_RESTAURANT_ID;
    let restaurantName = "Bread & Kabob";

    if (agentId) {
      const { data: restaurant } = await supabaseAdmin
        .from("restaurants")
        .select("id, name")
        .eq("retell_agent_id", agentId)
        .single();
      if (restaurant?.id) {
        restaurantId = restaurant.id;
        restaurantName = restaurant.name;
      }
    }

    const orderData = {
      restaurant_id: restaurantId,
      customer_name: customerName,
      customer_phone: customerPhone,
      items: items.length > 0 ? items : [{ id: "1", name: "Voice Order", qty: 1, price: 0 }],
      notes: notes || transcript.slice(0, 500),
      subtotal,
      tax,
      tip: 0,
      platform_fee: platformFee,
      restaurant_payout: restaurantPayout,
      total,
      payment_method: paymentMethod,
      payment_status: paymentMethod === "cash" ? "pending" : "awaiting_payment",
      status: "pending",
      source: "voice_ai",
      retell_call_id: callData.call_id || body.call_id,
    };

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error("❌ Order save error:", error);
      return NextResponse.json({ received: true, error: error.message });
    }

    console.log("✅ Order saved:", order?.order_number);

    // Send SMS payment link if customer chose that option
    if (paymentMethod === "sms_link" && customerPhone) {
      const smsSent = await sendPaymentSMS(
        customerPhone,
        restaurantName,
        order.order_number,
        total,
        order.id
      );
      console.log(`SMS sent: ${smsSent}`);
    }

    return NextResponse.json({
      received: true,
      order_id: order?.id,
      order_number: order?.order_number,
    });

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ received: true, error: error.message });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "VoceEats Retell webhook active - Bread & Kabob" });
}
