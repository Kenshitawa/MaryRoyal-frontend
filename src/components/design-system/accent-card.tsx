"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

interface AccentCardProps {
  title: string;
  description: string;
  actionText: string;
  actionHref: string;
  icon?: React.ReactNode;
  badge?: string;
  className?: string;
}

export function AccentCard({
  title,
  description,
  actionText,
  actionHref,
  icon,
  badge,
  className = ""
}: AccentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#102653] via-[#173d80] to-[#1d4ed8] p-6 text-white shadow-xl shadow-blue-950/15 ${className}`}
    >
      {/* Background ambient lighting effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-400/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"
      />

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-3">
            {badge && (
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-100 backdrop-blur">
                {badge}
              </span>
            )}
            {icon && (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
                {icon}
              </div>
            )}
          </div>

          <h3 className="mt-4 text-xl font-extrabold tracking-tight text-white">
            {title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-blue-100/90 font-medium">
            {description}
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <Link
            href={actionHref}
            className="group inline-flex items-center gap-2 text-xs font-bold text-white transition hover:text-blue-200"
          >
            <span>{actionText}</span>
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
