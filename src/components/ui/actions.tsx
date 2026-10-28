import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

const actionBase = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger" };
const variants = {
  primary: "bg-blue-700 text-white shadow-sm hover:bg-blue-800",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  quiet: "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
  danger: "bg-rose-700 text-white hover:bg-rose-800",
};

export function Button({ className = "", variant = "secondary", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${actionBase} ${variants[variant]} ${className}`} {...props} />;
}

export function IconButton({ ariaLabel, className = "", type = "button", children, ...props }: ButtonProps & { ariaLabel: string; children: ReactNode }) {
  return <button type={type} aria-label={ariaLabel} className={`${actionBase} p-0 ${className}`} {...props}>{children}</button>;
}

type LinkButtonProps = { href: string; children: ReactNode; className?: string; variant?: "primary" | "secondary" | "quiet" | "danger"; ariaLabel?: string };
export function LinkButton({ href, children, className = "", variant = "secondary", ariaLabel }: LinkButtonProps) {
  return <Link href={href} aria-label={ariaLabel} className={`${actionBase} ${variants[variant]} ${className}`}>{children}</Link>;
}

export function Chip({ children, className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold ${className}`} {...props}>{children}</span>;
}

export function MenuItem({ children, className = "", ...props }: ButtonProps) {
  return <Button variant="quiet" className={`w-full justify-start ${className}`} {...props}>{children}</Button>;
}
