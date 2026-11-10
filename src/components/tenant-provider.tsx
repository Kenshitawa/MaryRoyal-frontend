"use client";

import React, { createContext, useContext } from "react";
import { DEMO_FALLBACK_TENANT, type TenantConfig } from "@/lib/tenant-types";

const TenantContext = createContext<TenantConfig>(DEMO_FALLBACK_TENANT);

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
