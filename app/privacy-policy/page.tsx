export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111111" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "Georgia, serif" }}>
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ color: "#FF6B35", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            ← Back to VoceEats
          </a>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: "#111" }}>Privacy Policy</h1>
        <p style={{ color: "#666", marginBottom: 40, fontSize: 14 }}>Last updated: May 18, 2026</p>

        {[
          { title: "1. Information We Collect", content: "When you place an order through VoceEats, we collect your name, phone number, and order details to process and fulfill your order." },
          { title: "2. How We Use Your Information", content: "We use your information to process orders, send secure payment links, and confirm orders via SMS. We do not use your information for marketing without your consent." },
          { title: "3. SMS Communications", content: "By placing an order through our voice ordering system, you consent to receive SMS messages including order confirmations and secure payment links. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help." },
          { title: "4. Data Sharing", content: "We do not sell your personal information to third parties. Order data is shared only with the restaurant fulfilling your order and our payment processor Stripe." },
          { title: "5. Data Security", content: "We use industry-standard security measures to protect your personal information. Payment data is processed securely through Stripe and we never store card details." },
          { title: "6. Your Rights", content: "You may request deletion of your personal data at any time by contacting us. You can opt out of SMS communications by replying STOP to any message." },
          { title: "7. Contact Us", content: "If you have questions about this privacy policy, please contact us at hello@digivoceeats.com" },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#111" }}>{section.title}</h2>
            <p style={{ color: "#444", lineHeight: 1.8, fontSize: 15 }}>{section.content}</p>
          </div>
        ))}

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee", color: "#999", fontSize: 13 }}>
          © 2026 Diginetplore LLC. All rights reserved.
        </div>
      </div>
    </div>
  );
}
