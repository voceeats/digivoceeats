"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function SmsConsentPage() {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !consent) return;
    setSubmitting(true);
    // Standalone opt-in — no payment tied to this step
    await new Promise((r) => setTimeout(r, 400));
    setSubmitted(true);
    setSubmitting(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    fontSize: 16,
    border: "1px solid #E5E7EB",
    borderRadius: 10,
    outline: "none",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxSizing: "border-box" as const,
    color: "#111",
    background: "#FAFAFA",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111111" }}>
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "48px 24px 64px",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <Link href="/" style={{ color: "#FF6B35", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            ← Back to DigiVoceEats
          </Link>
        </div>

        <div style={{ marginBottom: 32 }}>
          <BrandLogo priority variant="onLight" />
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, color: "#111", lineHeight: 1.25 }}>
          Sign Up for SMS Order Updates
        </h1>

        <p style={{ color: "#555", lineHeight: 1.7, fontSize: 15, marginBottom: 36 }}>
          Enter your phone number below to receive SMS payment links when you place orders at our partner
          restaurants. This is completely optional — you can still place orders without signing up.
        </p>

        {submitted ? (
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 14,
              padding: "28px 24px",
              marginBottom: 40,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
            <p style={{ color: "#166534", fontSize: 17, fontWeight: 700, lineHeight: 1.5, margin: 0 }}>
              You&apos;re signed up! You&apos;ll receive SMS payment links for your orders.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#FAFAFA",
              border: "1px solid #E5E7EB",
              borderRadius: 16,
              padding: "28px 24px",
              marginBottom: 40,
            }}
          >
            <label
              htmlFor="phone"
              style={{
                display: "block",
                color: "#374151",
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(703) 555-1234"
              required
              autoComplete="tel"
              style={{ ...inputStyle, marginBottom: 20 }}
            />

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 24,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18, accentColor: "#FF6B35" }}
              />
              <span style={{ color: "#555", fontSize: 13, lineHeight: 1.6 }}>
                I agree to receive SMS order payment links from DigiVoceEats. Message frequency: one per order.
                Message and data rates may apply. Reply STOP to opt out.
              </span>
            </label>

            <button
              type="submit"
              disabled={!phone.trim() || !consent || submitting}
              style={{
                width: "100%",
                background: !phone.trim() || !consent || submitting ? "#D1D5DB" : "#FF6B35",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "16px 20px",
                fontSize: 16,
                fontWeight: 700,
                cursor: !phone.trim() || !consent || submitting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {submitting ? "Signing up..." : "Sign Up for SMS Updates"}
            </button>
          </form>
        )}

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#111" }}>What to expect</h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              color: "#555",
              fontSize: 15,
              lineHeight: 1.9,
            }}
          >
            <li>One SMS per order only</li>
            <li>Secure payment links</li>
            <li>Reply STOP anytime to opt out</li>
            <li>Reply HELP for assistance</li>
          </ul>
        </section>

        <div
          style={{
            paddingTop: 24,
            borderTop: "1px solid #E5E7EB",
            fontSize: 14,
            color: "#666",
            lineHeight: 1.7,
          }}
        >
          <Link href="/privacy-policy" style={{ color: "#FF6B35", textDecoration: "underline" }}>
            Privacy Policy
          </Link>
          <span style={{ margin: "0 10px", color: "#D1D5DB" }}>|</span>
          <Link href="/terms" style={{ color: "#FF6B35", textDecoration: "underline" }}>
            Terms of Service
          </Link>
        </div>

        <p style={{ marginTop: 32, color: "#9CA3AF", fontSize: 12, lineHeight: 1.5 }}>
          © 2026 Diginetplore LLC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
