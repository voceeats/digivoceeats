import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || 
      "339ad678-297a-4d57-9f4b-a502650829d3";

    const { data: items } = await supabaseAdmin
      .from("menu_items")
      .select("name, voiceeats_price, price, is_available, menu_categories(name)")
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true)
      .order("display_order");

    if (!items?.length) {
      return NextResponse.json({ error: "No menu found" }, { status: 404 });
    }

    // Format for Retell
    const menu: Record<string, any[]> = {};
    items.forEach((item: any) => {
      const cat = item.menu_categories?.name || "Other";
      if (!menu[cat]) menu[cat] = [];
      menu[cat].push({
        name: item.name,
        price: `$${(item.voiceeats_price || item.price).toFixed(2)}`,
      });
    });

    // Also return as flat text for easy AI reading
    const menuText = Object.entries(menu)
      .map(([cat, catItems]) => {
        const lines = catItems.map(i => `${i.name}: ${i.price}`).join(", ");
        return `${cat}: ${lines}`;
      }).join("\n");

    return NextResponse.json({
      success: true,
      menu,
      menu_text: menuText,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
