import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PLATFORM_FEE = 0.15;

export async function POST(request: NextRequest) {
  try {
    const { restaurantId, name, description, categoryId, price } = await request.json();

    if (!restaurantId || !name?.trim() || !categoryId || !price || price <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("menu_items")
      .select("display_order")
      .eq("restaurant_id", restaurantId)
      .eq("category_id", categoryId)
      .order("display_order", { ascending: false })
      .limit(1);

    const voiceeatsPrice = parseFloat((price * (1 + PLATFORM_FEE)).toFixed(2));
    const displayOrder = (existing?.[0]?.display_order ?? -1) + 1;

    const { data: item, error } = await supabaseAdmin
      .from("menu_items")
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: name.trim(),
        description: description?.trim() || null,
        price,
        voiceeats_price: voiceeatsPrice,
        is_available: true,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (error) throw error;

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/menu/sync-retell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
