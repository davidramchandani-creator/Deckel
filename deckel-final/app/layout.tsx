import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/pwa";

export const metadata: Metadata = {
  title: "Pace or Pay",
  description:
    "Team-Lauf-Challenge — wer zurueckliegt, zahlt die Differenz in den Topf.",
  applicationName: "Pace or Pay",
  appleWebApp: {
    capable: true,
    title: "Pace or Pay",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f5f2ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-CH" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
