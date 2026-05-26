import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function SmsConsentPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111111" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "Georgia, serif" }}>
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ color: "#FF6B35", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            ← Back to DigiVoceEats
          </a>
        </div>

        <div style={{ marginBottom: 32 }}>
          <BrandLogo priority variant="onLight" />
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 24, color: "#111" }}>
          SMS Consent &amp; Opt-In
        </h1>

        <p style={{ color: "#444", lineHeight: 1.8, fontSize: 15, marginBottom: 32 }}>
          When you place an order through DigiVoceEats, you will receive a one-time SMS payment link.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#111" }}>
          Payment Page Opt-In Sample
        </h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
          Before completing payment, customers must check the SMS consent box on the payment page:
        </p>

        <div
          style={{
            background: "#0A0A0F",
            borderRadius: 16,
            padding: 24,
            marginBottom: 32,
            fontFamily: "'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
              Sample Payment Screen
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  flexShrink: 0,
                  border: "2px solid #6B7280",
                  borderRadius: 3,
                  background: "transparent",
                }}
              />
              <span style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 1.5 }}>
                I agree to receive a one-time SMS payment link from DigiVoceEats. Message and data rates may apply. Reply STOP to opt out.
              </span>
            </div>
            <div
              style={{
                width: "100%",
                background: "#374151",
                color: "#fff",
                borderRadius: 12,
                padding: "14px 18px",
                fontSize: 15,
                fontWeight: 700,
                textAlign: "center",
                opacity: 0.7,
              }}
            >
              Pay Securely →
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#111" }}>Related Policies</h2>
          <p style={{ color: "#444", lineHeight: 1.8, fontSize: 15 }}>
            Review our{" "}
            <Link href="/privacy-policy" style={{ color: "#FF6B35", textDecoration: "underline" }}>
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" style={{ color: "#FF6B35", textDecoration: "underline" }}>
              Terms of Service
            </Link>{" "}
            for full details on SMS messaging, data use, and opt-out instructions.
          </p>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: "1px solid #eee",
            color: "#999",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <p style={{ marginBottom: 12 }}>
            This page is provided for SMS compliance verification purposes.
          </p>
          <p>© 2026 Diginetplore LLC. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
