import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "AGENT ARCADE",
  description: "Multi-agent conversation arcade powered by AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-retro antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col pixel-grid">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          <div className="crt-overlay" />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
