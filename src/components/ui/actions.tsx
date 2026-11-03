import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

const variants = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  soft: "btn btn-soft",
  quiet: "btn btn-ghost",
  danger: "btn btn-danger",
};
export type ButtonVariant = keyof typeof variants;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "sm" };

export function Button({ className = "", variant = "secondary", size = "md", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${variants[variant]} ${size === "sm" ? "btn-sm" : ""} ${className}`} {...props} />;
}

export function IconButton({ ariaLabel, className = "", type = "button", children, ...props }: ButtonProps & { ariaLabel: string; children: ReactNode }) {
  return (
    <button type={type} aria-label={ariaLabel} className={`icon-btn ${className}`} {...props}>
      {children}
    </button>
  );
}

type LinkButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  ariaLabel?: string;
  prefetch?: boolean;
  scroll?: boolean;
};
export function LinkButton({ href, children, className = "", variant = "secondary", ariaLabel, prefetch, scroll }: LinkButtonProps) {
  return (
    <Link href={href} aria-label={ariaLabel} prefetch={prefetch} scroll={scroll} className={`${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Chip({ children, className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`pill ${className}`} {...props}>{children}</span>;
}

export function MenuItem({ children, className = "", ...props }: ButtonProps) {
  return <Button variant="quiet" className={`w-full justify-start ${className}`} {...props}>{children}</Button>;
}
