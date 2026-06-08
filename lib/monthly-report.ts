import { parseDate, topPopularItems } from "@/lib/analytics";

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
    const day = d.getDay();
    const hour = d.getHours();
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
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
