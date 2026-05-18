"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PLATFORM_FEE = 0.15;

const STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "New Order",  color: "#FF6B35" },
  accepted:  { label: "Accepted",   color: "#00C896" },
  completed: { label: "Done",       color: "#6B7280" },
  rejected:  { label: "Rejected",   color: "#EF4444" },
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

const S = {
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
  } as React.CSSProperties,
  badge: (color: string) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    background: `${color}15`,
    color,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    border: `1px solid ${color}30`,
  }),
  btn: (color: string, outline = false) => ({
    background: outline ? `${color}15` : color,
    color: outline ? color : "#fff",
    border: outline ? `1px solid ${color}40` : "none",
    borderRadius: 10,
    padding: "11px 20px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "sans-serif",
  } as React.CSSProperties),
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
    <div style={{
      ...S.card,
      border: isNew ? "1px solid rgba(255,107,53,0.35)" : "1px solid rgba(255,255,255,0.07)",
      background: isNew ? "rgba(255,107,53,0.04)" : "rgba(255,255,255,0.02)",
      marginBottom: 12,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: isNew ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            border: isNew ? "1px solid rgba(255,107,53,0.3)" : "1px solid rgba(255,255,255,0.07)",
          }}>📞</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 15 }}>
                {order.customer_name || "Voice Customer"}
              </span>
              <span style={S.badge(cfg.color)}>{cfg.label}</span>
              {order.payment_status === "paid" && <span style={S.badge("#00C896")}>✓ Paid</span>}
              {order.payment_status === "awaiting_payment" && <span style={S.badge("#F59E0B")}>⏳ Awaiting Payment</span>}
              {order.payment_method === "cash" && <span style={S.badge("#6B7280")}>💵 Cash</span>}
            </div>
            <div style={{ color: "#6B7280", fontSize: 12 }}>
              {order.order_number} · {Array.isArray(order.items) ? order.items.length : 0} items · {timeAgo(order.created_at)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 20 }}>
              ${(order.total || 0).toFixed(2)}
            </div>
            <div style={{ color: "#00C896", fontSize: 12 }}>
              Your share: ${(order.restaurant_payout || 0).toFixed(2)}
            </div>
          </div>
          <span style={{ color: "#4B5563", fontSize: 18, transform: expanded ? "rotate(180deg)" : "none", transition: "0.3s", display: "inline-block" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Customer</div>
              {[
                ["📞", order.customer_phone || "—"],
                ["🕐", new Date(order.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })],
                ["🤖", "Voice AI Order"],
                ["💳", (order.payment_method || "—").replace(/_/g, " ")],
              ].map(([icon, val]) => (
                <div key={String(val)} style={{ display: "flex", gap: 10, marginBottom: 6, color: "#D1D5DB", fontSize: 13 }}>
                  <span>{icon}</span><span>{val}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Items Ordered</div>
              {Array.isArray(order.items) && order.items.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#D1D5DB", fontSize: 13 }}>
                    <span style={{ color: "#FF6B35", fontWeight: 700 }}>{item.qty}×</span> {item.name}
                  </span>
                  <span style={{ color: "#F9FAFB", fontWeight: 600, fontSize: 13 }}>
                    ${((item.price || 0) * (item.qty || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
              {order.notes && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
                  <div style={{ color: "#F59E0B", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>📝 NOTES</div>
                  <div style={{ color: "#D1D5DB", fontSize: 12 }}>{order.notes}</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "14px 18px", background: "rgba(0,0,0,0.2)", borderRadius: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            {[
              ["Subtotal", `$${(order.subtotal || 0).toFixed(2)}`, "#F9FAFB"],
              ["Tax (6%)", `$${(order.tax || 0).toFixed(2)}`, "#9CA3AF"],
              ["VoceEats (15%)", `-$${(order.platform_fee || 0).toFixed(2)}`, "#FF6B35"],
              ["Your Payout", `$${(order.restaurant_payout || 0).toFixed(2)}`, "#00C896"],
            ].map(([label, val, color]: any) => (
              <div key={label}>
                <div style={{ color: "#6B7280", fontSize: 11 }}>{label}</div>
                <div style={{ color, fontWeight: 700, fontSize: 15 }}>{val}</div>
              </div>
            ))}
            <div>
              <div style={{ color: "#6B7280", fontSize: 11 }}>Total Charged</div>
              <div style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 20 }}>${(order.total || 0).toFixed(2)}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {order.status === "pending" && (
              <>
                <button onClick={() => doAction("accept")} disabled={!!loading} style={{ ...S.btn("#00C896"), flex: 1, fontSize: 14, padding: "13px" }}>
                  {loading === "accept" ? "..." : "✅ Accept Order"}
                </button>
                <button onClick={() => doAction("reject")} style={S.btn("#EF4444", true)}>✗ Reject</button>
              </>
            )}
            {order.status === "accepted" && (
              <button onClick={() => doAction("complete")} disabled={!!loading} style={{ ...S.btn("#F59E0B"), flex: 1, fontSize: 14, padding: "13px" }}>
                {loading === "complete" ? "..." : "🍽️ Mark Completed"}
              </button>
            )}
            <button style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 13 }}>💳 Send Payment Link</button>
            <button style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 13 }}>🖨️ Print</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuTab({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    loadMenu();
  }, [restaurantId]);

  const loadMenu = async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from("menu_categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("display_order");

    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("display_order");

    setCategories(cats || []);
    setItems(menuItems || []);
    setLoading(false);
  };

  const savePrice = async (itemId: string) => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice <= 0) return;
    setSaving(true);
    try {
      const r = await fetch("/api/menu/update-price", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, restaurantId, newPrice }),
      });
      const data = await r.json();
      if (data.success) {
        setItems(prev => prev.map(item =>
          item.id === itemId
            ? { ...item, price: newPrice, voiceeats_price: data.voiceeats_price }
            : item
        ));
        setSyncMsg("✅ Price updated and Voice AI synced!");
        setTimeout(() => setSyncMsg(""), 3000);
      }
    } catch (e) { console.error(e); }
    setEditingId(null);
    setSaving(false);
  };

  const toggleItem = async (itemId: string, isAvailable: boolean) => {
    try {
      await fetch("/api/menu/toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, restaurantId, isAvailable }),
      });
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, is_available: isAvailable } : item
      ));
      setSyncMsg(isAvailable ? "✅ Item enabled and synced!" : "⏸️ Item disabled and synced!");
      setTimeout(() => setSyncMsg(""), 3000);
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "#6B7280" }}>Loading menu...</div>
  );

  return (
    <div>
      {syncMsg && (
        <div style={{ padding: "12px 20px", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 12, marginBottom: 20, color: "#00C896", fontWeight: 600 }}>
          {syncMsg}
        </div>
      )}

      <div style={{ padding: "16px 20px", background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 12, marginBottom: 24 }}>
        <div style={{ color: "#FF6B35", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>💡 How Pricing Works</div>
        <div style={{ color: "#9CA3AF", fontSize: 12 }}>
          You set your base price → VoceEats adds 15% → Customer pays the total. You always receive your full base price.
        </div>
      </div>

      {categories.map(cat => {
        const catItems = items.filter(item => item.category_id === cat.id);
        if (!catItems.length) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 28 }}>
            <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {cat.name}
            </div>
            {catItems.map(item => (
              <div key={item.id} style={{
                ...S.card,
                padding: "16px 20px",
                marginBottom: 8,
                opacity: item.is_available ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: item.is_available ? "#F9FAFB" : "#6B7280", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    {item.name}
                    {!item.is_available && <span style={{ marginLeft: 8, fontSize: 11, color: "#EF4444", fontWeight: 700 }}>SOLD OUT</span>}
                  </div>
                  {item.description && (
                    <div style={{ color: "#4B5563", fontSize: 12 }}>{item.description}</div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Price Display */}
                  <div style={{ textAlign: "right" }}>
                    {editingId === item.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#6B7280", fontSize: 12 }}>$</span>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          step="0.01"
                          min="0"
                          style={{
                            width: 80,
                            background: "rgba(0,0,0,0.4)",
                            border: "1px solid #FF6B35",
                            borderRadius: 8,
                            padding: "6px 10px",
                            color: "#F9FAFB",
                            fontSize: 14,
                            outline: "none",
                            fontFamily: "inherit",
                          }}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") savePrice(item.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => savePrice(item.id)}
                          disabled={saving}
                          style={{ ...S.btn("#00C896"), padding: "6px 12px", fontSize: 12 }}
                        >
                          {saving ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ ...S.btn("#EF4444", true), padding: "6px 12px", fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div>
                          <div style={{ color: "#6B7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Your Price</div>
                          <div style={{ color: "#F9FAFB", fontWeight: 700, fontSize: 16 }}>${(item.price || 0).toFixed(2)}</div>
                        </div>
                        <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)" }} />
                        <div>
                          <div style={{ color: "#6B7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Customer Pays</div>
                          <div style={{ color: "#FF6B35", fontWeight: 700, fontSize: 16 }}>${(item.voiceeats_price || item.price * 1.15).toFixed(2)}</div>
                        </div>
                        <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)" }} />
                        <div>
                          <div style={{ color: "#6B7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>VoceEats Fee</div>
                          <div style={{ color: "#6B7280", fontWeight: 700, fontSize: 14 }}>
                            ${((item.voiceeats_price || item.price * 1.15) - item.price).toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={() => { setEditingId(item.id); setEditPrice(item.price.toString()); }}
                          style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 12, padding: "8px 14px" }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Toggle */}
                  <div
                    onClick={() => toggleItem(item.id, !item.is_available)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      cursor: "pointer",
                      background: item.is_available ? "#00C896" : "#374151",
                      position: "relative",
                      transition: "background 0.3s",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: 3,
                      left: item.is_available ? 23 : 3,
                      transition: "left 0.3s",
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ ...S.card, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
          <div style={{ color: "#F9FAFB", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No menu items yet</div>
          <div style={{ color: "#6B7280", fontSize: 14 }}>Contact Diginetplore to set up your menu</div>
        </div>
      )}
    </div>
  );
}

function HoursTab({ restaurantId }: { restaurantId: string }) {
  const [hours, setHours] = useState<any>({});
  const [prepTime, setPrepTime] = useState(25);
  const [lastOrder, setLastOrder] = useState(45);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  useEffect(() => {
    loadHours();
  }, [restaurantId]);

  const loadHours = async () => {
    const { data: rest } = await supabase
      .from("restaurants")
      .select("opening_hours, prep_time_minutes, last_order_minutes_before_close")
      .eq("id", restaurantId)
      .single();
    if (rest) {
      setHours(rest.opening_hours || {});
      setPrepTime(rest.prep_time_minutes || 25);
      setLastOrder(rest.last_order_minutes_before_close || 45);
    }
  };

  const updateDay = (day: string, field: string, value: any) => {
    setHours((prev: any) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const saveHours = async () => {
    setSaving(true);
    await supabase.from("restaurants").update({
      opening_hours: hours,
      prep_time_minutes: prepTime,
      last_order_minutes_before_close: lastOrder,
    }).eq("id", restaurantId);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  };

  const inp = { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#F9FAFB", fontSize: 14, outline: "none", fontFamily: "inherit" } as React.CSSProperties;

  return (
    <div>
      {saved && (
        <div style={{ padding: "12px 20px", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 12, marginBottom: 20, color: "#00C896", fontWeight: 600 }}>
          ✅ Hours saved successfully!
        </div>
      )}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 16, marginBottom: 20 }}>⏰ Weekly Hours</h3>
        <div style={{ padding: "12px 16px", background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 10, marginBottom: 20 }}>
          <div style={{ color: "#FF6B35", fontWeight: 600, fontSize: 12 }}>💡 Orders stop {lastOrder} minutes before closing. Prep time is {prepTime} minutes.</div>
        </div>
        {DAYS.map(day => {
          const d = hours[day] || { open: "11:00", close: "22:00", is_closed: false };
          return (
            <div key={day} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 110, color: "#9CA3AF", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{day}</div>
              <div onClick={() => updateDay(day, "is_closed", !d.is_closed)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: !d.is_closed ? "#00C896" : "#374151", position: "relative", transition: "background 0.3s", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: !d.is_closed ? 23 : 3, transition: "left 0.3s" }} />
              </div>
              <span style={{ color: !d.is_closed ? "#00C896" : "#EF4444", fontSize: 12, fontWeight: 700, width: 55 }}>{!d.is_closed ? "OPEN" : "CLOSED"}</span>
              {!d.is_closed && (
                <>
                  <input type="time" value={d.open} onChange={e => updateDay(day, "open", e.target.value)} style={inp} />
                  <span style={{ color: "#6B7280" }}>to</span>
                  <input type="time" value={d.close} onChange={e => updateDay(day, "close", e.target.value)} style={inp} />
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 16, marginBottom: 20 }}>⚙️ Order Settings</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label style={{ display: "block", color: "#9CA3AF", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>🍳 Prep Time (minutes)</label>
            <input type="number" value={prepTime} onChange={e => setPrepTime(parseInt(e.target.value))} min="5" max="120" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            <div style={{ color: "#4B5563", fontSize: 11, marginTop: 6 }}>AI says: "Ready in {prepTime} minutes"</div>
          </div>
          <div>
            <label style={{ display: "block", color: "#9CA3AF", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>🕐 Last Order Before Close (mins)</label>
            <input type="number" value={lastOrder} onChange={e => setLastOrder(parseInt(e.target.value))} min="15" max="120" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            <div style={{ color: "#4B5563", fontSize: 11, marginTop: 6 }}>Stop orders {lastOrder} mins before closing</div>
          </div>
        </div>
      </div>
      <button onClick={saveHours} disabled={saving} style={{ width: "100%", background: saving ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
        {saving ? "Saving..." : "Save Hours →"}
      </button>
    </div>
  );
}

function SettingsTab({ restaurant, onUpdate }: { restaurant: any; onUpdate: (r: any) => void }) {
  const pctFromTax = () => {
    const tr = restaurant.tax_rate ?? 0.06;
    const n = typeof tr === "number" ? tr : parseFloat(String(tr));
    return (Number.isFinite(n) ? n : 0.06) * 100;
  };
  const [name, setName] = useState(restaurant.name || "");
  const [address, setAddress] = useState(restaurant.address || "");
  const [phone, setPhone] = useState(restaurant.phone || "");
  const [email, setEmail] = useState(restaurant.email || "");
  const [taxRate, setTaxRate] = useState(pctFromTax);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(restaurant.name || "");
    setAddress(restaurant.address || "");
    setPhone(restaurant.phone || "");
    setEmail(restaurant.email || "");
    setTaxRate(pctFromTax());
  }, [
    restaurant.id,
    restaurant.name,
    restaurant.address,
    restaurant.phone,
    restaurant.email,
    restaurant.tax_rate,
  ]);

  const saveSettings = async () => {
    setSaving(true);
    const updates = {
      name,
      address,
      phone,
      email,
      tax_rate: taxRate / 100,
    };
    const { data, error } = await supabase
      .from("restaurants")
      .update(updates)
      .eq("id", restaurant.id)
      .select()
      .single();
    if (!error && data) {
      onUpdate(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const inp = {
    width: "100%",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#F9FAFB",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  } satisfies React.CSSProperties;

  const lbl = {
    display: "block",
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  } satisfies React.CSSProperties;

  return (
    <div>
      {saved && (
        <div style={{ padding: "12px 20px", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 12, marginBottom: 20, color: "#00C896", fontWeight: 600 }}>
          ✅ Settings saved successfully!
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28, marginBottom: 20 }}>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 16, marginBottom: 24 }}>🏪 Restaurant Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label style={lbl}>Restaurant Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Restaurant name" />
          </div>
          <div>
            <label style={lbl}>Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="(703) 000-0000" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} style={inp} placeholder="Street, City, State ZIP" />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="owner@restaurant.com" type="email" />
          </div>
          <div>
            <label style={lbl}>Tax Rate (%)</label>
            <input
              value={taxRate}
              onChange={e => setTaxRate(Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0)}
              style={inp}
              type="number"
              step="0.1"
              min="0"
              max="20"
            />
            <div style={{ color: "#4B5563", fontSize: 11, marginTop: 6 }}>Northern Virginia: 6%</div>
          </div>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 16, marginBottom: 16 }}>📞 Voice AI Phone Number</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 12 }}>
          <span style={{ fontSize: 28 }}>🎙️</span>
          <div>
            <div style={{ color: "#F9FAFB", fontWeight: 700, fontSize: 18 }}>(703) 686-5337</div>
            <div style={{ color: "#6B7280", fontSize: 13 }}>Customers call this number to place voice orders</div>
          </div>
        </div>
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        style={{ width: "100%", background: saving ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}
      >
        {saving ? "Saving..." : "Save Settings →"}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "menu" | "analytics" | "hours" | "settings">("orders");
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    initDashboard();
  }, []);

  // Auto open/close based on hours - check every minute
  useEffect(() => {
    if (!restaurant) return;
    const checkHours = async () => {
      try {
        const r = await fetch(`/api/restaurant/hours?restaurantId=${restaurant.id}`);
        const data = await r.json();
        if (typeof data.is_open === "boolean" && data.is_open !== isOpen) {
          setIsOpen(data.is_open);
          await supabase.from("restaurants").update({ is_open: data.is_open }).eq("id", restaurant.id);
          console.log(`Auto ${data.is_open ? "opened" : "closed"} restaurant`);
        }
      } catch (e) { console.error("Hours check failed:", e); }
    };
    checkHours();
    const interval = setInterval(checkHours, 60000);
    return () => clearInterval(interval);
  }, [restaurant, isOpen]);

  const initDashboard = async () => {
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUser(user);

    // Get restaurant for this user
    const { data: rest } = await supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!rest) {
      // For demo — use the Bread & Kabob restaurant
      const { data: demoRest } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", "bread-kabob")
        .single();
      setRestaurant(demoRest);
      loadOrders(demoRest?.id);
      return;
    }

    setRestaurant(rest);
    setIsOpen(rest.is_open);
    loadOrders(rest.id);
    subscribeToOrders(rest.id);
  };

  const loadOrders = async (restaurantId: string) => {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders(data || []);
    setLoading(false);
  };

  const subscribeToOrders = (restaurantId: string) => {
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        setOrders(prev => [payload.new as any, ...prev]);
        // Play alert sound
        try {
          const ctx = new AudioContext();
          const beep = (freq: number, start: number, dur: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
          };
          beep(880, 0, 0.15);
          beep(1100, 0.2, 0.15);
          beep(1320, 0.4, 0.25);
        } catch {}
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
  };

  const updateOrder = (id: string, status: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const toggleRestaurant = async () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (restaurant) {
      await supabase
        .from("restaurants")
        .update({ is_open: newIsOpen })
        .eq("id", restaurant.id);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const pending = orders.filter(o => o.status === "pending").length;
  const todayOrders = orders.filter(o => {
    const today = new Date().toDateString();
    return new Date(o.created_at).toDateString() === today;
  });
  const todayRevenue = todayOrders
    .filter(o => !["rejected", "cancelled"].includes(o.status))
    .reduce((s, o) => s + (o.restaurant_payout || 0), 0);
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const tabs = [
    { id: "orders", label: "Orders", icon: "📋", count: pending },
    { id: "menu", label: "Menu", icon: "🍽️" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "hours", label: "Hours", icon: "⏰" },
    { id: "settings", label: "Settings", icon: "⚙️" },
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
      `}</style>

      {/* Header */}
      <header style={{
        height: 64,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        background: "rgba(0,0,0,0.5)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 26 }}>🎙️</span>
          <div style={{ display: "flex" }}>
            <span style={{ fontWeight: 900, fontSize: 20, background: "linear-gradient(135deg,#FF6B35,#FF9A6C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Voce</span>
            <span style={{ fontWeight: 900, fontSize: 20 }}>Eats</span>
          </div>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{restaurant?.name || "Loading..."}</div>
            <div style={{ color: "#6B7280", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00C896", display: "inline-block", animation: "pulse 2s infinite" }} />
              <div style={{ color: "#6B7280", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00C896", display: "inline-block", animation: "pulse 2s infinite" }} />
                Live · {restaurant?.address || "3407 Payne St, Falls Church, VA"} · Powered by Diginetplore
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>RESTAURANT</span>
            <div
              onClick={toggleRestaurant}
              style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: isOpen ? "#00C896" : "#374151", position: "relative", transition: "background 0.3s" }}
            >
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: isOpen ? 23 : 3, transition: "left 0.3s" }} />
            </div>
            <span style={{ fontSize: 12, color: isOpen ? "#00C896" : "#EF4444", fontWeight: 700 }}>{isOpen ? "OPEN" : "CLOSED"}</span>
          </div>
          <button
            onClick={handleSignOut}
            style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 12, padding: "8px 16px" }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {statCards.map(s => (
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
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              style={{ padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: tab === t.id ? "#FF6B35" : "transparent", color: tab === t.id ? "#fff" : "#6B7280", display: "flex", alignItems: "center", gap: 8, fontFamily: "sans-serif" }}
            >
              {t.icon} {t.label}
              {(t as any).count > 0 && (
                <span style={{ background: tab === t.id ? "rgba(255,255,255,0.3)" : "#FF6B35", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>
                  {(t as any).count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {tab === "orders" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {["all", "pending", "accepted", "completed", "rejected"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{ padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, textTransform: "capitalize", background: filter === f ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.04)", color: filter === f ? "#FF6B35" : "#6B7280", outline: filter === f ? "1px solid rgba(255,107,53,0.3)" : "1px solid rgba(255,255,255,0.06)", fontFamily: "sans-serif" }}
                >
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

        {/* Menu Tab */}
        {tab === "menu" && restaurant && (
          <MenuTab restaurantId={restaurant.id} />
        )}

        {tab === "hours" && restaurant && (
          <HoursTab restaurantId={restaurant.id} />
        )}

        {tab === "settings" && restaurant && (
          <SettingsTab restaurant={restaurant} onUpdate={(updated: any) => setRestaurant(updated)} />
        )}

        {/* Analytics Tab */}
        {tab === "analytics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              {
                title: "💰 Revenue Breakdown",
                rows: [
                  ["Gross Revenue", `$${orders.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)}`, "#F9FAFB"],
                  ["Your Earnings (85%)", `$${orders.reduce((s, o) => s + (o.restaurant_payout || 0), 0).toFixed(2)}`, "#00C896"],
                  ["VoceEats Fee (15%)", `$${orders.reduce((s, o) => s + (o.platform_fee || 0), 0).toFixed(2)}`, "#FF6B35"],
                  ["Tax Collected", `$${orders.reduce((s, o) => s + (o.tax || 0), 0).toFixed(2)}`, "#9CA3AF"],
                ],
              },
              {
                title: "📊 Order Stats",
                rows: [
                  ["Total Orders", orders.length, "#F9FAFB"],
                  ["Completed", orders.filter(o => o.status === "completed").length, "#00C896"],
                  ["Pending", orders.filter(o => o.status === "pending").length, "#FF6B35"],
                  ["Rejected", orders.filter(o => o.status === "rejected").length, "#EF4444"],
                  ["Voice AI Orders", orders.filter(o => o.source === "voice_ai").length, "#6366F1"],
                ],
              },
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
