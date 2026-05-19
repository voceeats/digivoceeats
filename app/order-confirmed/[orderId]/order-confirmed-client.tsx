"use client";

import { useEffect, useState, useCallback } from "react";

type OrderRow = {
  order_number?: string;
  total?: number | string;
};

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function OrderConfirmedClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderRow | null>(null);

  const load = useCallback(() => {
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.error) setOrder(data);
      })
      .catch(() => setOrder(null));
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = order ? num(order.total) : 0;

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
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 80, marginBottom: 24, animation: "bounce 1s ease" }}>✅</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>Payment Confirmed!</h1>
        <p style={{ color: "#9CA3AF", fontSize: 16, marginBottom: 32 }}>
          Your order is being prepared and will be ready in approximately 25 minutes.
        </p>

        {order && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: 28,
              marginBottom: 24,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: "#6B7280" }}>Order Number</span>
              <span style={{ fontWeight: 700 }}>{order.order_number}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: "#6B7280" }}>Amount Paid</span>
              <span style={{ fontWeight: 700, color: "#00C896" }}>${total.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6B7280" }}>Status</span>
              <span style={{ fontWeight: 700, color: "#00C896" }}>✅ Paid</span>
            </div>
          </div>
        )}

        <p style={{ color: "#6B7280", fontSize: 14 }}>
          A confirmation SMS has been sent to your phone. You will also receive an email receipt from Stripe.
        </p>

        <div style={{ marginTop: 32, color: "#4B5563", fontSize: 12 }}>
          Powered by <span style={{ color: "#FF6B35", fontWeight: 700 }}>DigiVoceEats</span> by Diginetplore
        </div>
      </div>
    </div>
  );
}
