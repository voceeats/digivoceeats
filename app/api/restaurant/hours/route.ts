import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computeRestaurantHoursStatus } from "@/lib/restaurant-hours";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId =
      searchParams.get("restaurantId") || "339ad678-297a-4d57-9f4b-a502650829d3";

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select(
        "name, opening_hours, prep_time_minutes, last_order_minutes_before_close, tax_rate, is_open",
      )
      .eq("id", restaurantId)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const prepTime = restaurant.prep_time_minutes || 25;
    const lastOrderBuffer = restaurant.last_order_minutes_before_close || 45;

    const status = computeRestaurantHoursStatus(restaurant.opening_hours, {
      lastOrderMinutesBeforeClose: lastOrderBuffer,
      isOpen: restaurant.is_open !== false,
    });

    return NextResponse.json({
      ...status,
      prep_time_minutes: prepTime,
      restaurant_name: restaurant.name,
      tax_rate: restaurant.tax_rate || 0.06,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Hours check failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
