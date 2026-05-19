import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(request: NextRequest) {
  try {
    const { itemId, restaurantId } = await request.json();

    if (!itemId || !restaurantId) {
      return NextResponse.json({ error: "Missing itemId or restaurantId" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("menu_items")
      .delete()
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId);

    if (error) throw error;

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/menu/sync-retell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
