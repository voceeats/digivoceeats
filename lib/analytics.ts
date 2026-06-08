export type AnalyticsOrder = {
  id?: string;
  restaurant_id?: string;
  items?: Array<{ name?: string; qty?: number; price?: number }>;
  total?: number;
  subtotal?: number;
  platform_fee?: number;
  restaurant_payout?: number;
  source?: string;
  status?: string;
  payment_status?: string | null;
  created_at?: string;
};

export type AnalyticsCall = {
  id?: string;
  restaurant_id?: string;
  call_duration_seconds?: number | null;
  call_status?: string | null;
  order_placed?: boolean | null;
  created_at?: string;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isVoiceOrder(order: AnalyticsOrder) {
  return order.source === "voice_ai";
}

export function isPlacedVoiceOrder(order: AnalyticsOrder) {
  return isVoiceOrder(order) && !["rejected", "cancelled"].includes(order.status || "");
}

export function isRevenueOrder(order: AnalyticsOrder) {
  return (
    !["rejected", "cancelled"].includes(order.status || "") &&
    (order.payment_status === "paid" || order.payment_status === "cash_collected")
  );
}

export function parseDate(iso?: string) {
  return iso ? new Date(iso) : new Date(0);
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export function isOnOrAfter(iso: string | undefined, boundary: Date) {
  return parseDate(iso).getTime() >= boundary.getTime();
}

export function isBefore(iso: string | undefined, boundary: Date) {
  return parseDate(iso).getTime() < boundary.getTime();
}

export function filterByRange<T extends { created_at?: string }>(
  rows: T[],
  start: Date,
  end?: Date,
) {
  return rows.filter((r) => {
    const t = parseDate(r.created_at).getTime();
    if (t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  });
}

export function sumRevenue(orders: AnalyticsOrder[]) {
  return orders.filter(isRevenueOrder).reduce((s, o) => s + (Number(o.total) || 0), 0);
}

export function sumPayout(orders: AnalyticsOrder[]) {
  return orders.filter(isRevenueOrder).reduce((s, o) => s + (Number(o.restaurant_payout) || 0), 0);
}

export function sumCommission(orders: AnalyticsOrder[]) {
  return orders.filter(isRevenueOrder).reduce((s, o) => s + (Number(o.platform_fee) || 0), 0);
}

export function averageOrderValue(orders: AnalyticsOrder[]) {
  const placed = orders.filter(isPlacedVoiceOrder);
  if (!placed.length) return 0;
  return placed.reduce((s, o) => s + (Number(o.total) || 0), 0) / placed.length;
}

export function topPopularItems(orders: AnalyticsOrder[], limit = 5) {
  const counts = new Map<string, number>();
  for (const order of orders.filter(isPlacedVoiceOrder)) {
    if (!Array.isArray(order.items)) continue;
    for (const item of order.items) {
      const name = String(item.name || "Unknown").trim();
      const qty = Number(item.qty) || 1;
      counts.set(name, (counts.get(name) || 0) + qty);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export function peakOrderingHours(orders: AnalyticsOrder[]) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const order of orders.filter(isPlacedVoiceOrder)) {
    const h = parseDate(order.created_at).getHours();
    hours[h].count += 1;
  }
  return hours;
}

export function ordersByDayOfWeek(orders: AnalyticsOrder[]) {
  return DAY_NAMES.map((label, day) => ({
    day,
    label,
    count: orders.filter(isPlacedVoiceOrder).filter((o) => parseDate(o.created_at).getDay() === day).length,
  }));
}

export function dailyRevenueSeries(orders: AnalyticsOrder[], year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const series = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    label: `${month}/${i + 1}`,
    revenue: 0,
    orders: 0,
  }));

  for (const order of orders.filter(isRevenueOrder)) {
    const d = parseDate(order.created_at);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
    const idx = d.getDate() - 1;
    series[idx].revenue += Number(order.total) || 0;
    series[idx].orders += 1;
  }

  return series;
}

export function callAnswerRate(calls: AnalyticsCall[]) {
  if (!calls.length) return 100;
  const answered = calls.filter((c) => {
    const status = (c.call_status || "").toLowerCase();
    return !["failed", "no_answer", "busy", "error"].includes(status);
  }).length;
  return Math.round((answered / calls.length) * 100);
}

export function computePeriodMetrics(orders: AnalyticsOrder[], calls: AnalyticsCall[], now = new Date()) {
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const callsToday = filterByRange(calls, todayStart);
  const callsWeek = filterByRange(calls, weekStart);
  const callsMonth = filterByRange(calls, monthStart);

  const voiceOrders = orders.filter(isPlacedVoiceOrder);
  const ordersToday = filterByRange(voiceOrders, todayStart);
  const ordersWeek = filterByRange(voiceOrders, weekStart);
  const ordersMonth = filterByRange(voiceOrders, monthStart);

  const revenueToday = sumRevenue(filterByRange(orders, todayStart));
  const revenueWeek = sumRevenue(filterByRange(orders, weekStart));
  const revenueMonth = sumRevenue(filterByRange(orders, monthStart));
  const revenueAll = sumRevenue(orders);

  const daysInMonth = now.getDate() || 1;
  const avgDailyRevenueMonth = revenueMonth / daysInMonth;

  return {
    calls: {
      total: calls.length,
      today: callsToday.length,
      week: callsWeek.length,
      month: callsMonth.length,
      answerRate: callAnswerRate(calls),
    },
    orders: {
      total: voiceOrders.length,
      today: ordersToday.length,
      week: ordersWeek.length,
      month: ordersMonth.length,
      averageOrderValue: averageOrderValue(voiceOrders),
      topItems: topPopularItems(voiceOrders),
      peakHours: peakOrderingHours(voiceOrders),
      byDayOfWeek: ordersByDayOfWeek(voiceOrders),
    },
    revenue: {
      total: revenueAll,
      today: revenueToday,
      week: revenueWeek,
      month: revenueMonth,
      restaurantPayout: sumPayout(orders),
      commission: sumCommission(orders),
      averageDaily: avgDailyRevenueMonth,
    },
  };
}

export function buildMonthlyReport(
  orders: AnalyticsOrder[],
  calls: AnalyticsCall[],
  year: number,
  month: number,
  restaurantName?: string,
) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(year, month);

  const monthOrders = filterByRange(orders, monthStart, monthEnd);
  const monthCalls = filterByRange(calls, monthStart, monthEnd);
  const voiceOrders = monthOrders.filter(isPlacedVoiceOrder);
  const revenueOrders = monthOrders.filter(isRevenueOrder);

  return {
    restaurantName,
    year,
    month,
    period: {
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
    },
    calls: {
      total: monthCalls.length,
      answerRate: callAnswerRate(monthCalls),
    },
    orders: {
      total: voiceOrders.length,
      breakdown: topPopularItems(voiceOrders, 20),
    },
    revenue: {
      total: sumRevenue(monthOrders),
      platformFee: sumCommission(monthOrders),
      restaurantPayout: sumPayout(monthOrders),
      averageOrderValue: averageOrderValue(voiceOrders),
    },
    dailyRevenue: dailyRevenueSeries(revenueOrders, year, month),
  };
}

export function monthlyReportToCsv(report: {
  restaurantName?: string;
  year: number;
  month: number;
  calls: { total: number; answerRate: number };
  orders: { total: number; breakdown: Array<{ name: string; count: number }> };
  revenue: { total: number; platformFee: number; restaurantPayout: number; averageOrderValue: number };
  dailyRevenue: Array<{ day: number; label: string; revenue: number; orders: number }>;
}) {
  const lines: string[] = [];
  lines.push(`DigiVoceEats Monthly Report — ${report.restaurantName || "Restaurant"}`);
  lines.push(`Period,${report.year}-${String(report.month).padStart(2, "0")}`);
  lines.push("");
  lines.push("Metric,Value");
  lines.push(`Total Calls,${report.calls.total}`);
  lines.push(`Answer Rate,${report.calls.answerRate}%`);
  lines.push(`Total Orders,${report.orders.total}`);
  lines.push(`Total Revenue,$${report.revenue.total.toFixed(2)}`);
  lines.push(`Platform Fee (15%),$${report.revenue.platformFee.toFixed(2)}`);
  lines.push(`Restaurant Payout (85%),$${report.revenue.restaurantPayout.toFixed(2)}`);
  lines.push(`Average Order Value,$${report.revenue.averageOrderValue.toFixed(2)}`);
  lines.push("");
  lines.push("Top Items,Quantity");
  for (const item of report.orders.breakdown) {
    lines.push(`"${item.name.replace(/"/g, '""')}",${item.count}`);
  }
  lines.push("");
  lines.push("Day,Revenue,Orders");
  for (const day of report.dailyRevenue) {
    lines.push(`${day.label},$${day.revenue.toFixed(2)},${day.orders}`);
  }
  return lines.join("\n");
}
