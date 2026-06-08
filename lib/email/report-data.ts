import { MonthlyReportData } from "@/lib/email/monthly-report-template";
import { supabaseAdmin } from "@/lib/supabase";

/** Returns the first and last day of a given month as ISO strings */
export function getMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  return { start, end };
}

/** Human-readable month label, e.g. "May 2025" */
export function formatMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export const monthLabel = formatMonthLabel;

export function previousCalendarMonth(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

type OrderRow = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  restaurant_payout: number;
  platform_fee: number;
  created_at: string;
  items: Array<{ name: string; price: number; qty: number }> | null;
};

export async function buildReportData(
  restaurantId: string,
  year: number,
  month: number,
): Promise<MonthlyReportData> {
  const { start, end } = getMonthRange(year, month);

  const { data: restaurant, error: restErr } = await supabaseAdmin
    .from("restaurants")
    .select("name, email, owner_id")
    .eq("id", restaurantId)
    .single();

  if (restErr || !restaurant) {
    throw new Error(`Restaurant not found: ${restErr?.message}`);
  }

  const ownerName = await resolveOwnerName(restaurant);

  const { data: orders, error: ordErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, payment_status, total, restaurant_payout, platform_fee, created_at, items")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (ordErr) throw new Error(`Orders fetch failed: ${ordErr.message}`);

  const allOrders = (orders ?? []) as OrderRow[];
  const paidOrders = allOrders.filter((o) => o.payment_status === "paid");
  const completedOrders = allOrders.filter((o) => o.status === "completed").length;
  const rejectedOrders = allOrders.filter((o) => o.status === "rejected").length;

  const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const platformFee = paidOrders.reduce((sum, o) => sum + (Number(o.platform_fee) || 0), 0)
    || totalRevenue * 0.15;
  const restaurantEarnings = paidOrders.reduce((sum, o) => sum + (Number(o.restaurant_payout) || 0), 0)
    || totalRevenue * 0.85;
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  const itemMap: Record<string, { count: number; revenue: number }> = {};
  for (const order of paidOrders) {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const key = item.name;
      if (!key) continue;
      if (!itemMap[key]) itemMap[key] = { count: 0, revenue: 0 };
      itemMap[key].count += item.qty ?? 1;
      itemMap[key].revenue += (item.price ?? 0) * (item.qty ?? 1);
    }
  }

  const topItems = Object.entries(itemMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const dayCounts: Record<number, number> = {};
  const hourCounts: Record<number, number> = {};
  for (const order of paidOrders) {
    const d = new Date(order.created_at);
    const day = d.getDay();
    const hour = d.getHours();
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
  }

  const peakDayNum = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  const peakHourNum = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    restaurantName: restaurant.name,
    ownerName,
    month: formatMonthLabel(year, month),
    totalOrders: allOrders.length,
    completedOrders,
    rejectedOrders,
    totalRevenue,
    restaurantEarnings,
    platformFee,
    avgOrderValue,
    topItems,
    peakDay: peakDayNum ? DAY_NAMES[Number(peakDayNum[0])] : "N/A",
    peakHour: peakHourNum ? formatHour(Number(peakHourNum[0])) : "N/A",
    payoutMethod: "Zelle",
  };
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

export type RestaurantReportContext = {
  restaurantId: string;
  ownerEmail: string;
  report: MonthlyReportData;
};

export async function buildRestaurantReportContext(
  restaurantId: string,
  year: number,
  month: number,
): Promise<RestaurantReportContext | { error: string; restaurantName?: string }> {
  try {
    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, email, owner_id")
      .eq("id", restaurantId)
      .single();

    if (!restaurant) {
      return { error: "Restaurant not found" };
    }

    const ownerEmail = await resolveOwnerEmail(restaurant);
    if (!ownerEmail) {
      return { error: "No owner email found", restaurantName: restaurant.name };
    }

    const report = await buildReportData(restaurantId, year, month);
    return { restaurantId, ownerEmail, report };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Report build failed";
    return { error: msg };
  }
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
  report?: MonthlyReportData;
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
    metrics: params.report ?? null,
  });

  if (error && !error.message.includes("does not exist")) {
    console.error("email_logs insert error:", error.message);
  }
}
