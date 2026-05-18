"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

export default function HoursPage() {
  const router = useRouter();
  const [hours, setHours] = useState<any>({});
  const [prepTime, setPrepTime] = useState(25);
  const [lastOrder, setLastOrder] = useState(45);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [restaurantId, setRestaurantId] = useState("");

  useEffect(() => {
    loadHours();
  }, []);

  const loadHours = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: rest } = await supabase
      .from("restaurants")
      .select("id, opening_hours, prep_time_minutes, last_order_minutes_before_close")
      .eq("slug", "bread-kabob")
      .single();

    if (rest) {
      setRestaurantId(rest.id);
      setHours(rest.opening_hours || {});
      setPrepTime(rest.prep_time_minutes || 25);
      setLastOrder(rest.last_order_minutes_before_close || 45);
    }
  };

  const updateDay = (day: string, field: string, value: any) => {
    setHours((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const saveHours = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({
        opening_hours: hours,
        prep_time_minutes: prepTime,
        last_order_minutes_before_close: lastOrder,
      })
      .eq("id", restaurantId);

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const S = {
    card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" } as React.CSSProperties,
    input: { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#F9FAFB", fontSize: 14, outline: "none", fontFamily: "inherit" } as React.CSSProperties,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", fontFamily: "'Segoe UI', sans-serif", color: "#F9FAFB", padding: 32 }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "#9CA3AF", cursor: "pointer", fontFamily: "inherit" }}>
            ← Back
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>⏰ Opening Hours</h1>
        </div>

        {saved && (
          <div style={{ background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 12, padding: "12px 20px", color: "#00C896", fontWeight: 600, marginBottom: 20 }}>
            ✅ Hours saved! Voice AI updated automatically.
          </div>
        )}

        <div style={{ ...S.card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#F9FAFB" }}>Weekly Hours</h2>
          {DAYS.map(day => {
            const dayHours = hours[day] || { open: "11:00", close: "22:00", is_closed: false };
            return (
              <div key={day} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 100, color: "#9CA3AF", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>
                  {day}
                </div>
                <div
                  onClick={() => updateDay(day, "is_closed", !dayHours.is_closed)}
                  style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: !dayHours.is_closed ? "#00C896" : "#374151", position: "relative", transition: "background 0.3s", flexShrink: 0 }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: !dayHours.is_closed ? 23 : 3, transition: "left 0.3s" }} />
                </div>
                <span style={{ color: !dayHours.is_closed ? "#00C896" : "#EF4444", fontSize: 12, fontWeight: 600, width: 50 }}>
                  {!dayHours.is_closed ? "OPEN" : "CLOSED"}
                </span>
                {!dayHours.is_closed && (
                  <>
                    <input
                      type="time"
                      value={dayHours.open}
                      onChange={e => updateDay(day, "open", e.target.value)}
                      style={S.input}
                    />
                    <span style={{ color: "#6B7280" }}>to</span>
                    <input
                      type="time"
                      value={dayHours.close}
                      onChange={e => updateDay(day, "close", e.target.value)}
                      style={S.input}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ ...S.card, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Order Settings</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", color: "#9CA3AF", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                🍳 Prep Time (minutes)
              </label>
              <input
                type="number"
                value={prepTime}
                onChange={e => setPrepTime(parseInt(e.target.value))}
                min="5" max="120"
                style={{ ...S.input, width: "100%" }}
              />
              <div style={{ color: "#4B5563", fontSize: 11, marginTop: 6 }}>
                AI tells customers: "Ready in {prepTime} minutes"
              </div>
            </div>
            <div>
              <label style={{ display: "block", color: "#9CA3AF", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                🕐 Last Order Before Close (minutes)
              </label>
              <input
                type="number"
                value={lastOrder}
                onChange={e => setLastOrder(parseInt(e.target.value))}
                min="15" max="120"
                style={{ ...S.input, width: "100%" }}
              />
              <div style={{ color: "#4B5563", fontSize: 11, marginTop: 6 }}>
                Stop orders {lastOrder} mins before closing
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={saveHours}
          disabled={saving}
          style={{ width: "100%", background: saving ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}
        >
          {saving ? "Saving..." : "Save Hours →"}
        </button>
      </div>
    </div>
  );
}
