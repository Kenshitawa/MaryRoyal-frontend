"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, PenLine, Send, Users } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea/textarea";
import { Spinner } from "@/components/base/spinner/spinner";
import { Card, PageHeader } from "@/components/ui/primitives";
import { cx } from "@/utils/cx";

type Person = { id: string; name: string; grade: string };
type Writer = { id: string; name: string; role: string };
type DiaryReply = { id: string; message: string; createdAt: string; author: Writer };
type DiaryEntry = { id: string; subject: string; message: string; createdAt: string; learner: Person; author: Writer; replies: DiaryReply[] };

const WRITERS = new Set(["DIRECTOR", "HEAD_TEACHER", "SECRETARY", "TEACHER"]);
const GRADES = ["PP1", "PP2", ...Array.from({ length: 9 }, (_, index) => `Grade ${index + 1}`)];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(value));
}

export default function DiaryClient({ role }: { role: string }) {
  const canWrite = WRITERS.has(role);
  const isParent = role === "PARENT";
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [learners, setLearners] = useState<Person[]>([]);
  const [selectedLearner, setSelectedLearner] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("PP1");
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/diary", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The diary could not be loaded.");
      setEntries(data.entries ?? []);
      setLearners(data.learners ?? []);
      if (data.learners?.length) {
        setSelectedGrade(data.learners[0].grade);
        setSelectedLearner(data.learners[0].id);
      } else setSelectedLearner("");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The diary could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const gradeLearners = learners.filter((learner) => learner.grade === selectedGrade);

  useEffect(() => { void load(); }, [load]);

  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLearner || !subject.trim() || !message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/diary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ learnerId: selectedLearner, subject, message }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The diary message could not be sent.");
      setSubject("");
      setMessage("");
      setNotice("Diary message sent to the linked parent account.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The diary message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(entryId: string) {
    const reply = replyDrafts[entryId]?.trim();
    if (!reply || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/diary/${encodeURIComponent(entryId)}/replies`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: reply }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Your reply could not be sent.");
      setReplyDrafts((current) => ({ ...current, [entryId]: "" }));
      setNotice("Your reply was sent to the school.");
      await load();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Your reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 px-3 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:py-8">
      <PageHeader title="Family diary" help={isParent ? "Messages from Mary Royal School about your linked learner. Reply here to continue the conversation." : "Write a private school message for a learner’s linked parent account."} />

      {notice ? <p role="status" className="rounded-xl border border-border-button-default bg-background-secondary-default p-3 text-body-2-medium text-text-primary">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error p-3 text-body-2-regular text-text-error-primary">{error}</p> : null}

      {canWrite ? <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-text-primary">
          <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background-secondary-default text-foreground-icon-primary"><BookOpen size={18} aria-hidden="true" /></span>
          <div><h2 className="text-headline-medium">Write to a parent</h2><p className="text-caption-1-regular text-text-secondary">Only this learner’s linked parent accounts can see the message.</p></div>
          </div>
          <Button type="button" variant={composeOpen ? "secondary" : "primary"} leadingIcon={PenLine} onClick={() => setComposeOpen((open) => !open)} aria-expanded={composeOpen} aria-controls="diary-compose">
            {composeOpen ? "Close message" : "Write message"}
          </Button>
        </div>
        {composeOpen ? <form id="diary-compose" onSubmit={submitEntry} className="space-y-3 border-t border-separator-border pt-3">
          <Select label="Grade" selectedKey={selectedGrade} onSelectionChange={(key) => { const grade = String(key); setSelectedGrade(grade); setSelectedLearner(learners.find((learner) => learner.grade === grade)?.id ?? ""); }} triggerClassName="w-full" popoverClassName="w-(--trigger-width)">
            {GRADES.map((grade) => <SelectItem key={grade} id={grade}>{grade}</SelectItem>)}
          </Select>
          <Select label="Learner" selectedKey={selectedLearner || null} onSelectionChange={(key) => setSelectedLearner(String(key))} isDisabled={!gradeLearners.length} triggerClassName="w-full" popoverClassName="w-(--trigger-width)">
            {gradeLearners.map((learner) => <SelectItem key={learner.id} id={learner.id}>{learner.name}</SelectItem>)}
          </Select>
          {!gradeLearners.length ? <p className="rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">No active learners are available in {selectedGrade}. Choose another grade or ask the office to complete learner admissions.</p> : null}
          <Input label="Subject" value={subject} onChange={setSubject} maxLength={120} isRequired />
          <Textarea label="Diary message" value={message} onChange={setMessage} rows={3} maxLength={3000} isRequired />
          <Button type="submit" disabled={busy || !gradeLearners.length || !selectedLearner || !subject.trim() || !message.trim()} aria-busy={busy} leadingIcon={busy ? undefined : Send} className="w-full sm:w-auto">
            {busy ? <><Spinner size="sm" aria-hidden className="text-current" /> Sending…</> : "Send to parent"}
          </Button>
        </form> : null}
      </Card> : null}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-title-3-semibold text-text-primary">{isParent ? "Messages from school" : "Recent diary messages"}</h2>
        {!isParent ? <span className="inline-flex items-center gap-1.5 text-caption-1-regular text-text-secondary"><Users size={14} aria-hidden="true" />Class and role access</span> : null}
      </div>

      {loading ? <Card className="flex items-center justify-center gap-2 p-8 text-body-2-regular text-text-secondary"><Spinner size="sm" aria-hidden /> Loading diary…</Card> : entries.length === 0 ? <Card className="space-y-2 p-6 text-center">
        <BookOpen size={24} className="mx-auto text-foreground-icon-tertiary" aria-hidden="true" />
        <p className="text-body-medium text-text-primary">{isParent ? "No diary messages yet" : "No diary messages to show"}</p>
        <p className="text-body-2-regular text-text-secondary">{isParent ? "New messages from the school will appear here." : "Messages you send to parents will appear here with their replies."}</p>
      </Card> : <div className="space-y-3">
        {entries.map((entry) => <Card key={entry.id} className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><p className="text-body-medium text-text-primary">{entry.subject}</p><p className="text-caption-1-regular text-text-secondary">{entry.learner.name} · {entry.learner.grade}</p></div>
            <time className="shrink-0 text-caption-1-regular text-text-tertiary">{dateLabel(entry.createdAt)}</time>
          </div>
          <div className="rounded-2xl rounded-ss-md bg-background-secondary-default p-3 text-body-regular text-text-primary">
            <p className="whitespace-pre-wrap">{entry.message}</p>
            <p className="mt-2 text-caption-1-regular text-text-secondary">{entry.author.name} · {entry.author.role.replaceAll("_", " ")}</p>
          </div>
          {entry.replies.map((reply) => <div key={reply.id} className={cx("rounded-2xl p-3 text-body-2-regular text-text-primary", reply.author.role === "PARENT" ? "ms-6 bg-accent-50" : "me-6 bg-background-secondary-default")}>
            <p className="whitespace-pre-wrap">{reply.message}</p>
            <p className="mt-2 text-caption-1-regular text-text-secondary">{reply.author.role === "PARENT" ? "Parent" : reply.author.name} · {dateLabel(reply.createdAt)}</p>
          </div>)}
          {isParent ? <div className="space-y-2 border-t border-separator-border pt-3">
            <Textarea aria-label={`Reply to ${entry.subject}`} placeholder="Write a reply to the school…" value={replyDrafts[entry.id] ?? ""} onChange={(value) => setReplyDrafts((current) => ({ ...current, [entry.id]: value.slice(0, 2000) }))} rows={2} maxLength={2000} />
            <div className="flex justify-end"><Button type="button" variant="secondary" size="small" disabled={busy || !replyDrafts[entry.id]?.trim()} onClick={() => void submitReply(entry.id)} leadingIcon={Send}>Reply</Button></div>
          </div> : null}
        </Card>)}
      </div>}
    </section>
  );
}
