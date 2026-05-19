import type { Metadata, Viewport } from "next";
import { Syne, DM_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "DigiVoceEats",
    template: "%s | DigiVoceEats",
  },
  description: "AI voice ordering for restaurants",
  keywords: ["restaurant", "voice AI", "ordering", "POS", "food ordering"],
  authors: [{ name: "Diginetplore", url: "https://www.digivoceeats.com" }],
  creator: "Diginetplore",
  metadataBase: new URL("https://www.digivoceeats.com"),
  icons: {
    icon: "/digivoceeats_logo.png",
    apple: "/digivoceeats_logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.digivoceeats.com",
    title: "DigiVoceEats",
    description: "AI voice ordering for restaurants",
    siteName: "DigiVoceEats",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6B35",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable}`}>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1A1A2E",
              color: "#F9FAFB",
              border: "1px solid rgba(255,107,53,0.3)",
              borderRadius: "12px",
              fontFamily: "var(--font-syne)",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#00C896", secondary: "#1A1A2E" },
            },
            error: {
              iconTheme: { primary: "#EF4444", secondary: "#1A1A2E" },
            },
          }}
        />
      </body>
    </html>
  );
}
