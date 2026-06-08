"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import QRCode from "qrcode";
import { PAYFOOD_PAY_URL } from "@/components/payment-qr-section";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function PrintPaymentCardPage({
  params,
}: {
  params: { restaurantId: string };
}) {
  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: rest }, qr] = await Promise.all([
        supabase.from("restaurants").select("name").eq("id", params.restaurantId).single(),
        QRCode.toDataURL(PAYFOOD_PAY_URL, {
          width: 320,
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
        }),
      ]);

      if (cancelled) return;
      if (rest?.name) setRestaurantName(rest.name);
      setQrDataUrl(qr);
      setReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.restaurantId]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [ready]);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 4in 6in;
            margin: 0;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          margin: 0;
          background: #f3f4f6;
          font-family: "Segoe UI", system-ui, sans-serif;
        }
      `}</style>

      <div className="no-print" style={{ padding: 16, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!ready}
          style={{
            background: "#FF6B35",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontWeight: 700,
            fontSize: 14,
            cursor: ready ? "pointer" : "not-allowed",
          }}
        >
          Print Card
        </button>
      </div>

      <div
        style={{
          width: "4in",
          height: "6in",
          margin: "0 auto",
          background: "#fff",
          color: "#111",
          boxSizing: "border-box",
          padding: "0.28in 0.32in",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ textAlign: "center", width: "100%" }}>
          <Image
            src="/digivoceeats_logo.png"
            alt="DigiVoceEats"
            width={140}
            height={48}
            style={{ height: 40, width: "auto", objectFit: "contain", margin: "0 auto" }}
            priority
          />
          <h1
            style={{
              margin: "0.14in 0 0",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: -0.3,
              lineHeight: 1.2,
            }}
          >
            {restaurantName}
          </h1>
        </div>

        <div style={{ textAlign: "center" }}>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Scan to pay at payfood.us"
              style={{ width: "2.1in", height: "2.1in", objectFit: "contain" }}
            />
          ) : (
            <div
              style={{
                width: "2.1in",
                height: "2.1in",
                border: "2px dashed #d1d5db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              Loading QR…
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", width: "100%" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>
            Scan to pay your order
            <br />
            or visit payfood.us
          </p>
          <p
            style={{
              margin: "0.12in 0 0",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              lineHeight: 1.4,
            }}
          >
            Enter your 4-digit order code to complete payment
          </p>
          <div
            style={{
              marginTop: "0.16in",
              paddingTop: "0.12in",
              borderTop: "1px solid #e5e7eb",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#6b7280",
            }}
          >
            Powered by DigiVoceEats
          </div>
        </div>
      </div>
    </>
  );
}
