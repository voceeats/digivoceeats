import Image from "next/image";
import type { CSSProperties } from "react";

type BrandLogoProps = {
  priority?: boolean;
  /** Use on light backgrounds so the mark stays readable */
  variant?: "default" | "onLight";
  /** Display width in px (default: auto) */
  width?: number;
  /** Display height in px (default: 40) */
  height?: number;
};

export function BrandLogo({
  priority = false,
  variant = "default",
  width,
  height = 40,
}: BrandLogoProps) {
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
        width={512}
        height={512}
        style={{
          height,
          width: width ?? "auto",
          maxWidth: width ? undefined : "min(72vw, 280px)",
          objectFit: "contain",
        }}
        priority={priority}
      />
    </span>
  );
}
