import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEMO_RESTAURANT_ID = "339ad678-297a-4d57-9f4b-a502650829d3";

const MENU_ITEMS: Record<string, number> = {
  "bruschetta": 8.99,
  "calamari": 12.99,
  "margherita pizza": 16.99,
  "margherita": 16.99,
  "pasta carbonara": 18.99,
  "carbonara": 18.99,
  "pasta": 18.99,
  "chicken parmigiana": 19.99,
  "chicken": 19.99,
  "parmigiana": 19.99,
  "tiramisu": 7.99,
  "panna cotta": 6.99,
  "house wine": 9.99,
  "wine": 9.99,
  "sparkling water": 3.99,
  "water": 3.99,
  "soft drink": 2.99,
  "soda": 2.99,
};

function parseOrderFromTranscript(transcript: string): Array<{ id: string; name: string; price: number; qty: number }> {
  const items: Array<{ id: string; name: string; price: number; qty: number }> = [];
  const lower = transcript.toLowerCase();

  for (const [key, price] of Object.entries(MENU_ITEMS)) {
    if (lower.includes(key)) {
      // Check if already added
      const exists = items.find(i => i.price === price);
      if (!exists) {
        // Try to find quantity
        const qtyMatch = lower.match(new RegExp(`(\\d+)\\s*(?:x\\s*)?${key.split(' ')[0]}`));
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
        items.push({
          id: String(items.length + 1),
          name: key.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          price,
          qty,
        });
      }
    }
  }

  return items;
}

function extractCustomerName(transcript: string, customData: any): string {
  if (customData?.customer_name) return customData.customer_name;
  const nameMatch = transcript.match(/(?:my name is|i(?:'m| am|'m)) ([A-Z][a-z]+)/i);
  if (nameMatch) return nameMatch[1];
  return "Voice Customer";
}

function extractPaymentMethod(transcript: string, customData: any): string {
  if (customData?.payment_method) return customData.payment_method;
  const lower = transcript.toLowerCase();
  if (lower.includes("send") && lower.includes("link")) return "sms_link";
  if (lower.includes("text") || lower.includes("sms")) return "sms_link";
  if (lower.includes("card") && lower.includes("phone")) return "ivr";
  if (lower.includes("in person") || lower.includes("arrive") || lower.includes("pick up")) return "in_person";
  return "in_person";
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
    console.log("📦 Custom data:", JSON.stringify(customData));

    // Get customer info
    const customerPhone = callData.from_number || customData.customer_phone || null;
    const customerName = extractCustomerName(transcript, customData);
    const paymentMethod = extractPaymentMethod(transcript, customData);
    const notes = customData.special_notes || "";

    // Parse items from transcript
    let items = customData.order_items || [];
    if (!items.length) {
      items = parseOrderFromTranscript(transcript);
    }

    // Use order_total from custom data if available
    let subtotal = 0;
    if (customData.order_total) {
      subtotal = parseFloat(customData.order_total);
    } else {
      subtotal = items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.qty || 1)), 0);
    }

    const tax = parseFloat((subtotal * 0.0875).toFixed(2));
    const platformFee = parseFloat((subtotal * 0.15).toFixed(2));
    const restaurantPayout = parseFloat((subtotal - platformFee).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    // Find restaurant
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
      payment_status: "pending",
      status: "pending",
      source: "voice_ai",
      retell_call_id: callData.call_id || body.call_id,
    };

    console.log("💾 Saving order:", JSON.stringify(orderData, null, 2));

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
    return NextResponse.json({ received: true, order_id: order?.id, order_number: order?.order_number });

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ received: true, error: error.message });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "VoceEats Retell webhook active" });
}
