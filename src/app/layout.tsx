import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Inter_Tight } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin-ext"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin-ext"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Flowly Pilates",
    template: "%s | Flowly Pilates",
  },
  description: "Flowly Pilates reformer ders programı: dersini seç, yerini ayır, rezervasyonunu yönet.",
  applicationName: "Flowly Pilates",
  // iPhone: once added to the home screen the site opens like an app and can receive notifications.
  appleWebApp: { capable: true, title: "Flowly", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f8f5e8" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Every page is rendered per request, so each one gets the nonce from its Content-Security-Policy.
  await connection();
  return (
    <html lang="tr" className={`${instrumentSans.variable} ${interTight.variable}`} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
