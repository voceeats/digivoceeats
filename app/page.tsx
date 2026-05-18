import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#F9FAFB",
      }}
    >
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Nav */}
      <nav
        style={{
          height: 70,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(10,10,15,0.95)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎙️</span>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/login"
            style={{ color: "#9CA3AF", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
          >
            Restaurant Login
          </Link>
          <Link
            href="#signup"
            style={{
              background: "linear-gradient(135deg,#FF6B35,#FF8C5A)",
              color: "#fff",
              textDecoration: "none",
              padding: "10px 24px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "100px 40px 80px", textAlign: "center", maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,107,53,0.1)",
            border: "1px solid rgba(255,107,53,0.3)",
            borderRadius: 20,
            padding: "6px 16px",
            fontSize: 13,
            color: "#FF6B35",
            fontWeight: 600,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#FF6B35",
              display: "inline-block",
              animation: "pulse 1.5s infinite",
            }}
          />
          Now serving restaurants in Northern Virginia
        </div>

        <h1 style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.1, marginBottom: 24 }}>
          Your Restaurant Answers
          <br />
          <span
            style={{
              background: "linear-gradient(135deg,#FF6B35,#FF9A6C)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Phone Orders 24/7
          </span>
          <br />
          With AI
        </h1>

        <p
          style={{
            fontSize: 20,
            color: "#9CA3AF",
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 600,
            margin: "0 auto 40px",
          }}
        >
          VoceEats AI answers your restaurant&apos;s phone, takes orders naturally, sends payment links by text,
          and notifies you instantly. No staff needed. No missed calls. Ever.
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="#signup"
            style={{
              background: "linear-gradient(135deg,#FF6B35,#FF8C5A)",
              color: "#fff",
              textDecoration: "none",
              padding: "16px 40px",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            Start Free Trial →
          </Link>
          <Link
            href="#how-it-works"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "#F9FAFB",
              textDecoration: "none",
              padding: "16px 40px",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            See How It Works
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 40, justifyContent: "center", marginTop: 60, flexWrap: "wrap" }}>
          {[
            { value: "24/7", label: "Always Available" },
            { value: "< 2s", label: "Answer Time" },
            { value: "15%", label: "Platform Fee Only" },
            { value: "Zero", label: "Monthly Fee" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  background: "linear-gradient(135deg,#FF6B35,#FF9A6C)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {stat.value}
              </div>
              <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        style={{
          padding: "80px 40px",
          background: "rgba(255,255,255,0.02)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, textAlign: "center", marginBottom: 16 }}>
            How It Works
          </h2>
          <p style={{ color: "#6B7280", textAlign: "center", fontSize: 16, marginBottom: 60 }}>
            Your customers call, AI handles everything
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              {
                step: "01",
                icon: "📞",
                title: "Customer Calls",
                desc: "Customer calls your restaurant's dedicated VoceEats number. AI answers instantly — no hold music, no missed calls.",
                color: "#FF6B35",
              },
              {
                step: "02",
                icon: "🎙️",
                title: "AI Takes Order",
                desc: "Our AI naturally takes the order, answers questions about the menu, confirms items and calculates the total.",
                color: "#6366F1",
              },
              {
                step: "03",
                icon: "💳",
                title: "Payment by Text",
                desc: "Customer gets a secure Stripe payment link by SMS. They pay with Apple Pay in seconds. You get notified instantly.",
                color: "#00C896",
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  padding: 32,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 16 }}>{item.icon}</div>
                <div
                  style={{
                    color: item.color,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  STEP {item.step}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{item.title}</h3>
                <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: 14 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: "80px 40px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, textAlign: "center", marginBottom: 16 }}>
            Why Restaurants Love VoceEats
          </h2>
          <p style={{ color: "#6B7280", textAlign: "center", fontSize: 16, marginBottom: 60 }}>
            Built for busy restaurant owners
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
            {[
              {
                icon: "🚫",
                title: "No Missed Calls",
                desc: "AI answers every call instantly, even during rush hour when your staff is busy cooking.",
              },
              {
                icon: "💰",
                title: "Only Pay When You Earn",
                desc: "No monthly fees. We only charge 15% on orders processed. Zero risk to get started.",
              },
              {
                icon: "📱",
                title: "Real-time Dashboard",
                desc: "See every order as it comes in. Accept, reject, or manage orders from any device.",
              },
              {
                icon: "🌍",
                title: "Multi-language Ready",
                desc: "AI handles different accents and can be configured for multiple languages.",
              },
              {
                icon: "⏰",
                title: "Smart Hours",
                desc: "Set your opening hours once. AI automatically stops taking orders when you close.",
              },
              {
                icon: "👤",
                title: "Customer Recognition",
                desc: "AI remembers returning customers by name — creating a personal touch every time.",
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                style={{
                  display: "flex",
                  gap: 20,
                  padding: 24,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16,
                }}
              >
                <span style={{ fontSize: 32, flexShrink: 0 }}>{benefit.icon}</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{benefit.title}</h3>
                  <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        style={{
          padding: "80px 40px",
          background: "rgba(255,255,255,0.02)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, marginBottom: 16 }}>Simple Pricing</h2>
          <p style={{ color: "#6B7280", fontSize: 16, marginBottom: 40 }}>No subscriptions. No hidden fees.</p>

          <div
            style={{
              background: "rgba(255,107,53,0.05)",
              border: "2px solid rgba(255,107,53,0.3)",
              borderRadius: 24,
              padding: 48,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 900,
                background: "linear-gradient(135deg,#FF6B35,#FF9A6C)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              15%
            </div>
            <div style={{ color: "#F9FAFB", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Per Order Only
            </div>
            <div style={{ color: "#6B7280", fontSize: 14, marginBottom: 32 }}>
              Only pay when you receive orders
            </div>

            {[
              "✅ Unlimited voice orders",
              "✅ Real-time dashboard",
              "✅ SMS payment links",
              "✅ Customer recognition",
              "✅ Menu management",
              "✅ Opening hours control",
              "✅ 24/7 AI answering",
              "✅ No setup fee",
            ].map((feature) => (
              <div key={feature} style={{ color: "#D1D5DB", fontSize: 14, marginBottom: 10, textAlign: "left" }}>
                {feature}
              </div>
            ))}

            <Link
              href="#signup"
              style={{
                display: "block",
                marginTop: 32,
                background: "linear-gradient(135deg,#FF6B35,#FF8C5A)",
                color: "#fff",
                textDecoration: "none",
                padding: "16px",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              Get Started Free →
            </Link>
          </div>
        </div>
      </section>

      {/* Sign Up Form */}
      <section id="signup" style={{ padding: "80px 40px" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, textAlign: "center", marginBottom: 16 }}>
            Get Started Today
          </h2>
          <p style={{ color: "#6B7280", textAlign: "center", fontSize: 16, marginBottom: 40 }}>
            We&apos;ll set up your AI ordering system within 24 hours
          </p>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: 40,
            }}
          >
            <SignupForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "40px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🎙️</span>
          <span
            style={{
              fontWeight: 900,
              fontSize: 16,
              background: "linear-gradient(135deg,#FF6B35,#FF9A6C)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Voce
          </span>
          <span style={{ fontWeight: 900, fontSize: 16 }}>Eats</span>
          <span style={{ color: "#4B5563", fontSize: 13, marginLeft: 8 }}>by Diginetplore</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/privacy-policy" style={{ color: "#6B7280", textDecoration: "none", fontSize: 13 }}>
            Privacy Policy
          </Link>
          <Link href="/terms" style={{ color: "#6B7280", textDecoration: "none", fontSize: 13 }}>
            Terms of Service
          </Link>
          <a href="mailto:hello@digivoceeats.com" style={{ color: "#6B7280", textDecoration: "none", fontSize: 13 }}>
            Contact
          </a>
        </div>
        <div style={{ color: "#4B5563", fontSize: 13 }}>© 2026 Diginetplore. All rights reserved.</div>
      </footer>
    </div>
  );
}
