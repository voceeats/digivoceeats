"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const S = {
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 } as React.CSSProperties,
  btn: (color: string, outline = false) => ({ background: outline ? `${color}15` : color, color: outline ? color : "#fff", border: outline ? `1px solid ${color}40` : "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" } as React.CSSProperties),
};

export default function AdminPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "restaurants" | "revenue">("overview");

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user.email !== adminEmail) { router.push("/dashboard"); return; }

    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    const { data: rests } = await supabase.from("restaurants").select("*").order("created_at", { ascending: false });
    const { data: orders } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setRestaurants(rests || []);
    setAllOrders(orders || []);
    setLoading(false);
  };

  const totalRevenue = allOrders.reduce((s, o) => s + (o.platform_fee || 0), 0);
  const todayOrders = allOrders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.platform_fee || 0), 0);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontFamily: "sans-serif" }}>
      Loading admin panel...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", fontFamily: "'Segoe UI', sans-serif", color: "#F9FAFB" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <header style={{ height: 64, borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", background: "rgba(0,0,0,0.5)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 26 }}>🎙️</span>
          <div style={{ display: "flex" }}>
            <span style={{ fontWeight: 900, fontSize: 20, background: "linear-gradient(135deg,#FF6B35,#FF9A6C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Voce</span>
            <span style={{ fontWeight: 900, fontSize: 20 }}>Eats</span>
          </div>
          <div style={{ background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.3)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#FF6B35" }}>
            DIGINETPLORE ADMIN
          </div>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push("/login"); }} style={S.btn("rgba(255,255,255,0.08)", true)}>
          Sign Out
        </button>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        {/* Platform Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { icon: "🏪", label: "Restaurants", value: restaurants.length, color: "#6366F1", sub: "Active" },
            { icon: "🛍️", label: "Total Orders", value: allOrders.length, color: "#F59E0B", sub: "All time" },
            { icon: "💰", label: "Today's Revenue", value: `$${todayRevenue.toFixed(0)}`, color: "#00C896", sub: "Your 15%" },
            { icon: "📈", label: "Total Revenue", value: `$${totalRevenue.toFixed(0)}`, color: "#FF6B35", sub: "Your 15% cut" },
          ].map(s => (
            <div key={s.label} style={{ ...S.card, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: `1px solid ${s.color}25`, flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
                <div style={{ color: "#F9FAFB", fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ color: s.color, fontSize: 11, marginTop: 3, fontWeight: 600 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.03)", padding: 5, borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
          {[
            { id: "overview", label: "Overview", icon: "📊" },
            { id: "restaurants", label: "Restaurants", icon: "🏪" },
            { id: "revenue", label: "Revenue", icon: "💰" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: tab === t.id ? "#FF6B35" : "transparent", color: tab === t.id ? "#fff" : "#6B7280", fontFamily: "sans-serif" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div>
            <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Recent Orders — All Restaurants</h3>
            {allOrders.slice(0, 20).map(order => (
              <div key={order.id} style={{ ...S.card, padding: "16px 20px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ color: "#F9FAFB", fontWeight: 700 }}>{order.customer_name || "Voice Customer"}</span>
                  <span style={{ color: "#6B7280", fontSize: 12, marginLeft: 12 }}>{order.order_number}</span>
                </div>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#F9FAFB", fontWeight: 700 }}>${(order.total || 0).toFixed(2)}</div>
                    <div style={{ color: "#FF6B35", fontSize: 12 }}>Fee: ${(order.platform_fee || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ color: order.status === "completed" ? "#00C896" : order.status === "pending" ? "#FF6B35" : "#6B7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                    {order.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Restaurants Tab */}
        {tab === "restaurants" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18 }}>All Restaurants</h3>
              <button style={S.btn("#FF6B35")}>+ Add Restaurant</button>
            </div>
            {restaurants.map(rest => {
              const restOrders = allOrders.filter(o => o.restaurant_id === rest.id);
              const restRevenue = restOrders.reduce((s, o) => s + (o.platform_fee || 0), 0);
              return (
                <div key={rest.id} style={{ ...S.card, padding: "20px 24px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                        <span style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 16 }}>{rest.name}</span>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: rest.is_open ? "#00C896" : "#EF4444", display: "inline-block" }} />
                        <span style={{ color: rest.is_open ? "#00C896" : "#EF4444", fontSize: 11, fontWeight: 700 }}>
                          {rest.is_open ? "OPEN" : "CLOSED"}
                        </span>
                      </div>
                      <div style={{ color: "#6B7280", fontSize: 13 }}>{rest.address}</div>
                      <div style={{ color: "#4B5563", fontSize: 12, marginTop: 4 }}>{rest.phone}</div>
                    </div>
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 20 }}>{restOrders.length}</div>
                        <div style={{ color: "#6B7280", fontSize: 11 }}>Total Orders</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "#FF6B35", fontWeight: 800, fontSize: 20 }}>${restRevenue.toFixed(0)}</div>
                        <div style={{ color: "#6B7280", fontSize: 11 }}>Your Revenue</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 12, padding: "8px 14px" }}>View</button>
                        <button style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 12, padding: "8px 14px" }}>Edit</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Revenue Tab */}
        {tab === "revenue" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ ...S.card, padding: 28 }}>
              <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 20 }}>💰 Platform Revenue</h3>
              {[
                ["Total Gross Revenue", `$${allOrders.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)}`, "#F9FAFB"],
                ["Your 15% Cut", `$${allOrders.reduce((s, o) => s + (o.platform_fee || 0), 0).toFixed(2)}`, "#00C896"],
                ["Restaurant Payouts", `$${allOrders.reduce((s, o) => s + (o.restaurant_payout || 0), 0).toFixed(2)}`, "#6B7280"],
                ["Today's Revenue", `$${todayRevenue.toFixed(2)}`, "#FF6B35"],
              ].map(([label, val, color]: any) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "#9CA3AF", fontSize: 14 }}>{label}</span>
                  <span style={{ color, fontWeight: 800, fontSize: 18 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, padding: 28 }}>
              <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 20 }}>📊 Revenue by Restaurant</h3>
              {restaurants.map(rest => {
                const restOrders = allOrders.filter(o => o.restaurant_id === rest.id);
                const fee = restOrders.reduce((s, o) => s + (o.platform_fee || 0), 0);
                return (
                  <div key={rest.id} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <div style={{ color: "#F9FAFB", fontWeight: 600, fontSize: 14 }}>{rest.name}</div>
                      <div style={{ color: "#6B7280", fontSize: 12 }}>{restOrders.length} orders</div>
                    </div>
                    <span style={{ color: "#FF6B35", fontWeight: 800, fontSize: 18 }}>${fee.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
