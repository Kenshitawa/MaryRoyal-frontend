"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { ProgressBar } from "@/components/base/progress/progress";

interface ChecklistItem {
  id: string;
  step: number;
  title: string;
  description: string;
  href: string;
  actionText: string;
  completed: boolean;
  role: string;
}

export function DirectorGettingStartedChecklist({
  stats
}: {
  stats: {
    staffCount: number;
    learnerCount: number;
    feeStructuresCount: number;
    examSessionsCount: number;
    attendanceCount: number;
    marksCount: number;
    paymentsCount: number;
  };
}) {
  const [collapsed, setCollapsed] = useState(true);

  const steps: ChecklistItem[] = [
    {
      id: "s1",
      step: 1,
      title: "Set Up Fee Structures & CBC Rubrics",
      description: "Define class term fees, compulsory and optional items, and CBC proficiency standards.",
      href: "/finance/structures",
      actionText: "Configure fee structures",
      completed: stats.feeStructuresCount > 0,
      role: "Director / Head Teacher"
    },
    {
      id: "s2",
      step: 2,
      title: "Create Staff Accounts",
      description: "Provision accounts for Head Teacher, Deputy, Secretary, and Teachers.",
      href: "/accounts",
      actionText: "Manage staff accounts",
      completed: stats.staffCount > 1,
      role: "Director"
    },
    {
      id: "s3",
      step: 3,
      title: "Admit First Learners",
      description: "Secretary completes the 7-step admission wizard, uploads documents, and generates admission numbers.",
      href: "/admissions",
      actionText: "Open admissions pipeline",
      completed: stats.learnerCount > 0,
      role: "Secretary"
    },
    {
      id: "s4",
      step: 4,
      title: "Schedule Term Exam Sessions",
      description: "Deputy sets active exam sessions (Opening, Mid-Term, End-Term) so teachers can enter marks.",
      href: "/assessments",
      actionText: "Manage exam sessions",
      completed: stats.examSessionsCount > 0,
      role: "Deputy Head Teacher"
    },
    {
      id: "s5",
      step: 5,
      title: "Take Daily Class Attendance",
      description: "Class teachers mark morning attendance registers with present, absent, and late tallies.",
      href: "/attendance",
      actionText: "View attendance overview",
      completed: stats.attendanceCount > 0,
      role: "Teachers"
    },
    {
      id: "s6",
      step: 6,
      title: "Enter CBC Assessment Marks",
      description: "Subject teachers record competency scores and descriptors for active exam sessions.",
      href: "/assessments",
      actionText: "Review assessments",
      completed: stats.marksCount > 0,
      role: "Teachers"
    },
    {
      id: "s7",
      step: 7,
      title: "Record Fee Collections",
      description: "The finance team issues term invoices and records M-Pesa, Cash, or Bank receipts.",
      href: "/finance",
      actionText: "Open finance desk",
      completed: stats.paymentsCount > 0,
      role: "Finance team"
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const remainingSteps = steps.filter(step => !step.completed);
  if (progressPercent >= 100) return null;

  return (
    <section className="dashboard-panel overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs" aria-label="School setup guide">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 dark:bg-blue-500/20 dark:text-blue-300 dark:border dark:border-blue-400/30">
            <Sparkles size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-headline-medium text-text-primary">School setup guide</h2>
            <p className="text-body-2-regular text-text-secondary">
              {completedCount} of {steps.length} steps complete ({progressPercent}%)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border-button-default bg-background-primary-default dark:bg-slate-800/60 px-3 text-body-2-medium text-text-primary transition-colors hover:bg-background-primary-hover active:bg-background-primary-active outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          {collapsed ? "Show steps" : "Hide"}
          {collapsed ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3 p-4 sm:p-5">
          <ProgressBar label="Setup progress" value={progressPercent} size="sm" />
          <ol className="divide-y divide-separator-border">
          {remainingSteps.map((step) => (
            <li key={step.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 size={18} className="text-state-success-text" aria-hidden="true" />
                  ) : (
                    <Circle size={18} className="text-foreground-icon-tertiary" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-body-medium text-text-primary">
                    <span className="text-text-tertiary">Step {step.step}.</span> {step.title}
                  </p>
                  <p className="mt-0.5 text-body-2-regular text-text-secondary">{step.description}</p>
                  <p className="mt-1 text-caption-1-regular text-text-tertiary">{step.role}</p>
                </div>
              </div>
              <Link
                href={step.href}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-button-primary px-4 text-body-2-semibold text-text-white outline-none transition-colors hover:brightness-[1.06] active:brightness-95 focus-visible:ring-2 focus-visible:ring-border-focus-ring sm:w-auto"
              >
                {step.actionText}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
          </ol>
        </div>
      )}
    </section>
  );
}
