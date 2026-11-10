import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import IdleSessionGuard from "@/components/idle-session-guard";
import { ThemeProvider } from "@/components/design-system/theme-provider";
import { TenantProvider } from "@/components/tenant-provider";
import { TenantStatusPage } from "@/components/tenant-status-page";
import { getTenantConfig } from "@/lib/tenant";
import { PLATFORM_TENANT, type TenantConfig } from "@/lib/tenant-types";

const inter = localFont({
  src: "../assets/fonts/inter-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "400 700",
  style: "normal",
  preload: true,
});

export const viewport: Viewport = { themeColor: "#1d4ed8" };

type ResolvedLayoutTenant =
  | { kind: "ready"; tenant: TenantConfig }
  | { kind: "unavailable"; reason: "no-school" | "not-found" | "suspended"; name?: string };

async function resolveLayoutTenant(): Promise<ResolvedLayoutTenant> {
  const reqHeaders = await headers();
  const kind = reqHeaders.get("x-tenant-kind");

  if (kind === "super-admin") {
    return { kind: "ready", tenant: PLATFORM_TENANT };
  }
  if (kind === "root") {
    return { kind: "unavailable", reason: "no-school" };
  }

  const slug = reqHeaders.get("x-school-slug");
  if (!slug) return { kind: "unavailable", reason: "no-school" };

  const tenant = await getTenantConfig(slug);
  if (!tenant) return { kind: "unavailable", reason: "not-found" };
  if (tenant.status === "SUSPENDED") return { kind: "unavailable", reason: "suspended", name: tenant.name };
  return { kind: "ready", tenant };
}

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveLayoutTenant();
  if (resolved.kind === "unavailable") {
    return {
      title: "School portal unavailable",
      robots: { index: false, follow: false },
    };
  }
  const tenant = resolved.tenant;
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const resolved = await resolveLayoutTenant();
  const tenant = resolved.kind === "ready" ? resolved.tenant : null;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {tenant && (
          <style
            id="tenant-dynamic-theme"
            dangerouslySetInnerHTML={{
              __html: `
                :root {
                  --brand: ${tenant.primaryColour};
                  --brand-hover: ${tenant.secondaryColour};
                  --chrome-from: ${tenant.primaryColour};
                  --chrome-to: ${tenant.secondaryColour};
                  --head-from: ${tenant.primaryColour};
                  --head-to: ${tenant.secondaryColour};
                  --focus-ring: ${tenant.primaryColour};
                  --accent: ${tenant.accentColour};
                }
              `,
            }}
          />
        )}
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
          id="mary-sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `try {
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            } catch {}`,
          }}
        />
      </head>
      <body>
        {tenant ? (
          <TenantProvider tenant={tenant}>
            <ThemeProvider>
              {children}
              <IdleSessionGuard />
            </ThemeProvider>
          </TenantProvider>
        ) : (
          <TenantStatusPage
            reason={resolved.kind === "unavailable" ? resolved.reason : "not-found"}
            name={resolved.kind === "unavailable" ? resolved.name : undefined}
          />
        )}
      </body>
    </html>
  );
}
