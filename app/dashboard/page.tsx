"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STATUS: Record<string, { label: string; color: string; pulse: boolean }> = {
  pending:   { label: "New Order",  color: "#FF6B35", pulse: true  },
  accepted:  { label: "Accepted",   color: "#00C896", pulse: false },
  preparing: { label: "Preparing",  color: "#F59E0B", pulse: false },
  completed: { label: "Done",       color: "#6B7280", pulse: false },
  rejected:  { label: "Rejected",   color: "#EF4444", pulse: false },
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

const S = {
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 } as React.CSSProperties,
  badge: (color: string) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: `${color}15`, color, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, border: `1px solid ${color}30` }),
  btn: (color: string, outline = false) => ({ background: outline ? `${color}15` : color, color: outline ? color : "#fff", border: outline ? `1px solid ${color}40` : "none", borderRadius: 10, padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" } as React.CSSProperties),
};

function OrderCard({ order, onUpdate }: { order: any; onUpdate: (id: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(order.status === "pending");
  const [loading, setLoading] = useState<string | null>(null);
  const cfg = STATUS[order.status] || STATUS.pending;
  const isNew = order.status === "pending";

  const doAction = async (action: string) => {
    setLoading(action);
    try {
      const r = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await r.json();
      if (data.success || data.status) {
        onUpdate(order.id, action === "accept" ? "accepted" : action === "complete" ? "completed" : "rejected");
      }
    } catch (e) { console.error(e); }
    setLoading(null);
  };

  return (
    <div style={{ ...S.card, border: isNew ? "1px solid rgba(255,107,53,0.35)" : "1px solid rgba(255,255,255,0.07)", background: isNew ? "rgba(255,107,53,0.04)" : "rgba(255,255,255,0.02)", marginBottom: 12 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: isNew ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: isNew ? "1px solid rgba(255,107,53,0.3)" : "1px solid rgba(255,255,255,0.07)" }}>📞</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 15 }}>{order.customer_name || "Voice Customer"}</span>
              <span style={S.badge(cfg.color)}>
                {cfg.pulse && <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, display: "inline-block", animation: "pulse 1.5s infinite" }} />}
                {cfg.label}
              </span>
              {order.payment_status === "paid" && <span style={S.badge("#00C896")}>✓ Paid</span>}
            </div>
            <div style={{ color: "#6B7280", fontSize: 12 }}>{order.order_number} · {Array.isArray(order.items) ? order.items.length : 0} items · {timeAgo(order.created_at)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 20 }}>${(order.total || 0).toFixed(2)}</div>
            <div style={{ color: "#00C896", fontSize: 12 }}>Your share: ${(order.restaurant_payout || 0).toFixed(2)}</div>
          </div>
          <span style={{ color: "#4B5563", fontSize: 18, display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "0.3s" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Customer</div>
              {[["📞", order.customer_phone || "—"], ["🕐", new Date(order.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })], ["🤖", "Voice AI Order"], ["💳", (order.payment_method || "—").replace(/_/g, " ")]].map(([icon, val]) => (
                <div key={String(val)} style={{ display: "flex", gap: 10, marginBottom: 6, color: "#D1D5DB", fontSize: 13 }}><span>{icon}</span><span>{val}</span></div>
              ))}
            </div>
            <div>
              <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Items Ordered</div>
              {Array.isArray(order.items) && order.items.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#D1D5DB", fontSize: 13 }}><span style={{ color: "#FF6B35", fontWeight: 700 }}>{item.qty}×</span> {item.name}</span>
                  <span style={{ color: "#F9FAFB", fontWeight: 600, fontSize: 13 }}>${((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>
                </div>
              ))}
              {order.notes && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
                  <div style={{ color: "#F59E0B", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>📝 NOTES / TRANSCRIPT</div>
                  <div style={{ color: "#D1D5DB", fontSize: 12 }}>{order.notes}</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "14px 18px", background: "rgba(0,0,0,0.2)", borderRadius: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            {[["Subtotal", `$${(order.subtotal || 0).toFixed(2)}`, "#F9FAFB"], ["Tax", `$${(order.tax || 0).toFixed(2)}`, "#9CA3AF"], ["VoceEats (15%)", `-$${(order.platform_fee || 0).toFixed(2)}`, "#FF6B35"], ["Your Payout", `$${(order.restaurant_payout || 0).toFixed(2)}`, "#00C896"]].map(([label, val, color]: any) => (
              <div key={label}><div style={{ color: "#6B7280", fontSize: 11 }}>{label}</div><div style={{ color, fontWeight: 700, fontSize: 15 }}>{val}</div></div>
            ))}
            <div><div style={{ color: "#6B7280", fontSize: 11 }}>Total</div><div style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 20 }}>${(order.total || 0).toFixed(2)}</div></div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {order.status === "pending" && (
              <>
                <button onClick={() => doAction("accept")} disabled={loading === "accept"} style={{ ...S.btn("#00C896"), flex: 1, fontSize: 14, padding: "13px" }}>
                  {loading === "accept" ? "..." : "✅ Accept Order"}
                </button>
                <button onClick={() => doAction("reject")} style={{ ...S.btn("#EF4444", true), fontSize: 14, padding: "13px 20px" }}>✗ Reject</button>
              </>
            )}
            {order.status === "accepted" && (
              <button onClick={() => doAction("complete")} disabled={loading === "complete"} style={{ ...S.btn("#F59E0B"), flex: 1, fontSize: 14, padding: "13px" }}>
                {loading === "complete" ? "..." : "🍽️ Mark Completed"}
              </button>
            )}
            <button style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 13, padding: "13px 18px" }}>💳 Collect Payment</button>
            <button style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 13, padding: "13px 18px" }}>🖨️ Print</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<"orders" | "menu" | "analytics">("orders");
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const audioCtx = useRef<AudioContext | null>(null);

  const playAlert = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      const beep = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      beep(880, 0, 0.15); beep(1100, 0.2, 0.15); beep(1320, 0.4, 0.25);
    } catch {}
  }, []);

  // Load orders from Supabase
  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setOrders(data);
      if (error) console.error("Load orders error:", error);
      setLoading(false);
    };
    loadOrders();

    // Realtime subscription
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
      }, (payload) => {
        setOrders(prev => [payload.new as any, ...prev]);
        playAlert();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
      }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playAlert]);

  const updateOrder = (id: string, status: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const pending = orders.filter(o => o.status === "pending").length;
  const todayRevenue = orders.filter(o => !["rejected","cancelled"].includes(o.status)).reduce((s, o) => s + (o.restaurant_payout || 0), 0);
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const tabs = [
    { id: "orders", label: "Orders", icon: "📋", count: pending },
    { id: "menu", label: "Menu", icon: "🍽️" },
    { id: "analytics", label: "Analytics", icon: "📊" },
  ];

  const statCards = [
    { icon: "🔔", label: "Pending", value: pending, color: "#FF6B35", sub: pending > 0 ? "Action needed" : "All clear" },
    { icon: "💰", label: "Today's Payout", value: `$${todayRevenue.toFixed(0)}`, color: "#00C896", sub: "Your 85%" },
    { icon: "🛍️", label: "Total Orders", value: orders.length, color: "#6366F1", sub: "All time" },
    { icon: "📞", label: "Voice Orders", value: orders.filter(o => o.source === "voice_ai").length, color: "#F59E0B", sub: "Via AI" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", fontFamily: "'Segoe UI', sans-serif", color: "#F9FAFB" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        input,select{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:#F9FAFB;border-radius:10px;padding:10px 14px;outline:none;font-family:inherit}
      `}</style>

      <header style={{ height: 64, borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", background: "rgba(0,0,0,0.5)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 26 }}>🎙️</span>
          <div style={{ display: "flex" }}>
            <span style={{ fontWeight: 900, fontSize: 20, background: "linear-gradient(135deg,#FF6B35,#FF9A6C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Voce</span>
            <span style={{ fontWeight: 900, fontSize: 20 }}>Eats</span>
          </div>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Restaurant Dashboard</div>
            <div style={{ color: "#6B7280", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00C896", display: "inline-block", animation: "pulse 2s infinite" }} />
              Live · Powered by Diginetplore
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>RESTAURANT</span>
            <div onClick={() => setIsOpen(!isOpen)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: isOpen ? "#00C896" : "#374151", position: "relative", transition: "background 0.3s" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: isOpen ? 23 : 3, transition: "left 0.3s" }} />
            </div>
            <span style={{ fontSize: 12, color: isOpen ? "#00C896" : "#EF4444", fontWeight: 700 }}>{isOpen ? "OPEN" : "CLOSED"}</span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {statCards.map(s => (
            <div key={s.label} style={{ ...S.card, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: `1px solid ${s.color}25`, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
                <div style={{ color: "#F9FAFB", fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ color: s.color, fontSize: 11, marginTop: 3, fontWeight: 600 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.03)", padding: 5, borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: tab === t.id ? "#FF6B35" : "transparent", color: tab === t.id ? "#fff" : "#6B7280", display: "flex", alignItems: "center", gap: 8, fontFamily: "sans-serif" }}>
              {t.icon} {t.label}
              {(t as any).count > 0 && <span style={{ background: tab === t.id ? "rgba(255,255,255,0.3)" : "#FF6B35", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>{(t as any).count}</span>}
            </button>
          ))}
        </div>

        {tab === "orders" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {["all","pending","accepted","completed","rejected"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, textTransform: "capitalize", background: filter === f ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.04)", color: filter === f ? "#FF6B35" : "#6B7280", outline: filter === f ? "1px solid rgba(255,107,53,0.3)" : "1px solid rgba(255,255,255,0.06)", fontFamily: "sans-serif" }}>
                  {f} ({f === "all" ? orders.length : orders.filter(o => o.status === f).length})
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4B5563" }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: "pulse 1s infinite" }}>⏳</div>
                <div>Loading orders...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4B5563" }}>
                <div style={{ fontSize: 56, marginBottom: 20 }}>📞</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No orders yet</div>
                <div style={{ fontSize: 14 }}>Call (703) 686-5337 to place a voice order!</div>
              </div>
            ) : (
              filtered.map(order => (
                <OrderCard key={order.id} order={order} onUpdate={updateOrder} />
              ))
            )}
          </div>
        )}

        {tab === "menu" && (
          <div style={{ ...S.card, padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
            <div style={{ color: "#F9FAFB", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Menu Management</div>
            <div style={{ color: "#6B7280", fontSize: 14 }}>Upload your menu photo and AI extracts everything automatically</div>
          </div>
        )}

        {tab === "analytics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              { title: "💰 Revenue", rows: [["Gross Revenue", `$${orders.reduce((s,o)=>s+(o.total||0),0).toFixed(2)}`, "#F9FAFB"], ["Your Earnings (85%)", `$${orders.reduce((s,o)=>s+(o.restaurant_payout||0),0).toFixed(2)}`, "#00C896"], ["VoceEats Fee (15%)", `$${orders.reduce((s,o)=>s+(o.platform_fee||0),0).toFixed(2)}`, "#FF6B35"]] },
              { title: "📊 Orders", rows: [["Total", orders.length, "#F9FAFB"], ["Completed", orders.filter(o=>o.status==="completed").length, "#00C896"], ["Pending", orders.filter(o=>o.status==="pending").length, "#FF6B35"], ["Voice AI", orders.filter(o=>o.source==="voice_ai").length, "#6366F1"]] },
            ].map(section => (
              <div key={section.title} style={{ ...S.card, padding: 28 }}>
                <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 20 }}>{section.title}</h3>
                {section.rows.map(([label, val, color]: any) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "#9CA3AF", fontSize: 14 }}>{label}</span>
                    <span style={{ color, fontWeight: 800, fontSize: 16 }}>{val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
