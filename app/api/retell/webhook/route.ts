import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEMO_RESTAURANT_ID = "339ad678-297a-4d57-9f4b-a502650829d3";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type || body.event;
    console.log("📞 Retell webhook:", eventType, JSON.stringify(body).slice(0, 200));

    // Only process call_ended or call_analyzed
    if (eventType !== "call_ended" && eventType !== "call_analyzed") {
      return NextResponse.json({ received: true, event: eventType });
    }

    // Avoid duplicate orders - only process call_ended
    if (eventType === "call_analyzed") {
      return NextResponse.json({ received: true, event: eventType });
    }

    const callData = body.call || body;
    const customData = callData.custom_data || body.custom_data || {};

    // Get customer info
    const customerPhone = callData.from_number || customData.customer_phone || null;
    const customerName = customData.customer_name || "Voice Customer";
    const items = customData.order_items || [];
    const paymentMethod = customData.payment_method || "in_person";
    const notes = customData.special_notes || callData.transcript?.slice(0, 300) || "";

    // Find restaurant by agent ID
    const agentId = body.agent_id || callData.agent_id;
    let restaurantId = DEMO_RESTAURANT_ID;

    if (agentId) {
      const { data: restaurant } = await supabaseAdmin
        .from("restaurants")
        .select("id")
        .eq("retell_agent_id", agentId)
        .single();
      if (restaurant?.id) restaurantId = restaurant.id;
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.qty || 1)), 0);
    const tax = parseFloat((subtotal * 0.0875).toFixed(2));
    const platformFee = parseFloat((subtotal * 0.15).toFixed(2));
    const restaurantPayout = parseFloat((subtotal - platformFee).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    // Build order
    const orderData = {
      restaurant_id: restaurantId,
      customer_name: customerName,
      customer_phone: customerPhone,
      items: items.length > 0 ? items : [{ id: "1", name: "Voice Order", qty: 1, price: 0 }],
      notes: notes,
      subtotal,
      tax,
      tip: 0,
      platform_fee: platformFee,
      restaurant_payout: restaurantPayout,
      total,
      payment_method: paymentMethod,
      payment_status: "pending",
      status: "pending",
      source: "voice_ai",
      retell_call_id: callData.call_id || body.call_id,
    };

    console.log("💾 Saving order for restaurant:", restaurantId);

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
  return NextResponse.json({ status: "VoceEats Retell webhook active" });
}
