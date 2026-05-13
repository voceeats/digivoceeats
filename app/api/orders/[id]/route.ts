import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    const orderId = params.id;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    switch (action) {
      case "accept":
        await supabaseAdmin.from("orders").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", orderId);
        return NextResponse.json({ success: true, status: "accepted" });

      case "reject":
        await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", orderId);
        return NextResponse.json({ success: true, status: "rejected" });

      case "complete":
        await supabaseAdmin.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
        return NextResponse.json({ success: true, status: "completed" });

      case "mark_cash":
        await supabaseAdmin.from("orders").update({ payment_status: "cash_collected", payment_method: "cash", paid_at: new Date().toISOString(), status: "accepted" }).eq("id", orderId);
        return NextResponse.json({ success: true, payment: "cash_collected" });

      case "in_person_qr":
        return NextResponse.json({ success: true, qrUrl: `https://pay.stripe.com/demo/${orderId}` });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
