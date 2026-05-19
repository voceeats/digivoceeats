import Image from "next/image";
import type { CSSProperties } from "react";

type BrandLogoProps = {
  priority?: boolean;
  /** Use on light backgrounds so the mark stays readable */
  variant?: "default" | "onLight";
};

export function BrandLogo({ priority = false, variant = "default" }: BrandLogoProps) {
  const wrapStyle: CSSProperties =
    variant === "onLight"
      ? {
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 10px",
          borderRadius: 10,
          background: "rgba(15,15,20,0.06)",
          border: "1px solid rgba(15,15,20,0.08)",
        }
      : {
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 0",
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        };

  return (
    <span style={wrapStyle}>
      <Image
        src="/digivoceeats_logo.png"
        alt="DigiVoceEats"
        height={40}
        width={220}
        style={{
          height: 40,
          width: "auto",
          maxWidth: "min(72vw, 280px)",
          objectFit: "contain",
        }}
        priority={priority}
      />
    </span>
  );
}
