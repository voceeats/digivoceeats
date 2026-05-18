export default function Terms() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", color: "#111" }}>
      <h1>Terms of Service</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Last updated: May 18, 2026</p>

      <h2>1. Service Description</h2>
      <p>VoceEats provides a voice AI ordering platform for restaurants. Customers place orders by calling the restaurant's designated phone number.</p>

      <h2>2. SMS Messaging</h2>
      <p>By using our service, you agree to receive SMS messages for order confirmations and payment links. Reply STOP to opt out at any time.</p>

      <h2>3. Payments</h2>
      <p>Payments are processed securely through Stripe. VoceEats charges a 15% service fee on all orders.</p>

      <h2>4. Refunds</h2>
      <p>Refund requests should be directed to the restaurant directly.</p>

      <h2>5. Contact</h2>
      <p>Email: hello@digivoceeats.com</p>
    </div>
  );
}
