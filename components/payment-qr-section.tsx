"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export const PAYFOOD_PAY_URL = "https://payfood.us";

type PaymentQrSectionProps = {
  restaurantId: string;
  restaurantName: string;
  printPathPrefix?: string;
  compact?: boolean;
};

export function PaymentQrSection({
  restaurantId,
  restaurantName,
  printPathPrefix = "/admin/print-card",
  compact = false,
}: PaymentQrSectionProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    QRCode.toDataURL(PAYFOOD_PAY_URL, {
      width: compact ? 180 : 240,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compact]);

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${restaurantName.replace(/\s+/g, "-").toLowerCase()}-payfood-qr.png`;
    link.click();
  };

  const printCard = () => {
    window.open(`${printPathPrefix}/${restaurantId}`, "_blank", "noopener,noreferrer");
  };

  const btn = (label: string, onClick: () => void, primary = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || !qrDataUrl}
      style={{
        background: primary ? "linear-gradient(135deg,#FF6B35,#FF8C5A)" : "rgba(255,255,255,0.08)",
        color: primary ? "#fff" : "#D1D5DB",
        border: primary ? "none" : "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: compact ? "8px 14px" : "10px 18px",
        fontSize: compact ? 12 : 13,
        fontWeight: 700,
        cursor: loading || !qrDataUrl ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: loading || !qrDataUrl ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        marginTop: compact ? 0 : 16,
        paddingTop: compact ? 0 : 16,
        borderTop: compact ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {!compact && (
        <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          📱 Payment QR Code
        </div>
      )}
      <div style={{ display: "flex", gap: 20, alignItems: compact ? "flex-start" : "center", flexWrap: "wrap" }}>
        <div
          style={{
            width: compact ? 180 : 240,
            height: compact ? 180 : 240,
            background: "#fff",
            borderRadius: 12,
            padding: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {loading ? (
            <span style={{ color: "#6B7280", fontSize: 13 }}>Generating…</span>
          ) : qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR code for ${PAYFOOD_PAY_URL}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <span style={{ color: "#EF4444", fontSize: 13 }}>Failed to generate</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ color: "#F9FAFB", fontWeight: 700, fontSize: compact ? 14 : 15, marginBottom: 6 }}>
            {PAYFOOD_PAY_URL}
          </div>
          <div style={{ color: "#6B7280", fontSize: compact ? 12 : 13, lineHeight: 1.5, marginBottom: 14 }}>
            Customers scan to pay with their 4-digit order code.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {btn("Download QR Code", downloadQr, true)}
            {btn("Print Payment Card", printCard)}
          </div>
        </div>
      </div>
    </div>
  );
}
