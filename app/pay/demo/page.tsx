"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const ITEMS = [
  { name: "Chicken Kabob", qty: 2, lineTotal: 22.88 },
  { name: "Hummus", qty: 1, lineTotal: 5.62 },
];

const SUBTOTAL = 28.5;
const TAX = 1.71;
const TOTAL = 30.21;

export default function PayDemoPage() {
  const [smsConsent, setSmsConsent] = useState(false);

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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <BrandLogo priority />
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
            <div style={{ fontSize: 20, fontWeight: 800 }}>Sample Order</div>
            <div style={{ color: "#F9FAFB", fontSize: 14, fontWeight: 600, marginTop: 6 }}>
              Bread &amp; Kabob
            </div>
            <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
              ORD-DEMO · Expires in 30 minutes
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
            {ITEMS.map((item) => (
              <div
                key={item.name}
                style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}
              >
                <span style={{ color: "#D1D5DB", fontSize: 14 }}>
                  <span style={{ color: "#FF6B35", fontWeight: 700 }}>{item.qty}×</span> {item.name}
                </span>
                <span style={{ color: "#F9FAFB", fontWeight: 600, fontSize: 14 }}>
                  ${item.lineTotal.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              ["Subtotal", `$${SUBTOTAL.toFixed(2)}`, "#9CA3AF"],
              ["Tax (6%)", `$${TAX.toFixed(2)}`, "#9CA3AF"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color, fontSize: 13 }}>{label}</span>
                <span style={{ color, fontSize: 13 }}>{val}</span>
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
              <span style={{ color: "#F9FAFB", fontWeight: 900, fontSize: 24 }}>${TOTAL.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ padding: "24px 28px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 16,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: "#FF6B35" }}
              />
              <span style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 1.5 }}>
                I agree to receive a one-time SMS payment link from DigiVoceEats. Message and data rates may apply. Reply STOP to opt out.
              </span>
            </label>

            <button
              type="button"
              disabled={!smsConsent}
              style={{
                width: "100%",
                background: !smsConsent ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "18px",
                fontSize: 17,
                fontWeight: 800,
                cursor: !smsConsent ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                marginBottom: 12,
                opacity: !smsConsent ? 0.7 : 1,
              }}
            >
              Pay ${TOTAL.toFixed(2)} Securely →
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

            <div style={{ textAlign: "center", color: "#4B5563", fontSize: 12, marginBottom: 16 }}>
              🔒 Secured by Stripe · Link expires in 30 minutes
            </div>

            <div style={{ textAlign: "center", fontSize: 12, lineHeight: 1.6 }}>
              <Link href="/privacy-policy" style={{ color: "#9CA3AF", textDecoration: "underline" }}>
                Privacy Policy
              </Link>
              <span style={{ color: "#4B5563", margin: "0 8px" }}>·</span>
              <Link href="/terms" style={{ color: "#9CA3AF", textDecoration: "underline" }}>
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, color: "#6B7280", fontSize: 11, lineHeight: 1.5 }}>
          This is a demo page for compliance verification
        </div>

        <div style={{ textAlign: "center", marginTop: 16, color: "#4B5563", fontSize: 12 }}>
          Powered by <span style={{ color: "#FF6B35", fontWeight: 700 }}>DigiVoceEats</span> by Diginetplore
        </div>
      </div>
    </div>
  );
}
