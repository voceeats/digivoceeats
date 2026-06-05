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

/** Generate a random 4-digit numeric code (1000-9999, no leading zero so it's easy to say/hear). */
function generatePaymentCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Generate a 4-digit code that isn't already in use by an active (unpaid) order. */
async function generateUniquePaymentCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePaymentCode();
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_code", code)
      .in("payment_status", ["unpaid", "pending", "pending_payment"])
      .limit(1);
    if (!data || data.length === 0) return code;
  }
  return generatePaymentCode();
}

function spokenCode(code: string) {
  return code.split("").join(" ... ");
}

async function findOrderByRetellCallId(callId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, payment_code")
    .eq("retell_call_id", callId)
    .maybeSingle();
  return data;
}

/** Return the order's stored payment_code, backfilling one if a legacy order has none. */
async function ensurePaymentCode(order: {
  id: string;
  payment_code?: string | null;
}): Promise<string> {
  if (order.payment_code && /^\d{4}$/.test(order.payment_code)) {
    return order.payment_code;
  }
  const code = await generateUniquePaymentCode();
  await supabaseAdmin.from("orders").update({ payment_code: code }).eq("id", order.id);
  return code;
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
        const code = await ensurePaymentCode(existing);
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

    const code = await generateUniquePaymentCode();

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
      payment_code: code,
    };

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(orderData)
      .select("id, order_number, payment_code")
      .single();

    if (error) {
      if (error.code === "23505" && callId) {
        const existing = await findOrderByRetellCallId(callId);
        if (existing) {
          const existingCode = await ensurePaymentCode(existing);
          return NextResponse.json({
            order_id: existing.id,
            order_number: existing.order_number,
            payment_code: existingCode,
            payment_code_spoken: spokenCode(existingCode),
          });
        }
      }
      console.error("submit_order error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
