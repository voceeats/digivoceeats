import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PLATFORM_FEE = 0.15;

export async function PATCH(request: NextRequest) {
  try {
    const { itemId, restaurantId, newPrice } = await request.json();

    if (!itemId || !newPrice || newPrice <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const voiceeatsPrice = parseFloat((newPrice * (1 + PLATFORM_FEE)).toFixed(2));

    const { error } = await supabaseAdmin
      .from("menu_items")
      .update({
        price: newPrice,
        voiceeats_price: voiceeatsPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId);

    if (error) throw error;

    // Auto sync to Retell
    const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/menu/sync-retell`;
    await fetch(syncUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });

    return NextResponse.json({
      success: true,
      restaurant_price: newPrice,
      voiceeats_price: voiceeatsPrice,
      message: "Price updated and Voice AI synced"
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
