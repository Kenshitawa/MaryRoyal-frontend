import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import IdleSessionGuard from "@/components/idle-session-guard";
import { ThemeProvider } from "@/components/design-system/theme-provider";
import { TenantProvider } from "@/components/tenant-provider";
import { getTenantConfig, type TenantConfig } from "@/lib/tenant";

const inter = localFont({
  src: "../assets/fonts/inter-latin.woff2",
  weight: "400 600",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

const DEFAULT_DEMO_TENANT: TenantConfig = {
  id: "school_demo_mary_royal",
  name: "Mary Royal School",
  slug: "maryroyal",
  motto: "Hard work pays",
  slogan: "Nurturing Excellence Through CBE",
  logoUrl: "/mary-royal-logo.png",
  primaryColour: "#1d4ed8",
  secondaryColour: "#102653",
  accentColour: "#d97706",
  contactEmail: "maryroyalschool81@gmail.com",
  contactPhone: "+254 718 216 374",
  poBox: "P.O. Box 40100, Kisumu",
  physicalAddress: "Obunga, near Breweries, Kisumu",
  status: "ACTIVE",
};

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const schoolSlug = reqHeaders.get("x-school-slug") ?? "maryroyal";
  const tenant = (await getTenantConfig(schoolSlug)) ?? DEFAULT_DEMO_TENANT;

  return {
    title: `${tenant.name} | ${tenant.motto}`,
    description: `${tenant.name} · ${tenant.slogan ?? "Nurturing Excellence Through CBE"}`,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false, noimageindex: true, nosnippet: true },
    },
    applicationName: `${tenant.name} SMS`,
    manifest: "/manifest.webmanifest",
    icons: { icon: tenant.logoUrl },
  };
}

export const viewport: Viewport = { themeColor: "#1d4ed8" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const reqHeaders = await headers();
  const schoolSlug = reqHeaders.get("x-school-slug") ?? "maryroyal";
  const tenant = (await getTenantConfig(schoolSlug)) ?? DEFAULT_DEMO_TENANT;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <style id="tenant-dynamic-theme" dangerouslySetInnerHTML={{
          __html: `
            :root {
              --brand: ${tenant.primaryColour};
              --brand-hover: ${tenant.secondaryColour};
              --chrome-from: ${tenant.primaryColour};
              --chrome-to: ${tenant.secondaryColour};
              --head-from: ${tenant.primaryColour};
              --head-to: ${tenant.secondaryColour};
              --focus-ring: ${tenant.primaryColour};
            }
          `
        }} />
        <Script
          id="mary-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try {
              const t = localStorage.getItem("mary-theme");
              document.documentElement.dataset.theme = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
              const s = localStorage.getItem("mary-style");
              if (s) document.documentElement.dataset.style = s;
            } catch {}`,
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
            }`,
          }}
        />
      </head>
      <body>
        <TenantProvider tenant={tenant}>
          <ThemeProvider>
            {children}
            <IdleSessionGuard />
          </ThemeProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
