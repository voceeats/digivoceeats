"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎙️</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ fontWeight: 900, fontSize: 32, background: "linear-gradient(135deg,#FF6B35,#FF9A6C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Voce</span>
            <span style={{ fontWeight: 900, fontSize: 32, color: "#F9FAFB" }}>Eats</span>
          </div>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 8 }}>Set your password to get started</p>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px" }}>
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ color: "#00C896", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Password set successfully!</div>
              <div style={{ color: "#6B7280", fontSize: 14 }}>Redirecting to your dashboard...</div>
            </div>
          ) : (
            <>
              <h2 style={{ color: "#F9FAFB", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Create your password</h2>
              <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>Choose a secure password for your account</p>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#EF4444", fontSize: 13, marginBottom: 20 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSetPassword}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", color: "#9CA3AF", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 16px", color: "#F9FAFB", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", color: "#9CA3AF", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 16px", color: "#F9FAFB", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: "100%", background: loading ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {loading ? "Setting password..." : "Set Password & Sign In →"}
                </button>
              </form>
            </>
          )}

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <p style={{ color: "#4B5563", fontSize: 12 }}>
              Powered by <span style={{ color: "#FF6B35", fontWeight: 700 }}>Diginetplore</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
