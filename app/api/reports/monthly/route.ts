import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  buildMonthlyReport,
  type AnalyticsCall,
  type AnalyticsOrder,
} from "@/lib/analytics";

const DEMO_RESTAURANT_ID = "339ad678-297a-4d57-9f4b-a502650829d3";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || DEMO_RESTAURANT_ID;
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    const monthStart = new Date(year, month - 1, 1).toISOString();
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const [{ data: restaurant }, { data: orders, error: ordersError }, { data: calls, error: callsError }] =
      await Promise.all([
        supabaseAdmin.from("restaurants").select("id, name").eq("id", restaurantId).single(),
        supabaseAdmin
          .from("orders")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("calls")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd)
          .order("created_at", { ascending: false }),
      ]);

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }
    if (callsError && !callsError.message.includes("does not exist")) {
      return NextResponse.json({ error: callsError.message }, { status: 500 });
    }

    const report = buildMonthlyReport(
      (orders || []) as AnalyticsOrder[],
      (calls || []) as AnalyticsCall[],
      year,
      month,
      restaurant?.name,
    );

    return NextResponse.json({ report });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Report failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
