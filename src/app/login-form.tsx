"use client";

import { useState, type FormEvent } from "react";
import {
  RiAlertLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLock2Line,
  RiMailLine,
} from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Spinner } from "@/components/base/spinner/spinner";
import { cx } from "@/utils/cx";

type IconProps = {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

function LoadingIcon({ className }: IconProps) {
  return <Spinner size="sm" aria-hidden className={cx(className, "text-current")} />;
}

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
        headers: { "content-type": "application/json" },
      });
      const result = await response.json();
      if (response.ok) {
        location.href = result.forcePasswordChange
          ? "/change-password"
          : "/dashboard";
      } else {
        setError(
          result.error ?? "Unable to sign in. Check your details and try again.",
        );
      }
    } catch {
      setError("We could not connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 flex flex-col gap-4"
      aria-busy={busy}
    >
      <Input
        isRequired
        label="Email address"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="name@maryroyal.ac.ke"
        leadingIcon={RiMailLine}
        fieldClassName="min-h-14 py-1"
      />

      <Input
        isRequired
        label="Password"
        name="password"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Enter your password"
        leadingIcon={RiLock2Line}
        fieldClassName="min-h-14 py-1"
        trailingAddon={
          <Button
            type="button"
            variant="ghost"
            iconOnly
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            leadingIcon={showPassword ? RiEyeOffLine : RiEyeLine}
            className="size-11 rounded-lg p-0"
            onClick={() => setShowPassword((value) => !value)}
          />
        }
      />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-border-error-default bg-background-tertiary-error p-3 text-body-2-regular text-text-error-primary"
        >
          <RiAlertLine
            className="mt-0.5 size-4 shrink-0 text-foreground-icon-error"
            aria-hidden
          />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        aria-busy={busy}
        leadingIcon={busy ? LoadingIcon : undefined}
        className="mt-1 min-h-11 w-full"
      >
        {busy ? "Signing you in…" : "Sign in securely"}
      </Button>
    </form>
  );
}
