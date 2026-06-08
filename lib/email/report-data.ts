import { parseDate, topPopularItems } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase";

export type MonthlyEmailOrder = {
  total?: number;
  restaurant_payout?: number;
  platform_fee?: number;
  items?: Array<{ name?: string; qty?: number }>;
  created_at?: string;
};

export type MonthlyReportMetrics = {
  total_orders: number;
  total_revenue: number;
  restaurant_payout: number;
  platform_fee: number;
  average_order_value: number;
  top_5_items: Array<{ name: string; count: number }>;
  busiest_day: { label: string; count: number };
  busiest_hour: { label: string; count: number };
};

export type RestaurantReportContext = {
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  ownerEmail: string;
  metrics: MonthlyReportMetrics;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHour(hour: number) {
  const h = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${h} ${suffix}`;
}

export function computeMonthlyReportMetrics(orders: MonthlyEmailOrder[]): MonthlyReportMetrics {
  const total_orders = orders.length;
  const total_revenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const restaurant_payout = orders.reduce((s, o) => s + (Number(o.restaurant_payout) || 0), 0);
  const platform_fee = orders.reduce((s, o) => s + (Number(o.platform_fee) || 0), 0);
  const average_order_value = total_orders > 0 ? total_revenue / total_orders : 0;

  const top_5_items = topPopularItems(
    orders.map((o) => ({ items: o.items })),
    5,
  );

  const dayCounts = new Map<number, number>();
  const hourCounts = new Map<number, number>();

  for (const order of orders) {
    const d = parseDate(order.created_at);
    dayCounts.set(d.getDay(), (dayCounts.get(d.getDay()) || 0) + 1);
    hourCounts.set(d.getHours(), (hourCounts.get(d.getHours()) || 0) + 1);
  }

  let busiestDayIdx = 0;
  let busiestDayCount = 0;
  dayCounts.forEach((count, day) => {
    if (count > busiestDayCount) {
      busiestDayCount = count;
      busiestDayIdx = day;
    }
  });

  let busiestHour = 0;
  let busiestHourCount = 0;
  hourCounts.forEach((count, hour) => {
    if (count > busiestHourCount) {
      busiestHourCount = count;
      busiestHour = hour;
    }
  });

  return {
    total_orders,
    total_revenue,
    restaurant_payout,
    platform_fee,
    average_order_value,
    top_5_items,
    busiest_day: {
      label: DAY_NAMES[busiestDayIdx] || "N/A",
      count: busiestDayCount,
    },
    busiest_hour: {
      label: formatHour(busiestHour),
      count: busiestHourCount,
    },
  };
}

export function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function monthRangeIso(year: number, month: number) {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  return { start, end };
}

export function previousCalendarMonth(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export async function fetchPaidOrdersForMonth(restaurantId: string, year: number, month: number) {
  const { start, end } = monthRangeIso(year, month);
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid")
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) throw new Error(error.message);
  return (data || []) as MonthlyEmailOrder[];
}

async function resolveOwnerEmail(restaurant: { email?: string | null; owner_id?: string | null }) {
  if (restaurant.email) return restaurant.email;
  if (restaurant.owner_id) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(restaurant.owner_id);
    if (userData.user?.email) return userData.user.email;
  }
  return null;
}

async function resolveOwnerName(restaurant: { name: string; owner_id?: string | null }) {
  if (restaurant.owner_id) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(restaurant.owner_id);
    const meta = userData.user?.user_metadata as { full_name?: string; name?: string } | undefined;
    if (meta?.full_name) return meta.full_name;
    if (meta?.name) return meta.name;
    if (userData.user?.email) return userData.user.email.split("@")[0];
  }
  return restaurant.name;
}

export async function buildRestaurantReportContext(
  restaurantId: string,
  year: number,
  month: number,
): Promise<RestaurantReportContext | { error: string; restaurantName?: string }> {
  const { data: restaurant, error: restError } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, email, owner_id")
    .eq("id", restaurantId)
    .single();

  if (restError || !restaurant) {
    return { error: restError?.message || "Restaurant not found" };
  }

  const ownerEmail = await resolveOwnerEmail(restaurant);
  if (!ownerEmail) {
    return { error: "No owner email found", restaurantName: restaurant.name };
  }

  const orders = await fetchPaidOrdersForMonth(restaurantId, year, month);
  const metrics = computeMonthlyReportMetrics(orders);
  const ownerName = await resolveOwnerName(restaurant);

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    ownerName,
    ownerEmail,
    metrics,
  };
}

export async function fetchAllRestaurantIds() {
  const { data, error } = await supabaseAdmin.from("restaurants").select("id");
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.id as string);
}

export async function logEmailSend(params: {
  restaurantId: string;
  recipientEmail: string;
  reportMonth: number;
  reportYear: number;
  status: "sent" | "failed";
  errorMessage?: string;
  resendId?: string;
  metrics?: MonthlyReportMetrics;
}) {
  const { error } = await supabaseAdmin.from("email_logs").insert({
    restaurant_id: params.restaurantId,
    recipient_email: params.recipientEmail,
    report_type: "monthly",
    report_month: params.reportMonth,
    report_year: params.reportYear,
    status: params.status,
    error_message: params.errorMessage ?? null,
    resend_id: params.resendId ?? null,
    metrics: params.metrics ?? null,
  });

  if (error && !error.message.includes("does not exist")) {
    console.error("email_logs insert error:", error.message);
  }
}
