"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { useTheme } from "./theme-provider";

export type CardTint = "none" | "sky" | "mint" | "lavender" | "amber";

interface ThemedCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  tint?: CardTint;
  hoverLift?: boolean;
}

const tintStyles: Record<CardTint, string> = {
  none: "",
  sky: "bg-sky-50/70 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30",
  mint: "bg-emerald-50/70 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
  lavender: "bg-indigo-50/70 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30",
  amber: "bg-amber-50/70 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30",
};

export function ThemedCard({
  children,
  className = "",
  tint = "none",
  hoverLift = true,
  ...props
}: ThemedCardProps) {
  const { style } = useTheme();

  const baseStyle =
    style === "glass"
      ? "glass-card text-slate-900 dark:text-white"
      : "bento-card text-slate-900 dark:text-white";

  const tintClass = tintStyles[tint];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hoverLift ? { y: -3 } : undefined}
      className={`${baseStyle} ${tintClass} p-5 sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function BentoCard({
  children,
  className = "",
  tint = "none",
  ...props
}: ThemedCardProps) {
  const tintClass = tintStyles[tint];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -3 }}
      className={`bento-card ${tintClass} p-5 sm:p-6 text-slate-900 dark:text-white ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function GlassCard({
  children,
  className = "",
  tint = "none",
  ...props
}: ThemedCardProps) {
  const tintClass = tintStyles[tint];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -3 }}
      className={`glass-card ${tintClass} p-5 sm:p-6 text-slate-900 dark:text-white ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
