"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";

/**
 * Shared sign-out control. Every entry point uses the same blurred
 * confirmation so signing out is deliberate on desktop and mobile alike.
 */
export default function ConfirmLogoutForm({
  className,
  buttonClassName,
  serviceName = "Mary Royal School",
  ariaLabel,
  title,
  children,
}: {
  className?: string;
  buttonClassName: string;
  serviceName?: string;
  ariaLabel?: string;
  title?: string;
  children?: ReactNode;
}) {
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [open, busy]);

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError("Sign out could not be completed. Please try again.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("The sign-out request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={className}>
        <button type="button" aria-label={ariaLabel} title={title} className={buttonClassName} onClick={() => { setError(""); setOpen(true); }}>
          {children ?? "Sign out"}
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-md">
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            aria-describedby={`${dialogId}-description`}
            className="w-full max-w-sm rounded-3xl border border-border-button-default bg-background-primary-default p-5 text-text-primary shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger" aria-hidden="true">
                <LogOut size={18} />
              </span>
              <div className="min-w-0">
                <h2 id={`${dialogId}-title`} className="text-title-3-semibold">Sign out of {serviceName}?</h2>
                <p id={`${dialogId}-description`} className="mt-1 text-body-2-regular text-text-secondary">
                  You will need to sign in again to access the portal.
                </p>
              </div>
            </div>
            {error ? <p role="alert" className="mt-3 text-body-2-medium text-text-error-primary">{error}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button ref={cancelRef} type="button" disabled={busy} className="btn btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={() => void signOut()}>
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
