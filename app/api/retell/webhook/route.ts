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
  "beef kabob salad": 15.76,
  "salmon kabob salad": 15.76,
  "kubideh kabob sandwich": 11.44,
  "kubideh sandwich": 11.44,
  "chicken sandwich": 13.74,
  "vegetarian sandwich": 11.44,
  "salmon kabob sandwich": 15.24,
  "salmon sandwich": 15.24,
  "lamb kabob sandwich": 14.66,
  "beef kabob sandwich": 13.51,
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
  "salmon kabob platter": 17.77,
  "salmon platter": 17.77,
  "salmon sultani kabob platter": 18.92,
  "salmon sultani": 18.92,
  "chicken lamb combo kabob platter": 20.41,
  "combo platter": 20.41,
};

function parseOrderSummary(summary: string): Array<{ id: string; name: string; price: number; qty: number }> {
  const items: Array<{ id: string; name: string; price: number; qty: number }> = [];
  if (!summary) return items;

  // Parse format: "Item Name, qty, $price; Item Name, qty, $price"
  const parts = summary.split(";");
  parts.forEach((part, index) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    // Match: "Kubideh Kabob Platter, 1, $14.89"
    const match = trimmed.match(/^(.+),\s*(\d+),\s*\$?([\d.]+)$/);
    if (match) {
      items.push({
        id: String(index + 1),
        name: match[1].trim(),
        qty: parseInt(match[2]),
        price: parseFloat(match[3]),
      });
    }
  });

  return items;
}

function parseOrderFromTranscript(transcript: string): Array<{ id: string; name: string; price: number; qty: number }> {
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

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11) return `+${digits}`;
  return `+${digits}`;
}

async function sendPaymentSMS(
  to: string,
  restaurantName: string,
  orderNumber: string,
  total: number,
  orderId: string
) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      console.error("❌ Twilio credentials missing in environment");
      return false;
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${orderId}`;

    const message = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formatPhone(to),
      body: `🍽️ ${restaurantName}

Your order ${orderNumber} is confirmed!
Total: $${total.toFixed(2)}

Pay securely here:
${paymentUrl}

⏱️ Link expires in 30 minutes
✅ Accepts Apple Pay & Google Pay

Reply STOP to opt out.`,
    });

    console.log(`✅ SMS sent to ${to} - SID: ${message.sid}`);
    return true;
  } catch (error: any) {
    console.error("❌ SMS send error:", error.message);
    return false;
  }
}

async function findOrderByRetellCallId(callId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number")
    .eq("retell_call_id", callId)
    .maybeSingle();
  return data;
}

function duplicateOrderResponse(existing: { id: string; order_number: string }, callId?: string) {
  console.log("⏭️ Order already exists for call:", callId ?? existing.id);
  return NextResponse.json({
    received: true,
    duplicate: true,
    order_id: existing.id,
    order_number: existing.order_number,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type || body.event;
    console.log("📞 Retell webhook received:", eventType);
    console.log("📦 Full body:", JSON.stringify(body).slice(0, 1000));

    if (eventType !== "call_ended" && eventType !== "call_analyzed") {
      return NextResponse.json({ received: true, event: eventType });
    }

    const callData = body.call || body;
    const callId = callData.call_id || body.call_id;

    // Idempotency: Retell fires both call_ended and call_analyzed for the same call.
    // Only create orders on call_analyzed (has extracted order data).
    if (callId) {
      const existing = await findOrderByRetellCallId(callId);
      if (existing) {
        return duplicateOrderResponse(existing, callId);
      }
    }

    if (eventType === "call_ended") {
      console.log("⏭️ call_ended received — waiting for call_analyzed:", callId);
      return NextResponse.json({ received: true, skipped: "awaiting call_analyzed" });
    }

    // Get custom data — this is where Retell puts extracted info
    const customData = callData.custom_data ||
                       body.custom_data ||
                       callData.call_analysis ||
                       body.call_analysis ||
                       {};

    console.log("📋 Custom data:", JSON.stringify(customData));

    const transcript = callData.transcript || body.transcript || "";
    const callerPhone = callData.from_number || body.from_number || null;

    // Extract customer info from custom data first, then transcript
    const customerPhone = customData.customer_phone
      ? formatPhone(customData.customer_phone)
      : callerPhone
      ? formatPhone(callerPhone)
      : null;

    const customerName = customData.customer_name || "Voice Customer";
    const paymentMethod = customData.payment_method || "sms_link";
    const notes = customData.special_notes || "";

    // Parse items — try order_summary first (from Retell extraction)
    // then fall back to transcript parsing
    let items: Array<{ id: string; name: string; price: number; qty: number }> = [];

    if (customData.order_summary) {
      console.log("📝 Parsing from order_summary:", customData.order_summary);
      items = parseOrderSummary(customData.order_summary);
    }

    if (!items.length && transcript) {
      console.log("📝 Falling back to transcript parsing");
      items = parseOrderFromTranscript(transcript);
    }

    console.log("🛒 Items found:", JSON.stringify(items));

    // Calculate totals
    let subtotal = 0;
    if (customData.order_total && parseFloat(customData.order_total) > 0) {
      // Use Retell's calculated total (includes tax already)
      const totalWithTax = parseFloat(customData.order_total);
      // Back-calculate subtotal from total (total = subtotal * 1.06)
      subtotal = parseFloat((totalWithTax / 1.06).toFixed(2));
    } else {
      subtotal = parseFloat(
        items.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2)
      );
    }

    const tax = parseFloat((subtotal * 0.06).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));
    // Platform fee is the 15% already built into voiceeats_price
    const platformFee = parseFloat((subtotal - (subtotal / 1.15)).toFixed(2));
    const restaurantPayout = parseFloat((subtotal / 1.15).toFixed(2));

    // Find restaurant by agent ID
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

    // Save order
    const orderData = {
      restaurant_id: restaurantId,
      customer_name: customerName,
      customer_phone: customerPhone,
      items: items.length > 0
        ? items
        : [{ id: "1", name: "Voice Order", qty: 1, price: subtotal }],
      notes: notes || "",
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
      retell_call_id: callId,
    };

    console.log("💾 Saving order:", JSON.stringify(orderData, null, 2));

    // Re-check immediately before insert (guards against race between webhooks)
    if (callId) {
      const existing = await findOrderByRetellCallId(callId);
      if (existing) {
        return duplicateOrderResponse(existing, callId);
      }
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (error) {
      // Unique index on retell_call_id — treat as duplicate, not failure
      if (error.code === "23505" && callId) {
        const existing = await findOrderByRetellCallId(callId);
        if (existing) {
          return duplicateOrderResponse(existing, callId);
        }
      }
      console.error("❌ Order save error:", error);
      return NextResponse.json({ received: true, error: error.message });
    }

    console.log("✅ Order saved:", order?.order_number);

    // Send SMS payment link
    if (paymentMethod === "sms_link" && customerPhone) {
      console.log(`📱 Sending SMS to ${customerPhone}`);
      const smsSent = await sendPaymentSMS(
        customerPhone,
        restaurantName,
        order.order_number,
        total,
        order.id
      );
      if (smsSent) {
        await supabaseAdmin
          .from("orders")
          .update({ payment_link_sent_at: new Date().toISOString() })
          .eq("id", order.id);
      }
    }

    return NextResponse.json({
      received: true,
      order_id: order?.id,
      order_number: order?.order_number,
      items_found: items.length,
      sms_sent: paymentMethod === "sms_link",
    });

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ received: true, error: error.message });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "DigiVoceEats Retell webhook active - Bread & Kabob" });
}
// This gets added to the webhook after order is saved
