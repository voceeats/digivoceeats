"use client";

import { useCallback, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

type OrderResult = {
  id: string;
  order_number: string;
  restaurant_name: string;
  items: Array<{ name: string; price: number; qty: number }>;
  subtotal: number;
  tax: number;
  total: number;
  payment_status: string;
};

function CodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (index: number, char: string) => {
    const next = [...value];
    next[index] = char;
    onChange(next);
    if (char && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleChange = (index: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    setDigit(index, char);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (!pasted) return;
    const next = ["", "", "", ""];
    pasted.split("").forEach((c, i) => {
      next[i] = c;
    });
    onChange(next);
    refs.current[Math.min(pasted.length, 3)]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          aria-label={`Order code digit ${i + 1} of 4`}
          style={{
            width: 56,
            height: 64,
            textAlign: "center",
            fontSize: 28,
            fontWeight: 800,
            border: "2px solid rgba(255,107,53,0.35)",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            color: "#F9FAFB",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      ))}
    </div>
  );
}

export default function PayCodeClient({ isSuccess }: { isSuccess: boolean }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);

  const code = digits.join("");

  const resetLookup = useCallback(() => {
    setOrder(null);
    setError("");
  }, []);

  const findOrder = async () => {
    if (code.length !== 4) {
      setError("Please enter all 4 digits of your code.");
      return;
    }
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const r = await fetch("/api/orders/lookup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        setError("Order not found. Please check your code and try again.");
        return;
      }
      if (data.payment_status === "paid" || data.payment_status === "cash_collected") {
        setError("This order has already been paid.");
        setOrder(data);
        return;
      }
      setOrder(data);
    } catch {
      setError("Order not found. Please check your code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!order) return;
    setPaying(true);
    setError("");
    try {
      const r = await fetch("/api/stripe/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, successReturn: "pay" }),
      });
      const data = await r.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      if (data.already_paid) {
        setError("This order has already been paid.");
        return;
      }
      setError(data.error || "Unable to start payment. Please try again.");
    } catch {
      setError("Unable to start payment. Please try again.");
    }
    setPaying(false);
  };

  if (isSuccess) {
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
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <BrandLogo priority width={200} height={80} />
          </div>
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>
            Payment successful!
          </h1>
          <p style={{ color: "#9CA3AF", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
            Your order will be ready in 25 minutes.
          </p>
          <a
            href="/pay"
            style={{
              display: "inline-block",
              color: "#FF6B35",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            ← Back to order lookup
          </a>
        </div>
      </div>
    );
  }

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
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <BrandLogo priority width={200} height={80} />
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Complete Your Order</h1>
          <p style={{ color: "#9CA3AF", fontSize: 15, lineHeight: 1.5 }}>
            Enter the 4-digit code you received during your call
          </p>
        </div>

        {!order ? (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: "28px 20px",
            }}
          >
            <CodeInput
              value={digits}
              onChange={(d) => {
                setDigits(d);
                setError("");
              }}
              disabled={loading}
            />

            {error && (
              <p
                role="alert"
                style={{
                  color: "#EF4444",
                  fontSize: 14,
                  textAlign: "center",
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={findOrder}
              disabled={loading || code.length !== 4}
              style={{
                width: "100%",
                background: loading || code.length !== 4 ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "16px",
                fontSize: 16,
                fontWeight: 800,
                cursor: loading || code.length !== 4 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Finding order..." : "Find My Order"}
            </button>
          </div>
        ) : (
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
                padding: "22px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,107,53,0.05)",
              }}
            >
              <div
                style={{
                  color: "#FF6B35",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 6,
                }}
              >
                Order Found
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{order.restaurant_name}</div>
              <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>{order.order_number}</div>
            </div>

            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {order.items.map((item) => (
                <div
                  key={`${item.name}-${item.qty}`}
                  style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}
                >
                  <span style={{ color: "#D1D5DB", fontSize: 14 }}>
                    <span style={{ color: "#FF6B35", fontWeight: 700 }}>{item.qty}×</span> {item.name}
                  </span>
                  <span style={{ color: "#F9FAFB", fontWeight: 600, fontSize: 14 }}>
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                ["Subtotal", order.subtotal],
                ["Tax (6%)", order.tax],
              ].map(([label, val]) => (
                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#9CA3AF", fontSize: 13 }}>{label}</span>
                  <span style={{ color: "#9CA3AF", fontSize: 13 }}>${Number(val).toFixed(2)}</span>
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
                <span style={{ color: "#F9FAFB", fontWeight: 900, fontSize: 22 }}>
                  ${order.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ padding: "24px" }}>
              {error && (
                <p role="alert" style={{ color: "#EF4444", fontSize: 14, textAlign: "center", marginBottom: 16 }}>
                  {error}
                </p>
              )}

              {order.payment_status !== "paid" && order.payment_status !== "cash_collected" ? (
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
                  {paying ? "Redirecting..." : "Pay Now"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  resetLookup();
                  setDigits(["", "", "", ""]);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "#9CA3AF",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: "14px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Try a different code
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 24, color: "#4B5563", fontSize: 12 }}>
          🔒 Secured by Stripe
        </p>
      </div>
    </div>
  );
}
