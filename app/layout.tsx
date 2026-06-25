import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toaster";

export const metadata: Metadata = {
  title: "Meridian",
  description:
    "Meridian — a production-ready Next.js + Drizzle + Neon foundation, deployed on Vercel.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
