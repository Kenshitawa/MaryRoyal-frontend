"use client";

import React, { createContext, useContext } from "react";
import type { TenantConfig } from "@/lib/tenant";

const TenantContext = createContext<TenantConfig>({
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
});

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: TenantConfig;
  children: React.ReactNode;
}) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext);
}
