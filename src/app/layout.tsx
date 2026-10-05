import type { Metadata } from "next";
import { Cairo, Fraunces } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-plus-jakarta",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "ARMS — نظام إدارة الصيانة",
  description: "منصة إدارة طلبات وعمليات صيانة الأجهزة",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} ${fraunces.variable} font-sans`}>{children}</body>
    </html>
  );
}
