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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ARMS",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

/** Boot flash: load theme/locale for the signed-in account (per-user map). */
const prefsBootScript = `(function(){try{var locale='ar',theme='light';var sessionRaw=localStorage.getItem('arms_session');var prefsRaw=localStorage.getItem('arms_user_prefs_v1');if(sessionRaw&&prefsRaw){var session=JSON.parse(sessionRaw);var map=JSON.parse(prefsRaw);var p=session&&session.id?map[session.id]:null;if(p){if(p.locale==='en')locale='en';if(p.theme==='dark')theme='dark';}}else{if(localStorage.getItem('arms_locale')==='en')locale='en';if(localStorage.getItem('arms_theme')==='dark')theme='dark';}var d=document.documentElement;d.lang=locale;d.dir=locale==='ar'?'rtl':'ltr';d.dataset.theme=theme;if(theme==='dark')d.classList.add('dark');else d.classList.remove('dark');d.style.colorScheme=theme;}catch(e){}})();`;

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
