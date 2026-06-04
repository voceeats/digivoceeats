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

    const syncRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/menu/sync-retell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });

    const syncBody = await syncRes.json().catch(() => ({}));
    if (!syncRes.ok) {
      console.error("Retell sync after toggle failed:", syncBody);
    } else {
      console.log(`✅ Retell synced after toggle (${isAvailable ? "enabled" : "disabled"} item ${itemId})`);
    }

    return NextResponse.json({
      success: true,
      is_available: isAvailable,
      retell_synced: syncRes.ok,
      items_synced: syncBody?.items_synced,
      message: isAvailable ? "Item is now available" : "Item marked as sold out",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Toggle failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
