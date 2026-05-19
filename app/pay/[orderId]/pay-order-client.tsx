"use client";

import { useEffect, useState, useCallback } from "react";
import { BrandLogo } from "@/components/brand-logo";

type OrderRow = {
  id: string;
  restaurant_id: string;
  order_number: string;
  customer_name?: string | null;
  items?: Array<{ name?: string; price?: number | string; qty?: number | string }>;
  subtotal?: number | string;
  tax?: number | string;
  total?: number | string;
  payment_status?: string | null;
};

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PayOrderClient({
  orderId,
  cancelled,
}: {
  orderId: string;
  cancelled: boolean;
}) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async () => {
    try {
      const r = await fetch(`/api/orders/${orderId}`);
      const data = await r.json();
      if (!r.ok || data.error) {
        setError(data.error || "Order not found");
        setOrder(null);
        return;
      }
      setOrder(data);
    } catch {
      setError("Order not found");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      const r = await fetch("/api/stripe/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await r.json();

      if (data.already_paid) {
        setError("This order has already been paid!");
        setPaying(false);
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      setError(data.error || "Payment failed. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setPaying(false);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0A0F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ color: "#6B7280", fontSize: 16 }}>Loading your order...</div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0A0F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ color: "#EF4444", fontSize: 16 }}>{error}</div>
      </div>
    );
  }

  const subtotal = num(order?.subtotal);
  const tax = num(order?.tax);
  const total = num(order?.total);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎙️</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 0 }}>
            <span
              style={{
                fontWeight: 900,
                fontSize: 24,
                background: "linear-gradient(135deg,#FF6B35,#FF9A6C)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Voce
            </span>
            <span style={{ fontWeight: 900, fontSize: 24 }}>Eats</span>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "24px 28px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,107,53,0.05)",
            }}
          >
            <div
              style={{
                color: "#FF6B35",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 6,
              }}
            >
              Voice AI Order
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {order?.customer_name ? `Hi ${order.customer_name}! ` : ""}Your order is ready to pay
            </div>
            <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
              {order?.order_number} · Expires in 30 minutes
            </div>
          </div>

          <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div
              style={{
                color: "#9CA3AF",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 14,
              }}
            >
              Items Ordered
            </div>
            {Array.isArray(order?.items) &&
              order.items.map((item, i) => {
                const qty = Math.max(1, Math.round(num(item.qty)) || 1);
                const price = num(item.price);
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ color: "#D1D5DB", fontSize: 14 }}>
                      <span style={{ color: "#FF6B35", fontWeight: 700 }}>{qty}×</span> {item.name}
                    </span>
                    <span style={{ color: "#F9FAFB", fontWeight: 600, fontSize: 14 }}>
                      ${(price * qty).toFixed(2)}
                    </span>
                  </div>
                );
              })}
          </div>

          <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              ["Subtotal", `$${subtotal.toFixed(2)}`, "#9CA3AF"],
              ["Tax (6%)", `$${tax.toFixed(2)}`, "#9CA3AF"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: color, fontSize: 13 }}>{label}</span>
                <span style={{ color: color, fontSize: 13 }}>{val}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 18 }}>Total</span>
              <span style={{ color: "#F9FAFB", fontWeight: 900, fontSize: 24 }}>${total.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ padding: "24px 28px" }}>
            {cancelled && (
              <div
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#F59E0B",
                  fontSize: 13,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Payment was cancelled. You can try again below.
              </div>
            )}

            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#EF4444",
                  fontSize: 13,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {order?.payment_status === "paid" || order?.payment_status === "cash_collected" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ color: "#00C896", fontWeight: 800, fontSize: 20 }}>Already Paid!</div>
                <div style={{ color: "#6B7280", fontSize: 14, marginTop: 8 }}>Your order is being prepared.</div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  style={{
                    width: "100%",
                    background: paying ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 14,
                    padding: "18px",
                    fontSize: 17,
                    fontWeight: 800,
                    cursor: paying ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    marginBottom: 12,
                  }}
                >
                  {paying ? "Redirecting to payment..." : `Pay $${total.toFixed(2)} Securely →`}
                </button>

                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
                  {["apple-pay", "google-pay", "visa", "mastercard"].map((method) => (
                    <div
                      key={method}
                      style={{ color: "#4B5563", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}
                    >
                      {method === "apple-pay"
                        ? "🍎 Pay"
                        : method === "google-pay"
                          ? "G Pay"
                          : method.charAt(0).toUpperCase() + method.slice(1)}
                    </div>
                  ))}
                </div>

                <div style={{ textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  🔒 Secured by Stripe · Link expires in 30 minutes
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, color: "#4B5563", fontSize: 12 }}>
          Powered by <span style={{ color: "#FF6B35", fontWeight: 700 }}>DigiVoceEats</span> by Diginetplore
        </div>
      </div>
    </div>
  );
}
