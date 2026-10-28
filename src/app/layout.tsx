import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import IdleSessionGuard from "@/components/idle-session-guard";
import { ThemeProvider } from "@/components/design-system/theme-provider";

const inter = localFont({
  src: "../assets/fonts/inter-latin.woff2",
  weight: "400 600",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

export const metadata: Metadata = {
  title: "Mary Royal School | Hard work pays",
  description: "Mary Royal School · Nurturing Excellence Through CBE",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false, noimageindex: true, nosnippet: true }
  },
  applicationName: "Mary Royal SMS",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/mary-royal-logo.png" }
};

export const viewport: Viewport = { themeColor: "#1d4ed8" };

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <Script
          id="mary-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try {
              const t = localStorage.getItem("mary-theme");
              document.documentElement.dataset.theme = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
              const s = localStorage.getItem("mary-style");
              if (s) document.documentElement.dataset.style = s;
            } catch {}`
          }}
        />
        <Script
          id="mary-sw-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }`
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <IdleSessionGuard />
        </ThemeProvider>
      </body>
    </html>
  );
}
