import { TenantStatusPage, type TenantStatusReason } from "@/components/tenant-status-page";

const REASONS = new Set<TenantStatusReason>(["no-school", "not-found", "suspended", "tenant-mismatch"]);

export default async function TenantStatus({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const params = await searchParams;
  const reason = REASONS.has(params.reason as TenantStatusReason)
    ? (params.reason as TenantStatusReason)
    : "not-found";
  return <TenantStatusPage reason={reason} />;
}
