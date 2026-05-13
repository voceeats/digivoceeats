import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type || body.event;
    console.log("📞 Retell webhook:", eventType);

    if (eventType !== "call_ended" && eventType !== "call_analyzed") {
      return NextResponse.json({ received: true, event: eventType });
    }

    // Extract order data from call
    const callData = body.call || body;
    const transcript = callData.transcript || "";
    const customData = callData.custom_data || body.custom_data || {};

    console.log("Call data:", JSON.stringify(callData, null, 2));

    // Try to get order details from custom data or transcript
    const customerName = customData.customer_name || callData.from_number || "Voice Customer";
    const customerPhone = customData.customer_phone || callData.from_number || null;
    const items = customData.order_items || [];
    const paymentMethod = customData.payment_method || "in_person";
    const notes = customData.special_notes || "";

    // Calculate totals
    const subtotal = items.length > 0
      ? items.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0)
      : 0;

    const tax = parseFloat((subtotal * 0.0875).toFixed(2));
    const platformFee = parseFloat((subtotal * 0.15).toFixed(2));
    const restaurantPayout = parseFloat((subtotal - platformFee).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    // Find restaurant by agent ID
    const agentId = body.agent_id || callData.agent_id;
    let restaurantId = null;

    if (agentId) {
      const { data: restaurant } = await supabaseAdmin
        .from("restaurants")
        .select("id")
        .eq("retell_agent_id", agentId)
        .single();
      restaurantId = restaurant?.id;
    }

    // If no restaurant found, create a demo order anyway
    // so we can see it on the dashboard
    const orderData = {
      restaurant_id: restaurantId || "demo-restaurant-id",
      customer_name: customerName,
      customer_phone: customerPhone,
      items: items.length > 0 ? items : [
        { id: "1", name: "Voice Order Item", qty: 1, price: 0 }
      ],
      notes: notes || transcript.slice(0, 200),
      subtotal: subtotal || 0,
      tax: tax || 0,
      tip: 0,
      platform_fee: platformFee || 0,
      restaurant_payout: restaurantPayout || 0,
      total: total || 0,
      payment_method: paymentMethod,
      payment_status: "pending",
      status: "pending",
      source: "voice_ai",
      retell_call_id: callData.call_id || body.call_id,
    };

    console.log("Saving order:", JSON.stringify(orderData, null, 2));

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error("Order save error:", error);
      return NextResponse.json({ received: true, error: error.message });
    }

    console.log("✅ Order saved:", order?.order_number);

    return NextResponse.json({
      received: true,
      order_id: order?.id,
      order_number: order?.order_number,
    });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ received: true, error: error.message });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "VoceEats Retell webhook active" });
}
