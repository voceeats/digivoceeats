"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Check if admin
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (email === adminEmail) {
      router.push("/admin");
      return;
    }

    router.push("/dashboard");
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
      <div style={{
        width: "100%",
        maxWidth: 420,
        padding: "0 24px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <BrandLogo priority />
          </div>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 8 }}>
            Restaurant Owner Portal
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "36px 32px",
        }}>
          <h2 style={{
            color: "#F9FAFB",
            fontSize: 22,
            fontWeight: 800,
            marginBottom: 8,
          }}>
            Sign in to your account
          </h2>
          <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>
            Access your restaurant dashboard
          </p>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10,
              padding: "12px 16px",
              color: "#EF4444",
              fontSize: 13,
              marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block",
                color: "#9CA3AF",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@restaurant.com"
                required
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "13px 16px",
                  color: "#F9FAFB",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: "block",
                color: "#9CA3AF",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "13px 16px",
                  color: "#F9FAFB",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#374151" : "linear-gradient(135deg,#FF6B35,#FF8C5A)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "14px",
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          <div style={{
            marginTop: 24,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
          }}>
            <p style={{ color: "#4B5563", fontSize: 12 }}>
              Powered by{" "}
              <span style={{ color: "#FF6B35", fontWeight: 700 }}>
                Diginetplore
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
