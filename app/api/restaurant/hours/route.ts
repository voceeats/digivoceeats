import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") ||
      "339ad678-297a-4d57-9f4b-a502650829d3";

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("name, opening_hours, prep_time_minutes, last_order_minutes_before_close, is_open, tax_rate")
      .eq("id", restaurantId)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // Get current time in Eastern Time (Virginia)
    const now = new Date();
    const etTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
    }).formatToParts(now);

    const dayName = etTime.find(p => p.type === "weekday")?.value?.toLowerCase() || "";
    const hour = etTime.find(p => p.type === "hour")?.value || "0";
    const minute = etTime.find(p => p.type === "minute")?.value || "0";
    const currentMinutes = parseInt(hour) * 60 + parseInt(minute);

    const hours = restaurant.opening_hours?.[dayName];
    const prepTime = restaurant.prep_time_minutes || 25;
    const lastOrderBuffer = restaurant.last_order_minutes_before_close || 45;

    if (!hours || hours.is_closed || !restaurant.is_open) {
      return NextResponse.json({
        is_open: false,
        reason: "Restaurant is closed today",
        day: dayName,
        current_time: `${hour}:${minute}`,
        prep_time_minutes: prepTime,
      });
    }

    // Parse opening hours
    const [openHour, openMin] = hours.open.split(":").map(Number);
    const [closeHour, closeMin] = hours.close.split(":").map(Number);
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    const lastOrderMinutes = closeMinutes - lastOrderBuffer;

    const isOpen = currentMinutes >= openMinutes && currentMinutes < lastOrderMinutes;

    // Format times for display
    const formatTime = (h: number, m: number) => {
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
    };

    const lastOrderTime = formatTime(
      Math.floor(lastOrderMinutes / 60),
      lastOrderMinutes % 60
    );
    const closeTime = formatTime(closeHour, closeMin);
    const openTime = formatTime(openHour, openMin);

    // Calculate ready time
    const readyMinutes = currentMinutes + prepTime;
    const readyTime = formatTime(
      Math.floor(readyMinutes / 60),
      readyMinutes % 60
    );

    return NextResponse.json({
      is_open: isOpen,
      day: dayName,
      current_time: `${hour}:${minute}`,
      open_time: openTime,
      close_time: closeTime,
      last_order_time: lastOrderTime,
      prep_time_minutes: prepTime,
      ready_time: readyTime,
      restaurant_name: restaurant.name,
      tax_rate: restaurant.tax_rate || 0.06,
      reason: !isOpen
        ? currentMinutes < openMinutes
          ? `We open at ${openTime}`
          : `Sorry, we stopped taking orders at ${lastOrderTime}. We close at ${closeTime}.`
        : null,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
