"use client";

import { useState } from "react";
import { RiArrowRightLine, RiEyeLine, RiEyeOffLine, RiLoader2Line } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { InputBase } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }), headers: { "content-type": "application/json" } });
      const result = await response.json();
      if (response.ok) location.href = result.forcePasswordChange ? "/change-password" : "/dashboard";
      else setError(result.error ?? "Unable to sign in. Check your details and try again.");
    } catch { setError("We could not connect. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email" isRequired>Email address</Label>
        <InputBase
          id="login-email"
          required
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          dir="ltr"
          className="px-3 text-body-regular"
          fieldClassName="min-h-11 w-full rounded-xl"
          placeholder="name@maryroyal.ac.ke"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password" isRequired>Password</Label>
        <InputBase
          id="login-password"
          required
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          className="px-3 text-body-regular"
          fieldClassName="min-h-11 w-full rounded-xl"
          placeholder="Enter your password"
          trailingAddon={
            <Button
              type="button"
              variant="ghost"
              size="small"
              iconOnly
              leadingIcon={showPassword ? RiEyeOffLine : RiEyeLine}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            />
          }
        />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error p-3 text-body-regular text-text-error-primary">
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={busy}
        aria-live="polite"
        aria-busy={busy}
        data-loading={busy ? "true" : "false"}
        leadingIcon={busy ? RiLoader2Line : undefined}
        trailingIcon={busy ? undefined : RiArrowRightLine}
        className="min-h-12 w-full [&>svg:first-child]:motion-safe:animate-spin"
      >
        {busy ? (
          "Signing you in…"
        ) : (
          "Sign in securely"
        )}
      </Button>
    </form>
  );
}
