import type { Metadata } from "next";
import { Cairo, Fraunces } from "next/font/google";
import { PreferencesProvider } from "@/components/preferences-provider";
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

const prefsBootScript = `(function(){try{var l=localStorage.getItem('arms_locale')||'ar';var t=localStorage.getItem('arms_theme')||'light';var d=document.documentElement;d.lang=l;d.dir=l==='ar'?'rtl':'ltr';d.dataset.theme=t;if(t==='dark')d.classList.add('dark');d.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
      </head>
      <body className={`${cairo.variable} ${fraunces.variable} font-sans`}>
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
