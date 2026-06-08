import { supabaseAdmin } from "@/lib/supabase";

const DEMO_RESTAURANT_ID = "339ad678-297a-4d57-9f4b-a502650829d3";

export async function resolveRestaurantIdFromAgent(agentId?: string | null) {
  if (!agentId) return DEMO_RESTAURANT_ID;
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("retell_agent_id", agentId)
    .maybeSingle();
  return restaurant?.id || DEMO_RESTAURANT_ID;
}

export function extractCallDurationSeconds(callData: Record<string, unknown>) {
  if (typeof callData.duration_ms === "number") {
    return Math.round(callData.duration_ms / 1000);
  }
  if (typeof callData.call_duration === "number") {
    return Math.round(callData.call_duration);
  }
  if (typeof callData.duration === "number") {
    return Math.round(callData.duration);
  }
  const start = callData.start_timestamp ?? callData.start_time;
  const end = callData.end_timestamp ?? callData.end_time;
  if (typeof start === "number" && typeof end === "number") {
    const ms = end > 1_000_000_000_000 ? end - start : (end - start) * 1000;
    return Math.max(0, Math.round(ms / 1000));
  }
  return null;
}

export function deriveCallStatus(options: {
  orderPlaced: boolean;
  disconnectionReason?: string | null;
  eventType?: string;
}) {
  if (options.orderPlaced) return "completed";
  const reason = (options.disconnectionReason || "").toLowerCase();
  if (["dial_no_answer", "dial_busy", "dial_failed", "error"].some((r) => reason.includes(r))) {
    return reason.includes("busy") ? "busy" : reason.includes("no_answer") ? "no_answer" : "failed";
  }
  if (options.eventType === "call_analyzed") return "no_order";
  return "no_order";
}

export async function upsertCallRecord(params: {
  retellCallId: string;
  restaurantId: string;
  callerPhone?: string | null;
  callDurationSeconds?: number | null;
  callStatus: string;
  orderPlaced?: boolean;
  orderId?: string | null;
}) {
  if (!params.retellCallId) return;

  const row = {
    retell_call_id: params.retellCallId,
    restaurant_id: params.restaurantId,
    caller_phone: params.callerPhone || null,
    call_duration_seconds: params.callDurationSeconds ?? null,
    call_status: params.callStatus,
    order_placed: params.orderPlaced ?? false,
    order_id: params.orderId ?? null,
  };

  const { error } = await supabaseAdmin
    .from("calls")
    .upsert(row, { onConflict: "retell_call_id" });

  if (error) {
    console.error("call upsert error:", error.message);
  }
}

export async function linkCallToOrder(retellCallId: string | undefined, orderId: string, restaurantId: string) {
  if (!retellCallId) return;
  await upsertCallRecord({
    retellCallId,
    restaurantId,
    callStatus: "completed",
    orderPlaced: true,
    orderId,
  });
}
