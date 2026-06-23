"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { PaymentQrSection } from "@/components/payment-qr-section";
import { AnalyticsTab } from "@/components/analytics-tab";
import { detectAndPrint, browserPrint, type PrintOrder } from "@/lib/print";
import toast from "react-hot-toast";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PLATFORM_FEE = 0.15;

/** Restaurant sees paid orders, in-progress orders, and unpaid pay-at-restaurant orders (for payment code). */
function isVisibleToRestaurant(order: { status?: string; payment_status?: string | null }) {
  return true;
}

function isAwaitingPayment(order: { status?: string; payment_status?: string | null }) {
  return order.payment_status === "unpaid" &&
    !["completed", "rejected", "cancelled"].includes(order.status ?? "");
}

function isNewPaidOrder(order: { status?: string; payment_status?: string | null }) {
  return order.status === "pending" && order.payment_status === "paid";
}

/** Sound/toast alert only when a paid order is ready for accept/reject. */
function isNewOrderAlert(order: { status?: string; payment_status?: string | null }) {
  return isNewPaidOrder(order) || isAwaitingPayment(order);
}

function getOrderBadge(order: { status?: string; payment_status?: string | null }) {
  if (isAwaitingPayment(order)) return { label: "Awaiting Payment", color: "#F59E0B" };
  if (isNewPaidOrder(order)) return { label: "New Order", color: "#00C896" };
  if (order.status === "accepted") return { label: "Preparing", color: "#3B82F6" };
  if (order.status === "completed") return { label: "Completed", color: "#6B7280" };
  if (order.status === "rejected") return { label: "Rejected", color: "#EF4444" };
  return { label: "Pending", color: "#FF6B35" };
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

async function openAudioContext(): Promise<AudioContext | null> {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Pleasant restaurant bell — Web Audio only */
function playRestaurantBell(audioContext: AudioContext) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.3);

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.5);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 1.5);
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

function OrderCard({
  order,
  onUpdate,
}: {
  order: any;
  onUpdate: (id: string, status: string) => void;
}) {
  const awaiting = isAwaitingPayment(order);
  const isNew = isNewPaidOrder(order);
  const [expanded, setExpanded] = useState(isNew || awaiting);
  const [loading, setLoading] = useState<string | null>(null);
  const [smsPhone, setSmsPhone] = useState(order.customer_phone || "");
  const badge = getOrderBadge(order);
  const showPaymentCode = true;
  const showAcceptReject =
    (order.status === "pending" && order.payment_status === "paid") ||
    (order.status === "pending_payment" && order.payment_status === "unpaid");

  // Auto-expand when Stripe payment completes and order becomes actionable
  useEffect(() => {
    if (showAcceptReject) setExpanded(true);
  }, [showAcceptReject, order.id]);

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

  const handlePrint = () => {
    const po: PrintOrder = {
      order_number: order.order_number || "",
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      items: Array.isArray(order.items)
        ? order.items.map((i: any) => ({
            name: i.name || "Item",
            qty: Number(i.qty) || 1,
            price: Number(i.price) || 0,
          }))
        : [],
      subtotal: Number(order.subtotal) || 0,
      tax: Number(order.tax) || 0,
      total: Number(order.total) || 0,
      platform_fee: Number(order.platform_fee) || 0,
      restaurant_payout: Number(order.restaurant_payout) || 0,
      payment_method: order.payment_method,
      notes: order.notes,
      restaurant_name: "Bread & Kabob",
      restaurant_address: "3407 Payne St, Falls Church, VA",
      restaurant_phone: "(703) 845-2900",
      created_at: order.created_at || new Date().toISOString(),
    };
    browserPrint(po);
  };

  const accent = isNew ? "#00C896" : awaiting ? "#F59E0B" : null;

  return (
    <div style={{
      ...S.card,
      border: accent ? `1px solid ${accent}59` : "1px solid rgba(255,255,255,0.07)",
      background: accent ? `${accent}0A` : "rgba(255,255,255,0.02)",
      marginBottom: 12,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: accent ? `${accent}26` : "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            border: accent ? `1px solid ${accent}4D` : "1px solid rgba(255,255,255,0.07)",
          }}>📞</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 15 }}>
                {order.customer_name || "Voice Customer"}
              </span>
              <span style={S.badge(badge.color)}>{badge.label}</span>
              {order.payment_method === "cash" && <span style={S.badge("#6B7280")}>💵 Cash</span>}
            </div>
            <div style={{ color: "#6B7280", fontSize: 12 }}>
              {order.order_number} · {Array.isArray(order.items) ? order.items.length : 0} items · {timeAgo(order.created_at)}
              {showPaymentCode && (
                <span style={{ color: "#FF6B35", fontWeight: 700, marginLeft: 8 }}>
                  · Code: {order.payment_code}
                </span>
              )}
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

      {showPaymentCode && (
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid rgba(255,107,53,0.25)",
            background: "rgba(255,107,53,0.08)",
          }}
        >
          <div style={{ color: "#FF6B35", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
            Payment Code
          </div>
          <div style={{ color: "#F9FAFB", fontSize: 32, fontWeight: 900, letterSpacing: 6, lineHeight: 1.1 }}>
            {order.payment_code}
          </div>
          <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6 }}>
            Tell this code to customer if they need it
          </div>
        </div>
      )}

      {showAcceptReject && (
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid rgba(0,200,150,0.25)",
            background: "rgba(0,200,150,0.08)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void doAction("accept"); }}
            disabled={!!loading}
            style={{ ...S.btn("#00C896"), flex: 1, fontSize: 14, padding: "13px", minWidth: 140 }}
          >
            {loading === "accept" ? "..." : "✅ Accept Order"}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void doAction("reject"); }}
            disabled={!!loading}
            style={S.btn("#EF4444", true)}
          >
            {loading === "reject" ? "..." : "✗ Reject"}
          </button>
        </div>
      )}

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
              ["DigiVoceEats (15%)", `-$${(order.platform_fee || 0).toFixed(2)}`, "#FF6B35"],
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

          {/* Send SMS Payment Link */}
          {order.payment_status !== "paid" && order.payment_status !== "cash_collected" && order.status !== "rejected" && order.status !== "completed" && (
            <div style={{
              padding: "16px 22px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,200,150,0.04)",
              marginBottom: 20,
            }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, display: "block", marginBottom: 4 }}>
                  CUSTOMER PHONE (edit if wrong)
                </label>
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="Enter phone number"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
                    color: "#F9FAFB", fontSize: 14, fontFamily: "monospace",
                  }}
                />
              </div>
              <button
                type="button"
                disabled={!!loading}
                onClick={async (e) => {
                  e.stopPropagation();
                  const phoneToUse = smsPhone || order.customer_phone;
                  if (!phoneToUse) return;
                  setLoading("sms");
                  try {
                    if (smsPhone && smsPhone !== order.customer_phone) {
                      await supabase
                        .from("orders")
                        .update({ customer_phone: phoneToUse })
                        .eq("id", order.id);
                    }
                    const res = await fetch(`/api/orders/${order.id}/resend-sms`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phone: phoneToUse }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(`SMS sent to ${data.sent_to}`);
                    } else {
                      toast.error(data.error || "Failed to send");
                    }
                  } catch {
                    toast.error("Network error");
                  }
                  setLoading(null);
                }}
                style={{
                  width: "100%", padding: "10px", borderRadius: 8,
                  background: "#3B82F6", color: "#fff", border: "none",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  opacity: loading === "sms" ? 0.7 : 1,
                }}
              >
                {loading === "sms" ? "Sending..." : "📱 Save Number & Send Payment Link"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {order.status === "accepted" && (
              <button onClick={() => doAction("complete")} disabled={!!loading} style={{ ...S.btn("#F59E0B"), flex: 1, fontSize: 14, padding: "13px" }}>
                {loading === "complete" ? "..." : "🍽️ Mark Completed"}
              </button>
            )}
            <button type="button" onClick={() => handlePrint()} style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 13 }}>🖨️ Print</button>
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    price: "",
  });
  const [adding, setAdding] = useState(false);

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

  const addBasePrice = parseFloat(addForm.price);
  const addVoiceeatsPrice = Number.isFinite(addBasePrice) && addBasePrice > 0
    ? parseFloat((addBasePrice * (1 + PLATFORM_FEE)).toFixed(2))
    : 0;

  const openAddModal = () => {
    setAddForm({
      name: "",
      description: "",
      categoryId: categories[0]?.id || "",
      price: "",
    });
    setShowAddModal(true);
  };

  const addItem = async () => {
    const price = parseFloat(addForm.price);
    if (!addForm.name.trim() || !addForm.categoryId || isNaN(price) || price <= 0) return;
    setAdding(true);
    try {
      const r = await fetch("/api/menu/create-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: addForm.name.trim(),
          description: addForm.description.trim() || undefined,
          categoryId: addForm.categoryId,
          price,
        }),
      });
      const data = await r.json();
      if (data.success && data.item) {
        setItems(prev => [...prev, data.item]);
        setShowAddModal(false);
        setSyncMsg("✅ Item added and Voice AI synced!");
        setTimeout(() => setSyncMsg(""), 3000);
      } else {
        setSyncMsg(`❌ ${data.error || "Failed to add item"}`);
        setTimeout(() => setSyncMsg(""), 4000);
      }
    } catch (e) { console.error(e); }
    setAdding(false);
  };

  const deleteItem = async (itemId: string) => {
    setDeletingId(itemId);
    try {
      const r = await fetch("/api/menu/delete-item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, restaurantId }),
      });
      const data = await r.json();
      if (data.success) {
        setItems(prev => prev.filter(item => item.id !== itemId));
        setSyncMsg("✅ Item deleted and Voice AI synced!");
        setTimeout(() => setSyncMsg(""), 3000);
      } else {
        setSyncMsg(`❌ ${data.error || "Failed to delete item"}`);
        setTimeout(() => setSyncMsg(""), 4000);
      }
    } catch (e) { console.error(e); }
    setDeleteConfirmId(null);
    setDeletingId(null);
  };

  const modalInp = {
    width: "100%",
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#F9FAFB",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  };

  const modalLbl = {
    display: "block",
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 6,
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ padding: "16px 20px", background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 12, flex: 1 }}>
          <div style={{ color: "#FF6B35", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>💡 How Pricing Works</div>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>
            You set your base price → DigiVoceEats adds 15% → Customer pays the total. You always receive your full base price.
          </div>
        </div>
        <button
          onClick={openAddModal}
          disabled={categories.length === 0}
          style={{ ...S.btn("#FF6B35"), padding: "14px 22px", fontSize: 14, whiteSpace: "nowrap" }}
        >
          + Add New Item
        </button>
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
                          <div style={{ color: "#6B7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>DigiVoceEats Fee</div>
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
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          style={{ ...S.btn("#EF4444", true), fontSize: 12, padding: "8px 14px" }}
                        >
                          🗑️ Delete
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
          <div style={{ color: "#6B7280", fontSize: 14, marginBottom: 20 }}>Add your first item to get started</div>
          {categories.length > 0 && (
            <button onClick={openAddModal} style={{ ...S.btn("#FF6B35"), padding: "12px 24px" }}>
              + Add New Item
            </button>
          )}
        </div>
      )}

      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 24,
          }}
          onClick={() => !adding && setShowAddModal(false)}
        >
          <div
            style={{ ...S.card, padding: 28, width: "100%", maxWidth: 480, background: "#12121a" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 20 }}>Add New Menu Item</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={modalLbl}>Item Name *</label>
              <input
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                style={modalInp}
                placeholder="e.g. Chicken Kabob Platter"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={modalLbl}>Description (optional)</label>
              <input
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                style={modalInp}
                placeholder="Short description for the menu"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={modalLbl}>Category *</label>
              <select
                value={addForm.categoryId}
                onChange={e => setAddForm(f => ({ ...f, categoryId: e.target.value }))}
                style={{ ...modalInp, cursor: "pointer" }}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={modalLbl}>Base Price (your price) *</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6B7280" }}>$</span>
                <input
                  type="number"
                  value={addForm.price}
                  onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                  step="0.01"
                  min="0"
                  style={modalInp}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div style={{ marginBottom: 24, padding: "12px 16px", background: "rgba(255,107,53,0.08)", borderRadius: 10, border: "1px solid rgba(255,107,53,0.2)" }}>
              <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>VoceEats Price (auto)</div>
              <div style={{ color: "#FF6B35", fontWeight: 800, fontSize: 20 }}>
                ${addVoiceeatsPrice.toFixed(2)}
              </div>
              <div style={{ color: "#6B7280", fontSize: 11, marginTop: 4 }}>Base price × 1.15 (15% platform fee included)</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={addItem}
                disabled={adding || !addForm.name.trim() || !addForm.categoryId}
                style={{ ...S.btn("#00C896"), flex: 1, opacity: adding ? 0.7 : 1 }}
              >
                {adding ? "Adding..." : "Add Item"}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={adding}
                style={{ ...S.btn("#EF4444", true), flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 24,
          }}
          onClick={() => !deletingId && setDeleteConfirmId(null)}
        >
          <div
            style={{ ...S.card, padding: 28, width: "100%", maxWidth: 400, background: "#12121a" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Delete Menu Item?</h3>
            <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              This will permanently remove{" "}
              <strong style={{ color: "#F9FAFB" }}>
                {items.find(i => i.id === deleteConfirmId)?.name || "this item"}
              </strong>{" "}
              from your menu and sync changes to Voice AI.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => deleteItem(deleteConfirmId)}
                disabled={!!deletingId}
                style={{ ...S.btn("#EF4444"), flex: 1, opacity: deletingId ? 0.7 : 1 }}
              >
                {deletingId ? "Deleting..." : "Yes, Delete"}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={!!deletingId}
                style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
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
    try {
      await fetch("/api/menu/sync-retell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
    } catch (e) {
      console.error("Retell sync after hours save failed:", e);
    }
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

function PaymentQRTab({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  return (
    <div>
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
          📱 Payment QR Code
        </h3>
        <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          Display this QR code at your counter so customers can scan and pay at payfood.us.
        </p>
        <PaymentQrSection
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          compact
        />
      </div>

      <div
        style={{
          background: "rgba(255,107,53,0.06)",
          border: "1px solid rgba(255,107,53,0.2)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h3 style={{ color: "#FF6B35", fontWeight: 800, fontSize: 16, marginBottom: 16 }}>
          Staff Instructions
        </h3>
        <p style={{ color: "#D1D5DB", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          When a customer arrives without paying:
        </p>
        <ol style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
          <li>Find their order in the Orders tab</li>
          <li>Tell them their 4-digit code</li>
          <li>Point them to the QR code to scan</li>
        </ol>
      </div>
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

  const [printerId, setPrinterId] = useState<string | null>(null);
  const [printerIp, setPrinterIp] = useState("");
  const [printerPort, setPrinterPort] = useState(8008);
  const [printerType, setPrinterType] = useState<"epson" | "star">("epson");
  const [autoDetect, setAutoDetect] = useState(true);
  const [savingPrinter, setSavingPrinter] = useState(false);
  const [printerMsg, setPrinterMsg] = useState("");

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

  useEffect(() => {
    let cancelled = false;
    const loadPrinter = async () => {
      const key = `voceeats_auto_detect_printer_${restaurant.id}`;
      const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      if (!cancelled) setAutoDetect(raw === null ? true : raw === "1");

      const { data } = await supabase
        .from("printers")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_default", true)
        .limit(1);
      if (cancelled) return;
      const p = data?.[0];
      if (p) {
        setPrinterId(p.id);
        setPrinterIp(p.ip_address || "");
        const pt = p.port ?? (p.type === "star" ? 9100 : 8008);
        setPrinterPort(Number(pt));
        setPrinterType(p.type === "star" ? "star" : "epson");
      } else {
        setPrinterId(null);
        setPrinterIp("");
        setPrinterPort(8008);
        setPrinterType("epson");
      }
    };
    loadPrinter();
    return () => { cancelled = true; };
  }, [restaurant.id]);

  const setAutoDetectPersist = (v: boolean) => {
    setAutoDetect(v);
    try {
      localStorage.setItem(`voceeats_auto_detect_printer_${restaurant.id}`, v ? "1" : "0");
    } catch { /* ignore */ }
  };
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

  const savePrinter = async () => {
    setSavingPrinter(true);
    setPrinterMsg("");
    await supabase.from("printers").update({ is_default: false }).eq("restaurant_id", restaurant.id);
    const portNum = Number(printerPort);
    const port = Number.isFinite(portNum) ? portNum : (printerType === "star" ? 9100 : 8008);
    const ip = printerIp.trim() || null;
    const base = {
      name: "Receipt printer",
      type: printerType,
      ip_address: ip,
      port,
      is_default: true,
      is_online: true,
    };
    if (printerId) {
      const { error } = await supabase.from("printers").update(base).eq("id", printerId);
      setPrinterMsg(error ? error.message : "✅ Printer saved");
    } else {
      const { data, error } = await supabase
        .from("printers")
        .insert({ restaurant_id: restaurant.id, ...base })
        .select("id")
        .single();
      if (error) setPrinterMsg(error.message);
      else {
        if (data?.id) setPrinterId(data.id);
        setPrinterMsg("✅ Printer saved");
      }
    }
    setSavingPrinter(false);
    setTimeout(() => setPrinterMsg(""), 5000);
  };

  const testPrint = async () => {
    setPrinterMsg("");
    const sample: PrintOrder = {
      order_number: "TEST-PRINT",
      customer_name: "Test Customer",
      items: [{ name: "Sample receipt line", qty: 1, price: 10 }],
      subtotal: 10,
      tax: 0.6,
      total: 10.6,
      platform_fee: 1.5,
      restaurant_payout: 8.5,
      payment_method: "sms_link",
      restaurant_name: restaurant.name || "Restaurant",
      restaurant_address: restaurant.address,
      restaurant_phone: restaurant.phone,
      created_at: new Date().toISOString(),
    };
    const savedPrinters =
      !autoDetect && printerIp.trim()
        ? [{ type: printerType, ip_address: printerIp.trim(), port: Number(printerPort) || (printerType === "star" ? 9100 : 8008) }]
        : [];
    try {
      const { method } = await detectAndPrint(sample, savedPrinters);
      setPrinterMsg(`Test sent (${method})`);
      setTimeout(() => setPrinterMsg(""), 4000);
    } catch (e: any) {
      setPrinterMsg(e?.message || "Print failed");
    }
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

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <h3 style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 16, marginBottom: 20 }}>🖨️ Printer Settings</h3>
        {printerMsg && (
          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 16, color: "#D1D5DB", fontSize: 13 }}>
            {printerMsg}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <span style={{ color: "#9CA3AF", fontSize: 13, fontWeight: 600 }}>Auto-detect</span>
          <button
            type="button"
            onClick={() => setAutoDetectPersist(!autoDetect)}
            aria-pressed={autoDetect}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              background: autoDetect ? "#00C896" : "#374151",
              position: "relative",
              transition: "background 0.3s",
              flexShrink: 0,
              padding: 0,
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: autoDetect ? 23 : 3, transition: "left 0.3s", display: "block" }} />
          </button>
          <span style={{ color: autoDetect ? "#00C896" : "#6B7280", fontSize: 13, fontWeight: 700 }}>{autoDetect ? "ON" : "OFF"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Network Printer IP</label>
            <input value={printerIp} onChange={e => setPrinterIp(e.target.value)} style={inp} placeholder="192.168.1.100" />
          </div>
          <div>
            <label style={lbl}>Port</label>
            <input
              type="number"
              value={printerPort}
              onChange={e => setPrinterPort(Number.isFinite(parseInt(e.target.value, 10)) ? parseInt(e.target.value, 10) : 8008)}
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select
              value={printerType}
              onChange={e => setPrinterType(e.target.value as "epson" | "star")}
              style={{ ...inp, cursor: "pointer" }}
            >
              <option value="epson">Epson</option>
              <option value="star">Star</option>
            </select>
          </div>
        </div>
        <div style={{ color: "#4B5563", fontSize: 11, marginTop: 12, lineHeight: 1.45 }}>
          {autoDetect
            ? "Test print probes common LAN IPs, then opens browser print. Turn Auto-detect off to print via the IP below first."
            : "Test print uses this printer first. Save Printer stores it as the default for this location."}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <button type="button" onClick={testPrint} style={{ ...S.btn("#6366F1"), flex: "1 1 140px" }}>
            Test Print
          </button>
          <button type="button" onClick={savePrinter} disabled={savingPrinter} style={{ ...S.btn("#FF6B35"), flex: "1 1 140px", opacity: savingPrinter ? 0.7 : 1, cursor: savingPrinter ? "wait" : "pointer" }}>
            {savingPrinter ? "Saving..." : "Save Printer"}
          </button>
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
  const [tab, setTab] = useState<"orders" | "menu" | "analytics" | "hours" | "payment-qr" | "settings">("orders");
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [scheduledOpenDisplay, setScheduledOpenDisplay] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const pendingRingRef = useRef(false);
  const baseTitleRef = useRef("DigiVoceEats");
  const bellRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleFlashRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleFlashOnRef = useRef(false);

  const [soundActive, setSoundActive] = useState(false);
  const [orderToasts, setOrderToasts] = useState<{ key: string; orderNumber: string }[]>([]);
  const [fullScreenAlert, setFullScreenAlert] = useState(false);

  const pending = useMemo(
    () => orders.filter((o) => isNewPaidOrder(o) || isAwaitingPayment(o)).length,
    [orders],
  );

  const awaitingPayment = useMemo(
    () => orders.filter((o) => isAwaitingPayment(o)).length,
    [orders],
  );

  useEffect(() => {
    baseTitleRef.current = typeof document !== "undefined" && document.title ? document.title : "DigiVoceEats";
  }, []);

  const ensureAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = await openAudioContext();
    } else if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const ringBell = useCallback(async () => {
    const ctx = await ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        pendingRingRef.current = true;
        return;
      }
    }
    if (ctx.state === "running") {
      playRestaurantBell(ctx);
      pendingRingRef.current = false;
    } else {
      pendingRingRef.current = true;
    }
  }, [ensureAudioCtx]);

  // Browser autoplay policy: unlock audio on first user interaction, then play any queued bell
  useEffect(() => {
    const unlockAudio = async () => {
      const ctx = await ensureAudioCtx();
      if (ctx?.state === "running") {
        if (pendingRingRef.current) {
          pendingRingRef.current = false;
          playRestaurantBell(ctx);
        }
      }
    };
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [ensureAudioCtx]);

  const addOrderAlert = useCallback(
    (orderId: string, orderNumber: string) => {
      const key = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setOrderToasts((prev) => [...prev, { key, orderNumber }]);
      window.setTimeout(() => {
        setOrderToasts((prev) => prev.filter((t) => t.key !== key));
      }, 10000);
      setSoundActive(true);
      setFullScreenAlert(true);
      void ringBell();
    },
    [ringBell],
  );

  const silenceAlerts = useCallback(() => {
    setSoundActive(false);
  }, []);

  useEffect(() => {
    if (!soundActive) {
      if (titleFlashRef.current) {
        clearInterval(titleFlashRef.current);
        titleFlashRef.current = null;
      }
      titleFlashOnRef.current = false;
      document.title = baseTitleRef.current;
      return;
    }
    const tick = () => {
      titleFlashOnRef.current = !titleFlashOnRef.current;
      document.title = titleFlashOnRef.current ? "🔔 New Order!" : baseTitleRef.current;
    };
    tick();
    titleFlashRef.current = setInterval(tick, 1000);
    return () => {
      if (titleFlashRef.current) {
        clearInterval(titleFlashRef.current);
        titleFlashRef.current = null;
      }
      document.title = baseTitleRef.current;
    };
  }, [soundActive]);

  useEffect(() => {
    if (pending === 0) {
      setSoundActive(false);
      if (bellRepeatRef.current) {
        clearInterval(bellRepeatRef.current);
        bellRepeatRef.current = null;
      }
    }
  }, [pending]);

  // Ring every 8s while unacknowledged paid pending orders exist
  useEffect(() => {
    if (pending === 0 || !soundActive) {
      if (bellRepeatRef.current) {
        clearInterval(bellRepeatRef.current);
        bellRepeatRef.current = null;
      }
      return;
    }

    void ringBell();
    if (bellRepeatRef.current) clearInterval(bellRepeatRef.current);
    bellRepeatRef.current = setInterval(() => {
      void ringBell();
    }, 8000);

    return () => {
      if (bellRepeatRef.current) {
        clearInterval(bellRepeatRef.current);
        bellRepeatRef.current = null;
      }
    };
  }, [soundActive, pending, ringBell]);

  useEffect(() => {
    return () => {
      if (bellRepeatRef.current) clearInterval(bellRepeatRef.current);
      if (titleFlashRef.current) clearInterval(titleFlashRef.current);
      document.title = baseTitleRef.current;
    };
  }, []);

  useEffect(() => {
    initDashboard();
  }, []);

  // Display live scheduled status for UI banner only — does NOT auto-write to database.
  // The is_open field is now purely manual (owner-controlled toggle) and persists until changed.
  useEffect(() => {
    if (!restaurant?.id) return;
    const restaurantId = restaurant.id;
    const checkScheduledStatus = async () => {
      try {
        const r = await fetch(`/api/restaurant/hours?restaurantId=${restaurantId}`);
        const data = await r.json();
        if (typeof data.scheduled_open === "boolean") {
          setScheduledOpenDisplay(data.scheduled_open);
        }
      } catch (e) {
        console.error("Scheduled hours check failed:", e);
      }
    };
    checkScheduledStatus();
    const interval = setInterval(checkScheduledStatus, 600_000);
    return () => clearInterval(interval);
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id) return;

    const restaurantId = restaurant.id;
    const channel = supabase
      .channel(`orders-realtime-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!isVisibleToRestaurant(row as { status?: string; payment_status?: string | null })) return;
          setOrders((prev) => {
            if (prev.some((o) => o.id === row.id)) return prev;
            return [row as any, ...prev];
          });
          if (isNewOrderAlert(row as { status?: string; payment_status?: string | null })) {
            addOrderAlert(String(row.id), String(row.order_number ?? row.id));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const old = payload.old as Record<string, unknown> | undefined;

          const newStatus = String(row.status ?? "");
          const newPayment = String(row.payment_status ?? "");
          const oldStatus = old?.status != null ? String(old.status) : "";
          const oldPayment = old?.payment_status != null ? String(old.payment_status) : "";

          setOrders((prev) => {
            const visible = isVisibleToRestaurant(row as { status?: string; payment_status?: string | null });
            const idx = prev.findIndex((o) => o.id === row.id);
            if (!visible) {
              if (idx >= 0) return prev.filter((o) => o.id !== row.id);
              return prev;
            }
            if (idx >= 0) return prev.map((o) => (o.id === row.id ? { ...o, ...row } : o));
            return [row as any, ...prev];
          });

          // Stripe webhook: pending_payment/unpaid → pending/paid
          const isPaidPending = newStatus === "pending" && newPayment === "paid";
          const wasPaidPending = oldStatus === "pending" && oldPayment === "paid";
          if (isPaidPending && !wasPaidPending) {
            addOrderAlert(String(row.id), String(row.order_number ?? row.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, addOrderAlert]);

  const initDashboard = async () => {
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUser(user);

    // Get restaurant for this user
    const { data: rest } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).single();

    if (!rest) {
      // For demo — use the Bread & Kabob restaurant
      const { data: demoRest } = await supabase.from("restaurants").select("*").eq("slug", "bread-kabob").single();
      setRestaurant(demoRest);
      setIsOpen(demoRest?.is_open !== false);
      loadOrders(demoRest?.id);
      return;
    }

    setRestaurant(rest);
    setIsOpen(rest.is_open !== false);
    loadOrders(rest.id);
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
    setOrders((data || []).filter(isVisibleToRestaurant));
    setLoading(false);
  };

  const updateOrder = (id: string, status: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status } : o
      )
    );
  };

  const toggleRestaurant = async () => {
    if (!restaurant) return;

    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    await supabase.from("restaurants").update({ is_open: newIsOpen }).eq("id", restaurant.id);
    try {
      await fetch("/api/menu/sync-retell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      });
    } catch (e) {
      console.error("Retell sync after toggle failed:", e);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const todayOrders = orders.filter(o => {
    const today = new Date().toDateString();
    return new Date(o.created_at).toDateString() === today;
  });
  const todayRevenue = todayOrders
    .filter(o => !["rejected", "cancelled"].includes(o.status))
    .reduce((s, o) => s + (o.restaurant_payout || 0), 0);
  const filtered =
    filter === "all"
      ? orders
      : filter === "awaiting"
        ? orders.filter(isAwaitingPayment)
        : filter === "pending"
          ? orders.filter(isNewPaidOrder)
          : orders.filter((o) => o.status === filter);

  const tabs = [
    { id: "orders", label: "Orders", icon: "📋", count: pending },
    { id: "menu", label: "Menu", icon: "🍽️" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "hours", label: "Hours", icon: "⏰" },
    { id: "payment-qr", label: "Payment QR", icon: "📱" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const statCards = [
    { icon: "🔔", label: "New Orders", value: pending, color: "#00C896", sub: pending > 0 ? "Accept or reject" : "All clear" },
    { icon: "⏳", label: "Awaiting Payment", value: awaitingPayment, color: "#F59E0B", sub: awaitingPayment > 0 ? "Payment codes out" : "None waiting" },
    { icon: "💰", label: "Today's Payout", value: `$${todayRevenue.toFixed(0)}`, color: "#00C896", sub: "Your 85%" },
    { icon: "🛍️", label: "Total Orders", value: orders.length, color: "#6366F1", sub: "All time" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", fontFamily: "'Segoe UI', sans-serif", color: "#F9FAFB" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes toastSlide { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
      `}</style>

      {fullScreenAlert && (
        <div
          onClick={() => {
            setFullScreenAlert(false);
            silenceAlerts();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes bounceIn { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
            @keyframes ringPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
          `}</style>
          <div style={{ animation: "bounceIn 0.5s ease both", textAlign: "center" }}>
            <div style={{ fontSize: 100, animation: "ringPulse 1s infinite", marginBottom: 24 }}>🔔</div>
            <div style={{
              fontSize: 64,
              fontWeight: 900,
              color: "#FF6B35",
              letterSpacing: -2,
              lineHeight: 1,
              marginBottom: 16,
              fontFamily: "sans-serif",
            }}>
              NEW ORDER
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 20, marginBottom: 48, fontFamily: "sans-serif" }}>
              Tap anywhere to view
            </div>
            <div style={{
              background: "rgba(255,107,53,0.15)",
              border: "2px solid rgba(255,107,53,0.4)",
              borderRadius: 20,
              padding: "20px 48px",
              color: "#FF6B35",
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "sans-serif",
            }}>
              👆 Tap to Accept or Reject
            </div>
          </div>
        </div>
      )}

      {orderToasts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 76,
            right: 20,
            zIndex: 250,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "flex-end",
            maxWidth: 360,
            pointerEvents: "none",
          }}
        >
          {orderToasts.map((t) => (
            <div
              key={t.key}
              style={{
                pointerEvents: "auto",
                animation: "toastSlide 0.35s ease-out",
                minWidth: 280,
                padding: "16px 20px",
                background: "rgba(26,26,46,0.97)",
                border: "1px solid rgba(255,107,53,0.5)",
                borderRadius: 14,
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ color: "#FF6B35", fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
                NEW ORDER RECEIVED
              </div>
              <div style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 17 }}>New Order Received</div>
              <div style={{ color: "#9CA3AF", fontSize: 14, marginTop: 8, fontWeight: 600 }}>{t.orderNumber}</div>
            </div>
          ))}
        </div>
      )}

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
          <BrandLogo />
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{restaurant?.name || "Loading..."}</div>
            <div style={{ color: "#6B7280", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00C896", display: "inline-block", animation: "pulse 2s infinite" }} />
              Live · {restaurant?.address || "3407 Payne St, Falls Church, VA"} · Powered by Diginetplore
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
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
            {scheduledOpenDisplay !== null && scheduledOpenDisplay !== isOpen && (
              <div style={{
                fontSize: 12, color: "#F59E0B", marginTop: 4,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                ⚠️ Scheduled hours say {scheduledOpenDisplay ? "OPEN" : "CLOSED"} right now — you're manually set to {isOpen ? "OPEN" : "CLOSED"}.
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            style={{ ...S.btn("rgba(255,255,255,0.08)", true), color: "#9CA3AF", fontSize: 12, padding: "8px 16px" }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {pending > 0 && (
        <div
          role="alert"
          style={{
            background: "linear-gradient(90deg, rgba(255,107,53,0.18), rgba(255,107,53,0.08))",
            borderBottom: "1px solid rgba(255,107,53,0.35)",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22, animation: soundActive ? "pulse 1.5s infinite" : "none" }}>🔔</span>
            <div>
              <div style={{ color: "#FF6B35", fontWeight: 800, fontSize: 15 }}>
                New Orders Pending — {pending} {pending === 1 ? "order needs" : "orders need"} attention
              </div>
              <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
                Accept or reject orders below. Use Silence Alerts to stop the sound without dismissing orders.
              </div>
            </div>
          </div>
          {soundActive && (
            <button
              type="button"
              onClick={silenceAlerts}
              style={{ ...S.btn("#374151"), padding: "10px 20px", fontSize: 13, border: "1px solid rgba(255,255,255,0.15)" }}
            >
              🔕 Silence Alerts
            </button>
          )}
        </div>
      )}

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
              {[
                { id: "all", label: "all", count: orders.length },
                { id: "awaiting", label: "awaiting payment", count: awaitingPayment },
                { id: "pending", label: "new orders", count: pending },
                { id: "accepted", label: "preparing", count: orders.filter((o) => o.status === "accepted").length },
                { id: "completed", label: "completed", count: orders.filter((o) => o.status === "completed").length },
                { id: "rejected", label: "rejected", count: orders.filter((o) => o.status === "rejected").length },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{ padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, textTransform: "capitalize", background: filter === f.id ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.04)", color: filter === f.id ? "#FF6B35" : "#6B7280", outline: filter === f.id ? "1px solid rgba(255,107,53,0.3)" : "1px solid rgba(255,255,255,0.06)", fontFamily: "sans-serif" }}
                >
                  {f.label} ({f.count})
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
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 100px",
                    gap: 12,
                    padding: "8px 22px 12px",
                    color: "#6B7280",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  <span>Order</span>
                  <span>Code</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                </div>
                {filtered.map(order => (
                  <OrderCard key={order.id} order={order} onUpdate={updateOrder} />
                ))}
              </>
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

        {tab === "payment-qr" && restaurant && (
          <PaymentQRTab restaurantId={restaurant.id} restaurantName={restaurant.name} />
        )}

        {tab === "settings" && restaurant && (
          <SettingsTab restaurant={restaurant} onUpdate={(updated: any) => setRestaurant(updated)} />
        )}

        {/* Analytics Tab */}
        {tab === "analytics" && restaurant && (
          <AnalyticsTab restaurantId={restaurant.id} />
        )}
      </main>
    </div>
  );
}
