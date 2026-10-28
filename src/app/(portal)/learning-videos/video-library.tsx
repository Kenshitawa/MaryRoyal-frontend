"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CirclePlay,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  Tv,
  Video,
} from "lucide-react";

type VideoRow = {
  id: string;
  title: string;
  videoId: string;
  grade: string;
  subject: string;
  strand: string;
  subStrand: string | null;
  watched?: boolean;
  watchedAt?: string | null;
  watchCount?: number;
  watchedBy?: Array<{ id: string; name: string; admissionNo: string; grade: string }>;
};

type WeakTopic = { subject: string; strand: string | null };

export default function VideoLibrary({ canManage = false }: { canManage?: boolean }) {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/learning-videos");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load videos.");
    setVideos(data.videos);
    setWeakTopics(data.weakTopics ?? []);
  }, []);

  useEffect(() => {
    void refresh().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Could not load videos.")
    );
  }, [refresh]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/learning-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raw),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add this video.");
      form.reset();
      setShowAdd(false);
      setMessage(`Verified and added to curriculum: ${data.video.title}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify this video.");
    } finally {
      setBusy(false);
    }
  }

  async function markWatched(video: VideoRow) {
    const response = await fetch(`/api/learning-videos/${video.id}/watch`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not save progress.");
      return;
    }
    setVideos((current) =>
      current.map((row) =>
        row.id === video.id ? { ...row, watched: true, watchedAt: data.watchedAt } : row
      )
    );
  }

  const subjects = useMemo(() => {
    return Array.from(new Set(videos.map((v) => v.subject)));
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.subject.toLowerCase().includes(q) ||
        v.strand.toLowerCase().includes(q) ||
        (v.subStrand && v.subStrand.toLowerCase().includes(q));

      const matchesSubj = selectedSubject === "ALL" || v.subject === selectedSubject;
      return matchesSearch && matchesSubj;
    });
  }, [videos, search, selectedSubject]);

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1f44] via-blue-900 to-indigo-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-sm">
              <Tv size={13} />
              Kenya Education Cloud · Edu TV Kenya
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              KICD Video Library
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100">
              Curated, verified educational video lessons from the official Edu TV Kenya channel.
              Videos are aligned with CBC competency strands.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://www.youtube.com/@edutvkenya"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <ExternalLink size={14} />
              Official Channel
            </a>

            {canManage && (
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-xs font-bold text-blue-950 shadow-md transition hover:bg-blue-50 active:scale-95"
              >
                <Plus size={15} />
                {showAdd ? "Close Form" : "Curate Lesson"}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Recommended Topics Strip for Learners */}
      {!canManage && (
        <div className="glass dark:glass-dark rounded-3xl border border-blue-200/80 p-5 shadow-sm dark:border-blue-900/60">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <CirclePlay size={16} />
            </span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recommended Revision Strands
            </h2>
          </div>
          {weakTopics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {weakTopics.map((topic, index) => (
                <span
                  key={`${topic.subject}-${topic.strand}-${index}`}
                  className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                >
                  {topic.subject}
                  {topic.strand ? ` · ${topic.strand}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Your latest CBC released assessments indicate strong mastery. Continue exploring your
              class video resources below.
            </p>
          )}
        </div>
      )}

      {/* Curate Form (Bento Expandable) */}
      {canManage && showAdd && (
        <form
          onSubmit={add}
          className="glass dark:glass-dark rounded-3xl border border-blue-200/70 p-6 shadow-md transition-all sm:p-7 dark:border-blue-900/60"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Plus size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Verify &amp; Add Edu TV Kenya Lesson
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                System verifies YouTube link against the official Edu TV Kenya channel.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                YouTube Video URL <span className="text-blue-600">*</span>
              </label>
              <input
                name="url"
                required
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Grade / Class <span className="text-blue-600">*</span>
              </label>
              <select
                name="grade"
                required
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {["PP1", "PP2", ...Array.from({ length: 9 }, (_, i) => `Grade ${i + 1}`)].map(
                  (grade) => (
                    <option key={grade}>{grade}</option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Learning Area (Subject) <span className="text-blue-600">*</span>
              </label>
              <input
                name="subject"
                required
                minLength={2}
                maxLength={60}
                placeholder="e.g. Mathematics"
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Curriculum Strand <span className="text-blue-600">*</span>
              </label>
              <input
                name="strand"
                required
                minLength={2}
                maxLength={120}
                placeholder="e.g. Numbers &amp; Operations"
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Sub-Strand (Optional)
              </label>
              <input
                name="subStrand"
                maxLength={120}
                placeholder="e.g. Fractions and Decimals"
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
            >
              <ShieldCheck size={15} />
              {busy ? "Verifying Channel…" : "Verify and Add"}
            </button>
          </div>
        </form>
      )}

      {/* Video Cards Grid */}
      <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Verified Lessons ({filteredVideos.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Curated official instructional videos.
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
                placeholder="Search videos…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              />
            </div>

            {subjects.length > 0 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ALL">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="mt-6">
          {filteredVideos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <Video className="mx-auto text-blue-500" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {canManage ? "No verified lessons added" : "No videos found for this topic"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {canManage
                  ? "Paste an Edu TV Kenya URL above to add lessons."
                  : "Your normal class resources and assignments remain available."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {filteredVideos.map((video) => (
                <article
                  key={video.id}
                  className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <iframe
                    loading="lazy"
                    className="aspect-video w-full bg-slate-950"
                    src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0`}
                    title={video.title}
                    allow="encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {video.grade} · {video.subject}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-base font-black text-slate-900 dark:text-white">
                          {video.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {video.strand}
                          {video.subStrand ? ` · ${video.subStrand}` : ""}
                        </p>
                      </div>

                      <span
                        title="Verified against the official Edu TV Kenya channel"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      >
                        <ShieldCheck size={18} />
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                      {!canManage ? (
                        <button
                          onClick={() => void markWatched(video)}
                          disabled={video.watched}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold transition ${
                            video.watched
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-blue-700 text-white shadow-sm hover:bg-blue-800"
                          }`}
                        >
                          {video.watched ? (
                            <>
                              <CheckCircle2 size={13} />
                              Lesson Completed
                            </>
                          ) : (
                            "Mark as Watched"
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {video.watchCount ?? 0} learner views
                          {video.watchedBy?.length
                            ? ` · ${video.watchedBy.map((r) => r.name).join(", ")}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
