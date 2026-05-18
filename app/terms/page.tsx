export default function Terms() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111111" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "Georgia, serif" }}>
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ color: "#FF6B35", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            ← Back to VoceEats
          </a>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: "#111" }}>Terms of Service</h1>
        <p style={{ color: "#666", marginBottom: 40, fontSize: 14 }}>Last updated: May 18, 2026</p>

        {[
          { title: "1. Service Description", content: "VoceEats provides an AI-powered voice ordering platform for restaurants operated by Diginetplore LLC. Customers place food orders by calling a designated phone number." },
          { title: "2. Acceptance of Terms", content: "By using VoceEats services, you agree to these terms. If you do not agree, please do not use our service." },
          { title: "3. SMS Messaging", content: "By providing your phone number, you consent to receive SMS messages for order confirmations and payment links. Reply STOP to opt out. Message and data rates may apply." },
          { title: "4. Payments", content: "Payments are processed securely through Stripe. VoceEats charges a 15% service fee on all orders processed through our platform. This fee is included in the prices quoted to customers." },
          { title: "5. Order Accuracy", content: "While our AI strives for accuracy, please confirm your order details before payment. Contact the restaurant directly for order modifications after payment." },
          { title: "6. Refunds", content: "Refund requests should be directed to the restaurant directly. VoceEats platform fees are non-refundable once an order is processed." },
          { title: "7. Restaurant Partners", content: "VoceEats partners with restaurants to provide ordering services. We are not responsible for food quality, preparation, or delivery — those remain the responsibility of the restaurant." },
          { title: "8. Limitation of Liability", content: "VoceEats and Diginetplore LLC shall not be liable for any indirect or consequential damages arising from use of our service." },
          { title: "9. Changes to Terms", content: "We may update these terms at any time. Continued use of our service constitutes acceptance of updated terms." },
          { title: "10. Contact", content: "For questions about these terms, contact us at hello@digivoceeats.com" },
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
