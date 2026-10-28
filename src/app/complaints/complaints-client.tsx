"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Inbox,
  LifeBuoy,
  MessageCircle,
  MessageSquare,
  Search,
  Send,
  Sparkles,
} from "lucide-react";

type Child = { id: string; name: string; grade: string };
type Reply = {
  id: string;
  message: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
};
type Complaint = {
  id: string;
  subject: string;
  category: string;
  audience: string;
  status: string;
  reporterName: string | null;
  createdAt: string;
  openedBy: { id: string; name: string; role: string };
  assignedTo: { id: string; name: string; role: string } | null;
  replies: Reply[];
};

const recipientOptions = [
  { role: "HEAD_TEACHER", label: "Head Teacher" },
  { role: "DIRECTOR", label: "Director" },
  { role: "BOTH", label: "Both school leaders" },
];

const statusLabels: Record<string, string> = {
  RECEIVED: "Received",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
};

export default function ComplaintsClient({
  role,
  userId,
  userName,
  learners,
}: {
  role: string;
  userId: string;
  userName: string;
  learners: Child[];
}) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [childId, setChildId] = useState(learners[0]?.id ?? "");
  const [category, setCategory] = useState("OTHER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipientRole, setRecipientRole] = useState("HEAD_TEACHER");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [allLearners, setAllLearners] = useState<Child[]>([]);
  const isParent = role === "PARENT";
  const isSecretary = role === "SECRETARY";
  const canCompose = isParent || isSecretary;

  const refresh = useCallback(async () => {
    const response = await fetch("/api/complaints");
    if (response.ok) {
      const data = await response.json();
      setComplaints(data.complaints);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Secretary needs to load all learners
    if (isSecretary) {
      fetch("/api/learners?take=100").then(r => r.ok ? r.json() : null).then(d => { if (d?.learners) setAllLearners(d.learners); }).catch(() => {});
    }
  }, [refresh, isSecretary]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject,
          message,
          recipientRole,
          learnerId: childId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("");
      setSubject("");
      setCategory("OTHER");
      setShowCompose(false);
      setNotice(isSecretary ? "Complaint recorded and forwarded to school leadership." : "Your concern was securely delivered to school leadership.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Concern could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function reply(complaint: Complaint) {
    const text = replies[complaint.id]?.trim();
    if (!text) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/complaints/${complaint.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReplies((old) => ({ ...old, [complaint.id]: "" }));
      setNotice("Your reply was posted and notified.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(complaint: Complaint, status: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/complaints/${complaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Concern marked ${statusLabels[status].toLowerCase()}.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Status could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.subject.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.reporterName && c.reporterName.toLowerCase().includes(q)) ||
        c.openedBy.name.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchesCategory = categoryFilter === "ALL" || c.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [complaints, search, statusFilter, categoryFilter]);

  // Metrics
  const total = complaints.length;
  const inReview = complaints.filter((c) => c.status === "IN_REVIEW").length;
  const resolved = complaints.filter((c) => c.status === "RESOLVED").length;
  const received = complaints.filter((c) => c.status === "RECEIVED").length;

  return (
    <main className="mx-auto max-w-6xl p-4 pb-28 sm:p-7">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-sm">
              <LifeBuoy size={13} />
              Mary Royal Support Desk
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Parent Concerns & Feedback
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100">
              {isParent
                ? "Confidential communications with the Head Teacher and Director. Your dialogue is private and tracked to resolution."
                : "Triage and respond to private concerns submitted by parents and guardians. Decisions and responses are audited."}
            </p>
          </div>

          {canCompose && (
            <button
              onClick={() => setShowCompose(!showCompose)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-blue-900 shadow-md transition hover:bg-blue-50 active:scale-95"
            >
              <MessageSquare size={16} />
              {showCompose ? "Close Form" : isSecretary ? "Log a Complaint" : "Share a Concern"}
            </button>
          )}
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Threads
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <Inbox size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{total}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">All registered inquiries</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Awaiting Action
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700 dark:text-blue-400">{received}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Awaiting leadership intake</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              In Review
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <MessageCircle size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {inReview}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Dialogue active</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Resolved
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {resolved}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Successfully concluded</p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-xs font-semibold text-blue-900 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Compose Form (Expandable Bento) */}
      {canCompose && showCompose && (
        <form
          onSubmit={create}
          className="glass dark:glass-dark mt-6 rounded-3xl border border-blue-200/70 p-6 shadow-md transition-all sm:p-7 dark:border-blue-900/60"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isSecretary ? "Log a Complaint or Concern" : "Share a Concern or Feedback"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isSecretary ? "Log a complaint received from a parent or guardian. It will be routed to school leadership." : "Your message is sent directly and privately to school leadership."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Learner Concerned <span className="text-blue-600">*</span>
              </label>
              <select
                required
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Choose learner…</option>
                {(isSecretary ? allLearners : learners).map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} · {child.grade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Send To <span className="text-blue-600">*</span>
              </label>
              <select
                value={recipientRole}
                onChange={(e) => setRecipientRole(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {recipientOptions.map((item) => (
                  <option key={item.role} value={item.role}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Category <span className="text-blue-600">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="ACADEMIC">Learning and Academics</option>
                <option value="FEES">Fee and Billing</option>
                <option value="SAFETY">Campus Safety</option>
                <option value="WELLBEING">Learner Wellbeing</option>
                <option value="OTHER">General Inquiry</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Subject <span className="text-blue-600">*</span>
            </label>
            <input
              required
              minLength={3}
              maxLength={120}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Detailed Description <span className="text-blue-600">*</span>
            </label>
            <textarea
              required
              minLength={5}
              maxLength={2500}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please provide specifics so school leadership can look into this promptly…"
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs font-medium text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCompose(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !childId}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Send size={14} />
              {busy ? "Sending…" : "Submit Concern"}
            </button>
          </div>
        </form>
      )}

      {/* Main Threads Section */}
      <section className="glass dark:glass-dark mt-6 rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        {/* Filters Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic, category, or reporter…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
            />
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto">
            {/* Status pills */}
            <div className="flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-900/60">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                  statusFilter === "ALL"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter("RECEIVED")}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                  statusFilter === "RECEIVED"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Received
              </button>
              <button
                onClick={() => setStatusFilter("IN_REVIEW")}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                  statusFilter === "IN_REVIEW"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                In Review
              </button>
              <button
                onClick={() => setStatusFilter("RESOLVED")}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                  statusFilter === "RESOLVED"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Resolved
              </button>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="ALL">All Categories</option>
              <option value="ACADEMIC">Academics</option>
              <option value="FEES">Fees</option>
              <option value="SAFETY">Safety</option>
              <option value="WELLBEING">Wellbeing</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Complaint Cards */}
        <div className="mt-6 space-y-4">
          {filteredComplaints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <CheckCircle2 className="mx-auto text-blue-500" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {isParent ? "No concerns filed" : "Inbox is completely clear"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isParent
                  ? "If you ever have feedback or need assistance, submit a message above."
                  : "All inquiries have been reviewed or resolved."}
              </p>
            </div>
          ) : (
            filteredComplaints.map((complaint) => {
              const status = complaint.status;
              const statusPillClass =
                status === "RESOLVED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : status === "IN_REVIEW"
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300";

              return (
                <article
                  key={complaint.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-700 uppercase dark:bg-blue-950/60 dark:text-blue-300">
                          {complaint.category.replaceAll("_", " ")}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          From {complaint.reporterName ?? complaint.openedBy.name}
                        </span>
                      </div>
                      <h2 className="mt-1.5 text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {complaint.subject}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Audience:{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {complaint.audience === "BOTH"
                            ? "Head Teacher & Director"
                            : complaint.assignedTo?.name ?? complaint.audience.replaceAll("_", " ")}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${statusPillClass}`}
                      >
                        {status === "RESOLVED" ? (
                          <CheckCircle2 size={12} />
                        ) : status === "IN_REVIEW" ? (
                          <MessageCircle size={12} />
                        ) : (
                          <Clock size={12} />
                        )}
                        {statusLabels[complaint.status] ?? complaint.status}
                      </span>

                      {!isParent && (
                        <select
                          aria-label={`Update ${complaint.subject} status`}
                          value={complaint.status}
                          disabled={busy}
                          onChange={(e) => void setStatus(complaint, e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          <option value="RECEIVED">Received</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Threaded replies */}
                  <div className="mt-5 space-y-3 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-950/40">
                    {complaint.replies.map((item) => {
                      const isMe = item.author.id === userId;
                      return (
                        <div
                          key={item.id}
                          className={`max-w-[90%] rounded-2xl p-4 shadow-xs sm:max-w-[80%] ${
                            isMe
                              ? "ml-auto bg-gradient-to-r from-blue-700 to-indigo-700 text-white"
                              : "bg-white text-slate-900 border border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
                            <span>
                              {item.author.name}{" "}
                              <span
                                className={`font-normal ${
                                  isMe ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                ({item.author.role.replaceAll("_", " ")})
                              </span>
                            </span>
                            <time
                              className={`text-[10px] ${
                                isMe ? "text-blue-200" : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {new Intl.DateTimeFormat("en-KE", {
                                dateStyle: "short",
                                timeStyle: "short",
                                timeZone: "Africa/Nairobi",
                              }).format(new Date(item.createdAt))}
                            </time>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed">
                            {item.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply Input for leadership or parent */}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={replies[complaint.id] ?? ""}
                      onChange={(e) =>
                        setReplies((old) => ({ ...old, [complaint.id]: e.target.value }))
                      }
                      maxLength={2500}
                      placeholder={
                        isParent ? "Send a follow-up message…" : "Write an official reply…"
                      }
                      className="min-h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      disabled={busy || !replies[complaint.id]?.trim()}
                      onClick={() => void reply(complaint)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-blue-700 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                    >
                      <Send size={14} />
                      Reply
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <p className="pt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        Signed in as {userName} ({role.replaceAll("_", " ")}). Confidential records are audited
        under Mary Royal School safeguarding policy.
      </p>
    </main>
  );
}
