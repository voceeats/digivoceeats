import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { orderId, restaurantId } = await request.json();

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("name, address, phone")
      .eq("id", restaurantId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get saved printers for this restaurant
    const { data: printers } = await supabaseAdmin
      .from("printers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_online", true)
      .eq("is_default", true)
      .limit(1);

    return NextResponse.json({
      success: true,
      order,
      restaurant,
      printers: printers || [],
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
