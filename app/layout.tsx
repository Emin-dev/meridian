import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toaster";

export const metadata: Metadata = {
  title: "Meridian",
  description:
    "Meridian — a production-ready Next.js + Drizzle + Neon foundation, deployed on Vercel.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="min-h-dvh antialiased">
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
