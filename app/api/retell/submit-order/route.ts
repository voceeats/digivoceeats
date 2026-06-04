import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEMO_RESTAURANT_ID = "339ad678-297a-4d57-9f4b-a502650829d3";

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

function paymentCode(orderNumber: string) {
  return String(orderNumber).slice(-4).toUpperCase();
}

function spokenCode(code: string) {
  return code.split("").join(" ... ");
}

async function findOrderByRetellCallId(callId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number")
    .eq("retell_call_id", callId)
    .maybeSingle();
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const args = body.args || body;
    const call = body.call || {};
    const callId = call.call_id as string | undefined;
    const agentId = (call.agent_id || body.agent_id) as string | undefined;

    if (callId) {
      const existing = await findOrderByRetellCallId(callId);
      if (existing) {
        const code = paymentCode(existing.order_number);
        return NextResponse.json({
          order_id: existing.id,
          order_number: existing.order_number,
          payment_code: code,
          payment_code_spoken: spokenCode(code),
        });
      }
    }

    const customerName = String(args.customer_name || "Voice Customer").trim() || "Voice Customer";
    const orderSummary = String(args.order_summary || "");
    const notes = String(args.special_notes || "").trim();
    const items = parseOrderSummary(orderSummary);

    let subtotal = 0;
    const orderTotalRaw = parseFloat(String(args.order_total || "0"));
    if (orderTotalRaw > 0) {
      subtotal = parseFloat((orderTotalRaw / 1.06).toFixed(2));
    } else {
      subtotal = parseFloat(
        items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2),
      );
    }

    const tax = parseFloat((subtotal * 0.06).toFixed(2));
    const total = orderTotalRaw > 0 ? orderTotalRaw : parseFloat((subtotal + tax).toFixed(2));
    const platformFee = parseFloat((subtotal - subtotal / 1.15).toFixed(2));
    const restaurantPayout = parseFloat((subtotal / 1.15).toFixed(2));

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
      customer_phone: args.customer_phone ? String(args.customer_phone) : null,
      items: items.length > 0 ? items : [{ id: "1", name: "Voice Order", qty: 1, price: subtotal }],
      notes,
      subtotal,
      tax,
      tip: 0,
      platform_fee: platformFee,
      restaurant_payout: restaurantPayout,
      total,
      payment_method: "pay_code",
      payment_status: "unpaid",
      status: "pending_payment",
      source: "voice_ai",
      retell_call_id: callId || null,
    };

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(orderData)
      .select("id, order_number")
      .single();

    if (error) {
      if (error.code === "23505" && callId) {
        const existing = await findOrderByRetellCallId(callId);
        if (existing) {
          const code = paymentCode(existing.order_number);
          return NextResponse.json({
            order_id: existing.id,
            order_number: existing.order_number,
            payment_code: code,
            payment_code_spoken: spokenCode(code),
          });
        }
      }
      console.error("submit_order error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const code = paymentCode(order!.order_number);
    console.log(`✅ submit_order: ${order!.order_number} code=${code}`);

    return NextResponse.json({
      order_id: order!.id,
      order_number: order!.order_number,
      payment_code: code,
      payment_code_spoken: spokenCode(code),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "submit_order failed";
    console.error("submit_order error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
