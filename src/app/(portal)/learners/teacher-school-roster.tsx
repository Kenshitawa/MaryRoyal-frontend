"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { PageHeader } from "@/components/ui/primitives";
import { InlineLoader } from "@/components/ui/loader";

type Learner = { id: string; name: string; grade: string };

export default function TeacherSchoolRoster() {
  const [query, setQuery] = useState("");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (search: string, nextCursor?: string | null) => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ take: "50" });
      if (search.trim()) params.set("q", search.trim());
      if (nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(`/api/learners?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Learner list could not be loaded.");
      setLearners((current) => nextCursor ? [...current, ...result.learners] : result.learners);
      setCursor(result.nextCursor ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Learner list could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(query), 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  return (
    <section className="mx-auto max-w-7xl space-y-4 p-4 pb-8 sm:p-6 md:p-8">
      <PageHeader title="School learner roster" help="All active learners. This view shows names and grades only; private profile details remain restricted." />
      <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
        <Input label="Search learner name or grade" value={query} onChange={setQuery} placeholder="Name or grade" />
        {error && <p role="alert" className="mt-3 text-body-2-regular text-text-error-primary">{error}</p>}
        {busy && learners.length === 0 ? <div className="mt-4"><InlineLoader label="Loading school roster…" /></div> : (
          <ul className="mt-4 divide-y divide-separator-border">
            {learners.map((learner) => <li key={learner.id} className="flex items-center justify-between gap-3 py-3"><span className="text-body-medium text-text-primary">{learner.name}</span><span className="rounded-full bg-background-secondary-default px-3 py-1 text-caption-1-semibold text-text-secondary">{learner.grade}</span></li>)}
          </ul>
        )}
        {!busy && learners.length === 0 && <p className="mt-4 text-body-2-regular text-text-secondary">No matching learners.</p>}
        {cursor && <div className="mt-4"><Button variant="secondary" onClick={() => void load(query, cursor)} disabled={busy}>{busy ? "Loading…" : "Load more learners"}</Button></div>}
      </div>
    </section>
  );
}
