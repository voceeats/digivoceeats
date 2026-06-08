"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CUISINE_TYPES = [
  "American", "Italian", "Mexican", "Chinese", "Japanese", "Indian",
  "Mediterranean", "Middle Eastern", "Thai", "Vietnamese", "Korean",
  "Greek", "French", "Caribbean", "African", "Pizza", "Burgers",
  "Seafood", "Steakhouse", "Vegetarian/Vegan", "Bakery & Cafe", "Other",
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    restaurant_name: "",
    cuisine_type: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    restaurant_phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    num_locations: "1",
    heard_about: "",
    message: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "14px 18px",
    color: "#F9FAFB",
    fontSize: 15,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    transition: "border-color 0.2s",
  } as React.CSSProperties;

  const labelStyle = {
    display: "block",
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: 8,
    fontFamily: "'DM Sans', sans-serif",
  };

  if (submitted) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@400;700&display=swap');`}</style>
        <div style={{ textAlign: "center", maxWidth: 520 }}>
          <div style={{
            width: 90, height: 90, borderRadius: "50%",
            background: "rgba(0,200,150,0.12)",
            border: "2px solid rgba(0,200,150,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 32px",
          }}>✅</div>
          <h1 style={{ color: "#F9FAFB", fontSize: 36, fontWeight: 700, fontFamily: "'Playfair Display', serif", marginBottom: 16 }}>
            You&apos;re on the list!
          </h1>
          <p style={{ color: "#9CA3AF", fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            Thanks for your interest in DigiVoceEats. We&apos;ve received your information and will reach out to <strong style={{ color: "#F9FAFB" }}>{form.owner_email}</strong> within 24 hours to get your restaurant set up.
          </p>
          <div style={{
            background: "rgba(181,133,58,0.08)",
            border: "1px solid rgba(181,133,58,0.25)",
            borderRadius: 16, padding: "24px 32px", marginBottom: 32,
          }}>
            <div style={{ color: "#b5853a", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>What happens next</div>
            {["We review your application", "Our team contacts you within 24h", "We set up your AI phone line", "You start receiving voice orders"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, color: "#D1D5DB", fontSize: 14 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(181,133,58,0.2)", border: "1px solid rgba(181,133,58,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#b5853a", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 32px", color: "#9CA3AF", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", fontFamily: "'DM Sans', sans-serif", color: "#F9FAFB" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus, textarea:focus { border-color: #b5853a !important; }
        input::placeholder, textarea::placeholder { color: #4B5563; }
        select option { background: #1a1a2e; color: #F9FAFB; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .field-row { animation: fadeUp 0.4s ease both; }
      `}</style>

      <header style={{
        padding: "20px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.4)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #b5853a, #8a5e20)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🎙️</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>DigiVoceEats</div>
            <div style={{ color: "#6B7280", fontSize: 11 }}>AI Voice Ordering Platform</div>
          </div>
        </div>
        <a href="/" style={{ color: "#6B7280", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>← Back</a>
      </header>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(181,133,58,0.1)", border: "1px solid rgba(181,133,58,0.25)",
            borderRadius: 20, padding: "6px 16px", marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C896", display: "inline-block" }} />
            <span style={{ color: "#b5853a", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Now Accepting Restaurants</span>
          </div>
          <h1 style={{
            fontSize: 48, fontWeight: 700, lineHeight: 1.1,
            fontFamily: "'Playfair Display', serif",
            marginBottom: 20,
            background: "linear-gradient(135deg, #F9FAFB 0%, #b5853a 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Grow Your Restaurant with AI Voice Ordering
          </h1>
          <p style={{ color: "#9CA3AF", fontSize: 18, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
            Let Chloe, your AI phone agent, take orders 24/7. No missed calls, no wrong orders — just more revenue.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 40 }}>
            {[["24/7", "AI answers calls"], ["15%", "Platform fee only"], ["<1min", "Order to dashboard"]].map(([val, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ color: "#b5853a", fontSize: 26, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>{val}</div>
                <div style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 48 }}>
          {["Restaurant Info", "Owner Details", "Final Details"].map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: step > i + 1 ? "#00C896" : step === i + 1 ? "#b5853a" : "rgba(255,255,255,0.06)",
                  border: step === i + 1 ? "2px solid rgba(181,133,58,0.5)" : "2px solid transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  color: step >= i + 1 ? "#fff" : "#4B5563",
                  transition: "all 0.3s",
                }}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 11, color: step === i + 1 ? "#b5853a" : "#4B5563", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < 2 && <div style={{ width: 80, height: 1, background: step > i + 1 ? "#00C896" : "rgba(255,255,255,0.08)", margin: "0 8px", marginBottom: 28, transition: "background 0.3s" }} />}
            </div>
          ))}
        </div>

        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24, padding: "40px",
        }}>
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>Restaurant Information</h2>
              <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 32 }}>Tell us about your restaurant.</p>
              <div className="field-row" style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Restaurant Name *</label>
                <input style={inputStyle} placeholder="e.g. Bread & Kabob" value={form.restaurant_name} onChange={e => set("restaurant_name", e.target.value)} />
              </div>
              <div className="field-row" style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Cuisine Type *</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={form.cuisine_type} onChange={e => set("cuisine_type", e.target.value)}>
                  <option value="">Select cuisine type...</option>
                  {CUISINE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field-row" style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Restaurant Phone Number *</label>
                <input style={inputStyle} placeholder="(703) 000-0000" value={form.restaurant_phone} onChange={e => set("restaurant_phone", e.target.value)} type="tel" />
              </div>
              <div className="field-row" style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Street Address *</label>
                <input style={inputStyle} placeholder="123 Main St" value={form.address} onChange={e => set("address", e.target.value)} />
              </div>
              <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 12, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input style={inputStyle} placeholder="Falls Church" value={form.city} onChange={e => set("city", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>State *</label>
                  <input style={inputStyle} placeholder="VA" value={form.state} onChange={e => set("state", e.target.value)} maxLength={2} />
                </div>
                <div>
                  <label style={labelStyle}>ZIP *</label>
                  <input style={inputStyle} placeholder="22041" value={form.zip} onChange={e => set("zip", e.target.value)} maxLength={5} />
                </div>
              </div>
              <div className="field-row" style={{ marginBottom: 32 }}>
                <label style={labelStyle}>Number of Locations</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={form.num_locations} onChange={e => set("num_locations", e.target.value)}>
                  {["1", "2", "3", "4", "5", "6-10", "10+"].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button
                onClick={() => {
                  if (!form.restaurant_name || !form.cuisine_type || !form.restaurant_phone || !form.address || !form.city || !form.state || !form.zip) {
                    setError("Please fill in all required fields.");
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
                style={{ width: "100%", padding: "16px", borderRadius: 14, background: "linear-gradient(135deg, #b5853a, #8a5e20)", border: "none", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                Continue →
              </button>
              {error && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>Owner Details</h2>
              <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 32 }}>We&apos;ll use this to contact you directly.</p>
              <div className="field-row" style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Owner Full Name *</label>
                <input style={inputStyle} placeholder="John Smith" value={form.owner_name} onChange={e => set("owner_name", e.target.value)} />
              </div>
              <div className="field-row" style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Owner Email *</label>
                <input style={inputStyle} placeholder="john@yourrestaurant.com" value={form.owner_email} onChange={e => set("owner_email", e.target.value)} type="email" />
              </div>
              <div className="field-row" style={{ marginBottom: 32 }}>
                <label style={labelStyle}>Owner Phone Number *</label>
                <input style={inputStyle} placeholder="(703) 000-0000" value={form.owner_phone} onChange={e => set("owner_phone", e.target.value)} type="tel" />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => { setError(""); setStep(1); }} style={{ flex: 1, padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
                <button
                  onClick={() => {
                    if (!form.owner_name || !form.owner_email || !form.owner_phone) {
                      setError("Please fill in all required fields.");
                      return;
                    }
                    setError("");
                    setStep(3);
                  }}
                  style={{ flex: 2, padding: "16px", borderRadius: 14, background: "linear-gradient(135deg, #b5853a, #8a5e20)", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Continue →
                </button>
              </div>
              {error && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>Almost Done!</h2>
              <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 32 }}>A couple more things to help us prepare for your setup.</p>
              <div className="field-row" style={{ marginBottom: 24 }}>
                <label style={labelStyle}>How did you hear about us?</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={form.heard_about} onChange={e => set("heard_about", e.target.value)}>
                  <option value="">Select...</option>
                  {["Google Search", "Social Media", "Friend / Word of mouth", "Existing restaurant partner", "Advertisement", "Other"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field-row" style={{ marginBottom: 32 }}>
                <label style={labelStyle}>Anything else you&apos;d like us to know?</label>
                <textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical" as const, lineHeight: 1.6 }} placeholder="e.g. We have a busy lunch rush, our menu has 40+ items..." value={form.message} onChange={e => set("message", e.target.value)} />
              </div>
              <div style={{ background: "rgba(181,133,58,0.06)", border: "1px solid rgba(181,133,58,0.2)", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
                <div style={{ color: "#b5853a", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Your Summary</div>
                {[["Restaurant", form.restaurant_name], ["Cuisine", form.cuisine_type], ["Location", `${form.city}, ${form.state}`], ["Owner", form.owner_name], ["Email", form.owner_email], ["Phone", form.owner_phone]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: "#6B7280" }}>{k}</span>
                    <span style={{ color: "#F9FAFB", fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => { setError(""); setStep(2); }} style={{ flex: 1, padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
                <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: "16px", borderRadius: 14, background: loading ? "rgba(181,133,58,0.4)" : "linear-gradient(135deg, #b5853a, #8a5e20)", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {loading ? "Submitting..." : "🚀 Submit Application"}
                </button>
              </div>
              {error && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 40, flexWrap: "wrap" }}>
          {["🔒 Secure & Private", "⚡ Setup in 48h", "🤝 No long-term contract"].map(b => (
            <span key={b} style={{ color: "#4B5563", fontSize: 13, fontWeight: 600 }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
