"use client";

import type { FormEvent } from "react";
import { useTenant } from "@/components/tenant-provider";

export default function ConfirmLogoutForm({ className, buttonClassName }: { className?: string; buttonClassName: string }) {
  const tenant = useTenant();

  function confirmLogout(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`Sign out of ${tenant.name}?`)) event.preventDefault();
  }

  return (
    <form action="/api/logout" method="post" className={className} onSubmit={confirmLogout}>
      <button className={buttonClassName}>Sign out</button>
    </form>
  );
}
