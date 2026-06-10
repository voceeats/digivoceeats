import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const callId = body.call?.call_id || body.call_id;

    if (!callId) {
      return NextResponse.json({ error: "No call_id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("call_temp_data")
      .select("payment_code, payment_code_spoken, customer_phone_formatted")
      .eq("call_id", callId)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    return NextResponse.json({
      payment_code: data.payment_code,
      payment_code_spoken: data.payment_code_spoken,
      customer_phone_formatted: data.customer_phone_formatted,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "get-call-data failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
