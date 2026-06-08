"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { monthlyReportToCsv } from "@/lib/analytics";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
};

function StatBox({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ ...CARD, padding: "18px 20px" }}>
      <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ color: "#F9FAFB", fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color, fontSize: 11, marginTop: 6, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color, formatValue }: {
  data: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  color: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, paddingTop: 8 }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const h = Math.max(4, (val / max) * 120);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
            <div style={{ color: "#9CA3AF", fontSize: 10, fontWeight: 600 }}>
              {formatValue ? formatValue(val) : val}
            </div>
            <div style={{ width: "100%", maxWidth: 36, height: h, background: `${color}CC`, borderRadius: "6px 6px 2px 2px" }} />
            <div style={{ color: "#6B7280", fontSize: 10, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
              {d[labelKey]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricRow({ label, value, color = "#F9FAFB" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ color: "#9CA3AF", fontSize: 14 }}>{label}</span>
      <span style={{ color, fontWeight: 800, fontSize: 15 }}>{value}</span>
    </div>
  );
}

type AnalyticsPayload = {
  metrics: {
    calls: { total: number; today: number; week: number; month: number; answerRate: number };
    orders: {
      total: number; today: number; week: number; month: number; averageOrderValue: number;
      topItems: Array<{ name: string; count: number }>;
      peakHours: Array<{ hour: number; count: number }>;
      byDayOfWeek: Array<{ day: number; label: string; count: number }>;
    };
    revenue: {
      total: number; today: number; week: number; month: number;
      restaurantPayout: number; commission: number; averageDaily: number;
    };
  };
  monthlyReport: {
    year: number; month: number;
    calls: { total: number; answerRate: number };
    orders: { total: number; breakdown: Array<{ name: string; count: number }> };
    revenue: { total: number; platformFee: number; restaurantPayout: number; averageOrderValue: number };
    dailyRevenue: Array<{ day: number; label: string; revenue: number; orders: number }>;
  };
  restaurantName?: string;
};

function monthOptions(count = 12) {
  const opts: Array<{ year: number; month: number; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

export function AnalyticsTab({ restaurantId }: { restaurantId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");
  const monthChoices = useMemo(() => monthOptions(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(monthChoices[0]);

  const loadAnalytics = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `/api/analytics?restaurantId=${restaurantId}&month=${selectedPeriod.month}&year=${selectedPeriod.year}`,
      );
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to load analytics");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, selectedPeriod]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const downloadReport = () => {
    if (!data?.monthlyReport) return;
    const csv = monthlyReportToCsv(data.monthlyReport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `digivoceeats-report-${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "#6B7280" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        Loading analytics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...CARD, padding: 32, textAlign: "center", color: "#EF4444" }}>
        {error || "No analytics data"}
      </div>
    );
  }

  const { metrics, monthlyReport } = data;
  const peakHoursDisplay = metrics.orders.peakHours
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .reverse()
    .map((h) => ({
      label: `${h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour}${h.hour >= 12 ? "pm" : "am"}`,
      count: h.count,
    }));

  const dailyChart = monthlyReport.dailyRevenue.map((d) => ({
    label: String(d.day),
    revenue: d.revenue,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Call Analytics */}
      <section>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 14 }}>📞 Call Analytics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <StatBox label="Total Calls" value={metrics.calls.total} color="#6366F1" sub="All time" />
          <StatBox label="This Month" value={metrics.calls.month} color="#6366F1" />
          <StatBox label="This Week" value={metrics.calls.week} color="#6366F1" />
          <StatBox label="Today" value={metrics.calls.today} color="#6366F1" />
          <StatBox label="Answer Rate" value={`${metrics.calls.answerRate}%`} color="#00C896" sub="AI answered" />
        </div>
      </section>

      {/* Order Analytics */}
      <section>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 14 }}>🛍️ Order Analytics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <StatBox label="Voice Orders" value={metrics.orders.total} color="#F59E0B" sub="All time" />
          <StatBox label="This Month" value={metrics.orders.month} color="#F59E0B" />
          <StatBox label="This Week" value={metrics.orders.week} color="#F59E0B" />
          <StatBox label="Today" value={metrics.orders.today} color="#F59E0B" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={{ ...CARD, padding: 24 }}>
            <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Average Order Value</div>
            <div style={{ color: "#F9FAFB", fontSize: 32, fontWeight: 900 }}>${metrics.orders.averageOrderValue.toFixed(2)}</div>
          </div>
          <div style={{ ...CARD, padding: 24 }}>
            <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>Top 5 Items</div>
            {metrics.orders.topItems.length === 0 ? (
              <div style={{ color: "#6B7280", fontSize: 13 }}>No orders yet</div>
            ) : (
              metrics.orders.topItems.map((item, i) => (
                <div key={item.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#D1D5DB", fontSize: 13 }}>{i + 1}. {item.name}</span>
                  <span style={{ color: "#FF6B35", fontWeight: 700 }}>{item.count}</span>
                </div>
              ))
            )}
          </div>
          <div style={{ ...CARD, padding: 24 }}>
            <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>Peak Hours</div>
            {peakHoursDisplay.length === 0 ? (
              <div style={{ color: "#6B7280", fontSize: 13 }}>No data yet</div>
            ) : (
              <BarChart data={peakHoursDisplay} valueKey="count" labelKey="label" color="#FF6B35" />
            )}
          </div>
        </div>
        <div style={{ ...CARD, padding: 24, marginTop: 16 }}>
          <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>Orders by Day of Week</div>
          <BarChart
            data={metrics.orders.byDayOfWeek.map((d) => ({ label: d.label, count: d.count }))}
            valueKey="count"
            labelKey="label"
            color="#6366F1"
          />
        </div>
      </section>

      {/* Revenue Analytics */}
      <section>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 14 }}>💰 Revenue Analytics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <StatBox label="Total Revenue" value={`$${metrics.revenue.total.toFixed(0)}`} color="#F9FAFB" sub="All time (paid)" />
          <StatBox label="This Month" value={`$${metrics.revenue.month.toFixed(0)}`} color="#00C896" />
          <StatBox label="This Week" value={`$${metrics.revenue.week.toFixed(0)}`} color="#00C896" />
          <StatBox label="Today" value={`$${metrics.revenue.today.toFixed(0)}`} color="#00C896" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={{ ...CARD, padding: 24 }}>
            <MetricRow label="Restaurant Payout (85%)" value={`$${metrics.revenue.restaurantPayout.toFixed(2)}`} color="#00C896" />
            <MetricRow label="DigiVoceEats Fee (15%)" value={`$${metrics.revenue.commission.toFixed(2)}`} color="#FF6B35" />
            <MetricRow label="Avg Daily Revenue (month)" value={`$${metrics.revenue.averageDaily.toFixed(2)}`} color="#F9FAFB" />
          </div>
        </div>
      </section>

      {/* Monthly Report */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, margin: 0 }}>📅 Monthly Report</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={`${selectedPeriod.year}-${selectedPeriod.month}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split("-").map(Number);
                const match = monthChoices.find((m) => m.year === year && m.month === month);
                if (match) setSelectedPeriod(match);
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#F9FAFB",
                padding: "10px 14px",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {monthChoices.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={downloadReport}
              style={{
                background: "#FF6B35",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ⬇ Download Report (CSV)
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <StatBox label="Calls" value={monthlyReport.calls.total} color="#6366F1" />
          <StatBox label="Orders" value={monthlyReport.orders.total} color="#F59E0B" />
          <StatBox label="Revenue" value={`$${monthlyReport.revenue.total.toFixed(0)}`} color="#00C896" />
          <StatBox label="Your Payout" value={`$${monthlyReport.revenue.restaurantPayout.toFixed(0)}`} color="#00C896" sub={`Fee: $${monthlyReport.revenue.platformFee.toFixed(0)}`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...CARD, padding: 24 }}>
            <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
              Order Breakdown by Item — {selectedPeriod.label}
            </div>
            {monthlyReport.orders.breakdown.length === 0 ? (
              <div style={{ color: "#6B7280" }}>No orders this month</div>
            ) : (
              monthlyReport.orders.breakdown.slice(0, 10).map((item) => (
                <MetricRow key={item.name} label={item.name} value={item.count} color="#FF6B35" />
              ))
            )}
          </div>
          <div style={{ ...CARD, padding: 24 }}>
            <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
              Daily Revenue — {selectedPeriod.label}
            </div>
            {dailyChart.every((d) => d.revenue === 0) ? (
              <div style={{ color: "#6B7280" }}>No revenue this month</div>
            ) : (
              <BarChart
                data={dailyChart}
                valueKey="revenue"
                labelKey="label"
                color="#00C896"
                formatValue={(v) => `$${v.toFixed(0)}`}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
