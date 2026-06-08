import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { formatPhone } from "@/lib/twilio";
import {
  deriveCallStatus,
  extractCallDurationSeconds,
  linkCallToOrder,
  resolveRestaurantIdFromAgent,
  upsertCallRecord,
} from "@/lib/call-tracking";

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

  summary.split(";").forEach((part, index) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(.+),\s*(\d+),\s*\$?([\d.]+)$/);
    if (match) {
      items.push({
        id: String(index + 1),
        name: match[1].trim(),
        qty: parseInt(match[2], 10),
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
      const qtyMatch = lower.match(new RegExp(`(\\d+)\\s*${key.split(" ")[0]}`));
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      const name = key.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      items.push({ id: String(items.length + 1), name, price, qty });
      addedPrices.add(price);
    }
  }
  return items;
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

async function trackCall(params: {
  callId?: string;
  callData: Record<string, unknown>;
  eventType: string;
  agentId?: string | null;
  restaurantId?: string;
  existingOrder?: { id: string; order_number: string } | null;
}) {
  if (!params.callId) return params.restaurantId || DEMO_RESTAURANT_ID;

  const restaurantId =
    params.restaurantId ||
    (await resolveRestaurantIdFromAgent(params.agentId));

  const callerRaw = params.callData.from_number ?? params.callData.from;
  const callerPhone = callerRaw ? formatPhone(String(callerRaw)) : null;
  const duration = extractCallDurationSeconds(params.callData);
  const orderPlaced = !!params.existingOrder;

  await upsertCallRecord({
    retellCallId: params.callId,
    restaurantId,
    callerPhone,
    callDurationSeconds: duration,
    callStatus: deriveCallStatus({
      orderPlaced,
      disconnectionReason: params.callData.disconnection_reason as string | undefined,
      eventType: params.eventType,
    }),
    orderPlaced,
    orderId: params.existingOrder?.id ?? null,
  });

  return restaurantId;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type || body.event;
    const callData = (body.call || body) as Record<string, unknown>;
    const callId = (callData.call_id || body.call_id) as string | undefined;
    const agentId = (body.agent_id || callData.agent_id) as string | undefined;

    console.log("📞 Retell webhook received:", eventType, "call_id:", callId);

    if (eventType !== "call_ended" && eventType !== "call_analyzed") {
      return NextResponse.json({ received: true, event: eventType });
    }

    const existingOrder = callId ? await findOrderByRetellCallId(callId) : null;
    const restaurantId = await trackCall({
      callId,
      callData,
      eventType,
      agentId,
      existingOrder,
    });

    if (eventType === "call_ended") {
      console.log("📞 call_ended tracked:", callId, "order_placed:", !!existingOrder);
      return NextResponse.json({ received: true, call_tracked: true, order_placed: !!existingOrder });
    }

    if (callId && existingOrder) {
      await linkCallToOrder(callId, existingOrder.id, restaurantId);
      return duplicateOrderResponse(existingOrder, callId);
    }

    const customData = (callData.custom_data ||
      body.custom_data ||
      callData.call_analysis ||
      body.call_analysis ||
      {}) as Record<string, string>;

    const transcript = String(callData.transcript || body.transcript || "");
    const callerPhone = customData.customer_phone
      ? formatPhone(customData.customer_phone)
      : callData.from_number
        ? formatPhone(String(callData.from_number))
        : null;

    const customerName = customData.customer_name || "Voice Customer";
    const paymentMethod = customData.payment_method || "pay_code";
    const notes = customData.special_notes || "";

    let items: Array<{ id: string; name: string; price: number; qty: number }> = [];

    if (customData.order_summary) {
      items = parseOrderSummary(customData.order_summary);
    }
    if (!items.length && transcript) {
      items = parseOrderFromTranscript(transcript);
    }

    let subtotal = 0;
    if (customData.order_total && parseFloat(customData.order_total) > 0) {
      subtotal = parseFloat((parseFloat(customData.order_total) / 1.06).toFixed(2));
    } else {
      subtotal = parseFloat(items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2));
    }

    const tax = parseFloat((subtotal * 0.06).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));
    const platformFee = parseFloat((subtotal - subtotal / 1.15).toFixed(2));
    const restaurantPayout = parseFloat((subtotal / 1.15).toFixed(2));

    const orderData = {
      restaurant_id: restaurantId,
      customer_name: customerName,
      customer_phone: callerPhone,
      items: items.length > 0 ? items : [{ id: "1", name: "Voice Order", qty: 1, price: subtotal }],
      notes: notes || "",
      subtotal,
      tax,
      tip: 0,
      platform_fee: platformFee,
      restaurant_payout: restaurantPayout,
      total,
      payment_method: paymentMethod,
      payment_status: paymentMethod === "cash" ? "pending" : "unpaid",
      status: paymentMethod === "cash" ? "pending" : "pending_payment",
      source: "voice_ai",
      retell_call_id: callId,
    };

    if (callId) {
      const existing = await findOrderByRetellCallId(callId);
      if (existing) {
        await linkCallToOrder(callId, existing.id, restaurantId);
        return duplicateOrderResponse(existing, callId);
      }
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && callId) {
        const existing = await findOrderByRetellCallId(callId);
        if (existing) {
          await linkCallToOrder(callId, existing.id, restaurantId);
          return duplicateOrderResponse(existing, callId);
        }
      }
      console.error("❌ Order save error:", error);
      return NextResponse.json({ received: true, error: error.message });
    }

    if (callId && order?.id) {
      await linkCallToOrder(callId, order.id, restaurantId);
    }

    console.log("✅ Order saved:", order?.order_number);

    return NextResponse.json({
      received: true,
      order_id: order?.id,
      order_number: order?.order_number,
      items_found: items.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Webhook error";
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ received: true, error: msg });
  }
}

export async function GET() {
  return NextResponse.json({ status: "DigiVoceEats Retell webhook active - Bread & Kabob" });
}
