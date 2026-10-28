"use client";

import type { FormEvent } from "react";

export default function ConfirmLogoutForm({ className, buttonClassName }: { className?: string; buttonClassName: string }) {
  function confirmLogout(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Sign out of Mary Royal School?")) event.preventDefault();
  }
  return <form action="/api/logout" method="post" className={className} onSubmit={confirmLogout}>
    <button className={buttonClassName}>Sign out</button>
  </form>;
}
