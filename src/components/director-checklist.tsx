"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

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
  if (progressPercent >= 100) return null;

  return (
    <section className="card overflow-hidden p-0" aria-label="School setup guide">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-brand px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15">
            <Sparkles size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-title font-semibold">School setup guide</h2>
            <p className="text-caption text-white/80">
              {completedCount} of {steps.length} steps complete ({progressPercent}%)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-label font-semibold text-white hover:bg-white/25"
        >
          {collapsed ? "Show steps" : "Hide"}
          {collapsed ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
        </button>
      </div>

      {!collapsed && (
        <ol className="divide-y divide-line-soft bg-surface">
          {steps.map((step) => (
            <li key={step.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 size={18} className="text-success" aria-hidden="true" />
                  ) : (
                    <Circle size={18} className="text-ink-3" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-body font-semibold text-ink">
                    <span className="text-ink-3">Step {step.step}.</span> {step.title}
                  </p>
                  <p className="mt-0.5 text-label text-ink-2">{step.description}</p>
                  <p className="mt-1 text-caption text-ink-3">{step.role}</p>
                </div>
              </div>
              {step.completed ? null : (
              <Link
                href={step.href}
                className={`btn btn-sm shrink-0 sm:self-center ${step.completed ? "btn-secondary" : "btn-primary"} w-full sm:w-auto`}
              >
                {step.actionText}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
