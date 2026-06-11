// PATH: app/sms-consent/page.tsx

export default function SmsConsentPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf7f2",
      fontFamily: "Georgia, serif",
      color: "#2c1a0e",
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media (max-width: 600px) {
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{
        background: "linear-gradient(135deg, #1a0a00, #3d1f00)",
        padding: "24px 32px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "linear-gradient(135deg, #b5853a, #8a5e20)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>🎙️</div>
        <div>
          <div style={{ color: "#F9FAFB", fontWeight: 700, fontSize: 18, fontFamily: "Arial, sans-serif" }}>DigiVoceEats</div>
          <div style={{ color: "#b5853a", fontSize: 12, fontFamily: "Arial, sans-serif" }}>AI Voice Ordering Platform</div>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(181,133,58,0.12)",
            border: "1px solid rgba(181,133,58,0.3)",
            borderRadius: 20, padding: "6px 20px",
            color: "#b5853a", fontSize: 12, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase",
            fontFamily: "Arial, sans-serif", marginBottom: 20,
          }}>SMS Messaging Program</div>
          <h1 style={{
            fontSize: 36, fontWeight: 400, lineHeight: 1.2,
            marginBottom: 16, color: "#1a0a00",
          }}>
            SMS Consent & Opt-In Policy
          </h1>
          <p style={{ color: "#6b4c2a", fontSize: 16, lineHeight: 1.7, maxWidth: 580, margin: "0 auto" }}>
            This page describes how DigiVoceEats collects customer consent to send SMS messages and how customers can manage their preferences.
          </p>
        </div>

        {/* How Consent is Collected */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: 16, padding: "32px",
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 20, color: "#1a0a00", borderBottom: "2px solid #f0ede8", paddingBottom: 12 }}>
            📞 How Customers Opt In
          </h2>
          <p style={{ color: "#6b4c2a", fontSize: 15, lineHeight: 1.8, marginBottom: 20 }}>
            DigiVoceEats provides an AI-powered phone ordering service for restaurants. When a customer calls a restaurant&apos;s AI ordering line, the following opt-in process occurs:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                step: "1",
                title: "Customer Initiates Call",
                desc: "The customer voluntarily calls the restaurant's AI phone ordering line powered by DigiVoceEats. By calling, the customer initiates the ordering process."
              },
              {
                step: "2",
                title: "AI Informs Customer of SMS",
                desc: "During the call, the AI agent (Chloe) verbally informs the customer: \"You will receive an SMS with your 4-digit payment code to complete your order at payfood.us.\""
              },
              {
                step: "3",
                title: "Customer Confirms Phone Number",
                desc: "The AI reads back the customer's phone number and asks: \"I have your number as XXX-XXX-XXXX. Is that correct?\" The customer must verbally confirm their phone number before the order is submitted."
              },
              {
                step: "4",
                title: "Verbal Consent Obtained",
                desc: "By confirming their phone number and proceeding with the order, the customer provides express verbal consent to receive an SMS containing their payment code."
              },
              {
                step: "5",
                title: "SMS Sent",
                desc: "After order submission, one transactional SMS is sent containing the 4-digit payment code needed to complete payment at payfood.us."
              },
            ].map((item) => (
              <div key={item.step} style={{
                display: "flex", gap: 16, alignItems: "flex-start",
                padding: "16px", background: "#faf7f2",
                borderRadius: 12, border: "1px solid #ede8e0",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg, #b5853a, #8a5e20)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  fontFamily: "Arial, sans-serif", flexShrink: 0,
                }}>{item.step}</div>
                <div>
                  <div style={{ color: "#1a0a00", fontWeight: 700, fontSize: 14, fontFamily: "Arial, sans-serif", marginBottom: 4 }}>{item.title}</div>
                  <div style={{ color: "#6b4c2a", fontSize: 14, lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Program Details */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: 16, padding: "32px",
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 20, color: "#1a0a00", borderBottom: "2px solid #f0ede8", paddingBottom: 12 }}>
            📱 Message Program Details
          </h2>

          <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Program Name", value: "DigiVoceEats Order Notifications" },
              { label: "Message Type", value: "Transactional — order payment codes only" },
              { label: "Message Frequency", value: "One (1) message per order placed" },
              { label: "Sender", value: "DigiVoceEats (Short code or 10DLC number)" },
              { label: "Purpose", value: "Deliver 4-digit payment code for order completion" },
              { label: "Cost", value: "Message and data rates may apply" },
            ].map((item) => (
              <div key={item.label} style={{
                padding: "16px", background: "#faf7f2",
                borderRadius: 10, border: "1px solid #ede8e0",
              }}>
                <div style={{ color: "#9a7a4a", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 6 }}>{item.label}</div>
                <div style={{ color: "#1a0a00", fontSize: 14, lineHeight: 1.5 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sample Messages */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: 16, padding: "32px",
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 20, color: "#1a0a00", borderBottom: "2px solid #f0ede8", paddingBottom: 12 }}>
            💬 Sample Messages
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ color: "#9a7a4a", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 8 }}>Opt-In Confirmation</div>
              <div style={{
                background: "#f0faf4", border: "1px solid #c8e6d3",
                borderRadius: 10, padding: "14px 18px",
                color: "#2c6a40", fontSize: 14, fontFamily: "Arial, sans-serif",
                lineHeight: 1.6,
              }}>
                DigiVoceEats: You have opted in to receive order payment links. One message per order. Msg & data rates may apply. Reply HELP for help or STOP to cancel.
              </div>
            </div>

            <div>
              <div style={{ color: "#9a7a4a", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 8 }}>Order Payment Code</div>
              <div style={{
                background: "#fff8ee", border: "1px solid #f0d9a0",
                borderRadius: 10, padding: "14px 18px",
                color: "#7a5010", fontSize: 14, fontFamily: "Arial, sans-serif",
                lineHeight: 1.6,
              }}>
                DigiVoceEats: Your Bread & Kabob order code is 2847. Pay at payfood.us or show this code at the restaurant. Reply STOP to opt out.
              </div>
            </div>

            <div>
              <div style={{ color: "#9a7a4a", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 8 }}>HELP Response</div>
              <div style={{
                background: "#f5f5ff", border: "1px solid #d0d0f0",
                borderRadius: 10, padding: "14px 18px",
                color: "#3a3a7a", fontSize: 14, fontFamily: "Arial, sans-serif",
                lineHeight: 1.6,
              }}>
                DigiVoceEats: For help with your order visit digivoceeats.com or call (703) 686-5337. Msg & data rates may apply. Reply STOP to cancel.
              </div>
            </div>

            <div>
              <div style={{ color: "#9a7a4a", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 8 }}>STOP Response</div>
              <div style={{
                background: "#fff5f5", border: "1px solid #f0c8c8",
                borderRadius: 10, padding: "14px 18px",
                color: "#7a2c2c", fontSize: 14, fontFamily: "Arial, sans-serif",
                lineHeight: 1.6,
              }}>
                DigiVoceEats: You have been unsubscribed and will receive no further messages. Reply START to resubscribe.
              </div>
            </div>
          </div>
        </div>

        {/* Opt Out Instructions */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: 16, padding: "32px",
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 20, color: "#1a0a00", borderBottom: "2px solid #f0ede8", paddingBottom: 12 }}>
            🛑 How to Opt Out
          </h2>
          <p style={{ color: "#6b4c2a", fontSize: 15, lineHeight: 1.8, marginBottom: 16 }}>
            Customers can opt out of SMS messages at any time using any of the following methods:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Reply STOP to any DigiVoceEats SMS message",
              "Reply QUIT, CANCEL, END, or UNSUBSCRIBE to any message",
              "Contact us at support@digivoceeats.com",
              "Visit digivoceeats.com/privacy-policy for full details",
            ].map((item) => (
              <div key={item} style={{
                display: "flex", gap: 12, alignItems: "center",
                color: "#6b4c2a", fontSize: 14, lineHeight: 1.5,
              }}>
                <span style={{ color: "#b5853a", fontSize: 16 }}>→</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Privacy & Contact */}
        <div style={{
          background: "linear-gradient(135deg, rgba(181,133,58,0.08), rgba(181,133,58,0.04))",
          border: "1px solid rgba(181,133,58,0.2)",
          borderRadius: 16, padding: "32px",
          marginBottom: 48, textAlign: "center",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 400, marginBottom: 16, color: "#1a0a00" }}>Privacy & Contact</h2>
          <p style={{ color: "#6b4c2a", fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
            DigiVoceEats does not share, sell, or distribute customer phone numbers to third parties.<br />
            Phone numbers are used solely for transactional order notifications.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            <a href="/privacy-policy" style={{ color: "#b5853a", fontSize: 14, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
              Privacy Policy
            </a>
            <a href="/terms" style={{ color: "#b5853a", fontSize: 14, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
              Terms of Service
            </a>
            <a href="mailto:support@digivoceeats.com" style={{ color: "#b5853a", fontSize: 14, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
              support@digivoceeats.com
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", color: "#9a7a4a", fontSize: 12, fontFamily: "Arial, sans-serif" }}>
          © {new Date().getFullYear()} DigiVoceEats · Diginetplore LLC · All rights reserved<br />
          <a href="https://www.digivoceeats.com" style={{ color: "#b5853a", textDecoration: "none" }}>digivoceeats.com</a>
        </div>

      </div>
    </div>
  );
}
