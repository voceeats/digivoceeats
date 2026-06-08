import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  buildMonthlyReport,
  computePeriodMetrics,
  sumCommission,
  sumRevenue,
  type AnalyticsCall,
  type AnalyticsOrder,
} from "@/lib/analytics";

export async function GET() {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [{ data: restaurants }, { data: orders, error: ordersError }, { data: calls, error: callsError }] =
      await Promise.all([
        supabaseAdmin.from("restaurants").select("id, name, slug").order("name"),
        supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }),
        supabaseAdmin.from("calls").select("*").order("created_at", { ascending: false }),
      ]);

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }
    if (callsError && !callsError.message.includes("does not exist")) {
      return NextResponse.json({ error: callsError.message }, { status: 500 });
    }

    const orderRows = (orders || []) as AnalyticsOrder[];
    const callRows = (calls || []) as AnalyticsCall[];
    const platformMetrics = computePeriodMetrics(orderRows, callRows);

    const revenueByRestaurant = (restaurants || []).map((rest) => {
      const restOrders = orderRows.filter((o) => o.restaurant_id === rest.id);
      const restCalls = callRows.filter((c) => c.restaurant_id === rest.id);
      const metrics = computePeriodMetrics(restOrders, restCalls);
      return {
        restaurantId: rest.id,
        name: rest.name,
        slug: rest.slug,
        orders: restOrders.length,
        revenue: sumRevenue(restOrders),
        commission: sumCommission(restOrders),
        calls: restCalls.length,
        metrics,
      };
    }).sort((a, b) => b.commission - a.commission);

    const monthlyCommissionReport = buildMonthlyReport(orderRows, callRows, year, month, "All Restaurants");

    return NextResponse.json({
      platform: {
        totalRevenue: sumRevenue(orderRows),
        totalCommission: sumCommission(orderRows),
        metrics: platformMetrics,
        restaurantCount: restaurants?.length || 0,
      },
      revenueByRestaurant,
      topRestaurants: revenueByRestaurant.slice(0, 10),
      monthlyCommissionReport,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Admin analytics failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
