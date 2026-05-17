import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    const { itemId, restaurantId, isAvailable } = await request.json();

    const { error } = await supabaseAdmin
      .from("menu_items")
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId);

    if (error) throw error;

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/menu/sync-retell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });

    return NextResponse.json({
      success: true,
      is_available: isAvailable,
      message: isAvailable ? "Item is now available" : "Item marked as sold out"
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
