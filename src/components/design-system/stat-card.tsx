"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown,
  Users, GraduationCap, CalendarCheck, BookOpen, Wallet, Clock, CircleDollarSign, ClipboardCheck, ShieldCheck
} from "lucide-react";
import { ThemedCard, CardTint } from "./card";

export type StatIconName =
  | "users"
  | "graduation"
  | "calendar"
  | "book"
  | "wallet"
  | "clock"
  | "dollar"
  | "clipboard"
  | "shield";

interface StatCardProps {
  title: string;
  value: string | number;
  note?: string;
  icon?: React.ReactNode;
  iconName?: StatIconName;
  trend?: {
    value: string;
    positive: boolean;
  };
  tint?: CardTint;
  tone?: "blue" | "emerald" | "amber" | "purple" | "rose";
}

const toneStyles = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  purple: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

const iconMap = {
  users: Users,
  graduation: GraduationCap,
  calendar: CalendarCheck,
  book: BookOpen,
  wallet: Wallet,
  clock: Clock,
  dollar: CircleDollarSign,
  clipboard: ClipboardCheck,
  shield: ShieldCheck,
};

export function StatCard({
  title,
  value,
  note,
  icon,
  iconName,
  trend,
  tint = "none",
  tone = "blue"
}: StatCardProps) {
  const numericValue = typeof value === "number" ? value : null;
  const [displayValue, setDisplayValue] = useState<number | string>(
    numericValue !== null ? 0 : value
  );

  useEffect(() => {
    if (numericValue === null) {
      setDisplayValue(value);
      return;
    }
    const duration = 800; // ms
    const steps = 24;
    const increment = numericValue / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(numericValue);
        clearInterval(interval);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [value, numericValue]);

  const IconComp = iconName ? iconMap[iconName] : null;

  return (
    <ThemedCard tint={tint} className="relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {displayValue}
          </p>
        </div>

        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneStyles[tone]}`}>
          {IconComp ? <IconComp size={18} /> : icon ? icon : <span className="h-2 w-2 rounded-full bg-current" />}
        </div>
      </div>

      {(note || trend) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-bold ${
                trend.positive
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {trend.positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {trend.value}
            </span>
          )}
          {note && <span className="truncate">{note}</span>}
        </div>
      )}
    </ThemedCard>
  );
}
