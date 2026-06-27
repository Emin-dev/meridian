import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toaster";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();
const title = "Meridian";
const description =
  "Meridian — an AI-first sales & automation CRM for managing contacts, deals, and sequences.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · Meridian" },
  description,
  applicationName: "Meridian",
  openGraph: {
    type: "website",
    siteName: "Meridian",
    title,
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
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
