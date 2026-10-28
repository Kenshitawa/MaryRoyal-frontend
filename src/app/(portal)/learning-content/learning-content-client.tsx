"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  BookOpenCheck,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Plus,
  Search,
  Tag,
  Video,
} from "lucide-react";

type Assignment = { grade: string; subject: string };
type Resource = {
  id: string;
  title: string;
  description: string;
  grade: string;
  subject: string;
  kind: string;
  url: string;
  createdAt: string;
  teacher: { name: string };
};

export default function LearningContentClient({
  assignments,
}: {
  assignments: Assignment[];
}) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [grade, setGrade] = useState(assignments[0]?.grade ?? "");
  const [subject, setSubject] = useState(assignments[0]?.subject ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("VIDEO");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("ALL");

  const subjects = useMemo(
    () => assignments.filter((item) => item.grade === grade).map((item) => item.subject),
    [assignments, grade]
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/learning/resources");
    if (response.ok) setResources((await response.json()).resources);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/learning/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, title, description, kind, url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTitle("");
      setDescription("");
      setUrl("");
      setShowCreate(false);
      setMessage("Classroom resource successfully published.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Resource could not be published.");
    } finally {
      setBusy(false);
    }
  }

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.grade.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);

      const matchesKind = kindFilter === "ALL" || r.kind === kindFilter;
      return matchesSearch && matchesKind;
    });
  }, [resources, search, kindFilter]);

  const videoCount = resources.filter((r) => r.kind === "VIDEO").length;
  const readingCount = resources.filter((r) => r.kind === "READING").length;

  return (
    <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-sm">
              <BookOpenCheck size={13} />
              Educational Media Library
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Classroom Learning Resources
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100">
              Share curated videos, CBC revision links, and digital readings with your classes.
              Learners only see content approved for their specific grade level.
            </p>
          </div>

          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl hero-cta bg-white px-5 text-xs font-bold text-blue-950 shadow-md transition hover:bg-blue-50 active:scale-95"
          >
            <Plus size={15} />
            {showCreate ? "Close Publisher" : "Publish Resource"}
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Resources
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <BookOpen size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {resources.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active class materials</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Video Lessons
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Video size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
              {videoCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">YouTube, Vimeo, MP4</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Readings &amp; Sheets
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {readingCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">CBC study notes</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assigned Subjects
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <Tag size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700 dark:text-purple-400">
              {assignments.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your teaching schedule</p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-xs font-semibold text-blue-900 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Publish Form (Expandable Bento) */}
      {showCreate && (
        <form
          onSubmit={create}
          className="glass dark:glass-dark mt-6 rounded-3xl border border-blue-200/70 p-6 shadow-md transition-all sm:p-7 dark:border-blue-900/60"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Plus size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Publish Learning Material
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Learners in this class will see this resource on their learning dashboard.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Grade / Class <span className="text-blue-600">*</span>
              </label>
              <select
                required
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  setSubject(
                    assignments.find((item) => item.grade === e.target.value)?.subject ?? ""
                  );
                }}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {[...new Set(assignments.map((item) => item.grade))].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Learning Area (Subject) <span className="text-blue-600">*</span>
              </label>
              <select
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {subjects.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Resource Format <span className="text-blue-600">*</span>
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="VIDEO">Video (YouTube / Vimeo / MP4)</option>
                <option value="READING">Reading / Worksheet</option>
                <option value="LINK">Reference Link</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Resource Title <span className="text-blue-600">*</span>
            </label>
            <input
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CBC Science: Water Cycle & Rain Formation"
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Learning Objectives &amp; Description <span className="text-blue-600">*</span>
            </label>
            <textarea
              required
              minLength={5}
              maxLength={500}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain briefly what competencies learners will gain from this material…"
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              HTTPS URL Link <span className="text-blue-600">*</span>
            </label>
            <input
              required
              type="url"
              pattern="https://.*"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={busy || !grade || !subject}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Plus size={14} />
              {busy ? "Publishing…" : "Publish to Learners"}
            </button>
          </div>
        </form>
      )}

      {/* Resources Cards Section */}
      <section className="glass dark:glass-dark mt-6 rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Shared Classroom Library
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Educational links and media active for your learners.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              />
            </div>

            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="ALL">All Types</option>
              <option value="VIDEO">Videos</option>
              <option value="READING">Readings</option>
              <option value="LINK">Links</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          {filteredResources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <BookOpenCheck className="mx-auto text-blue-500" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                No resources found
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Publish a video or lesson link using the button above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredResources.map((resource) => (
                <article
                  key={resource.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                        {resource.kind === "VIDEO" ? (
                          <Video size={18} />
                        ) : resource.kind === "READING" ? (
                          <FileText size={18} />
                        ) : (
                          <LinkIcon size={18} />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {resource.grade} · {resource.subject}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {resource.kind}
                          </span>
                        </div>
                        <h3 className="mt-1 font-black text-slate-900 dark:text-white">
                          {resource.title}
                        </h3>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {resource.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Shared by {resource.teacher.name}
                    </span>

                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                    >
                      <ExternalLink size={13} />
                      Open Resource
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
