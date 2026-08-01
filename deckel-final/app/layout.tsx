import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deckel",
  description: "Team-Lauf-Challenge -- wer zurueckliegt, zahlt in den Topf.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-CH" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink font-mono">
        {children}
      </body>
    </html>
  );
}
