"use client";

import { useEffect, useMemo, useState } from "react";
import { LearnerLink } from "@/components/learner-link";
import {
  AlertCircle,
  HeartHandshake,
  Link2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

type Account = { id: string; name: string; email: string; role: string };
type Learner = { id: string; name: string; admissionNo: string; grade: string };
type Link = {
  id: string;
  user: { name: string; email: string; role: string };
  learner: { id?: string; name: string; admissionNo: string; grade: string };
  relation: string;
};

export default function GuardianLinks() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [userId, setUserId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const [a, l, g] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/learners?take=100"),
        fetch("/api/guardians"),
      ]);
      if (a.ok) {
        const x = await a.json();
        setAccounts(x.accounts.filter((u: Account) => ["PARENT", "LEARNER"].includes(u.role)));
      }
      if (l.ok) {
        const x = await l.json();
        setLearners(x.learners);
      }
      if (g.ok) {
        const x = await g.json();
        setLinks(x.links);
      }
    } catch {
      setMessage("Could not load family linkage records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedAccount = accounts.find((a) => a.id === userId);
      const res = await fetch("/api/guardians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          learnerId,
          relation: selectedAccount?.role === "PARENT" ? "Parent" : "Learner",
        }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Family access link established and audited." : data.error);
      if (res.ok) {
        setUserId("");
        setLearnerId("");
        await load();
      }
    } catch {
      setMessage("Failed to connect to link endpoint.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        "Sever this account-to-learner link? The parent/guardian will immediately lose portal access to this child's data."
      )
    )
      return;
    try {
      const res = await fetch("/api/guardians", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Family link removed." : data.error);
      if (res.ok) await load();
    } catch {
      setMessage("Failed to remove relationship link.");
    }
  }

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.user.name.toLowerCase().includes(q) ||
        l.user.email.toLowerCase().includes(q) ||
        l.learner.name.toLowerCase().includes(q) ||
        l.learner.admissionNo.toLowerCase().includes(q)
    );
  }, [links, search]);

  return (
    <section className="glass dark:glass-dark mt-8 rounded-3xl border border-slate-200/80 p-6 shadow-sm sm:p-7 dark:border-slate-800/80">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/60 dark:text-indigo-400">
            <HeartHandshake size={20} />
          </span>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Family & Guardian Portal Access
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only explicitly linked parent accounts can review a child’s CBC records, attendance,
              and fee statements.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/70 px-3 py-1 text-xs font-bold text-indigo-800 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300">
          <Users size={12} />
          {links.length} Active {links.length === 1 ? "Link" : "Links"}
        </span>
      </div>

      {message && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs font-semibold text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300"
        >
          <AlertCircle size={15} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Linking Form */}
      <form
        onSubmit={add}
        className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4.5 sm:p-5 dark:border-slate-800 dark:bg-slate-900/40"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Connect Parent to Learner
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Parent or Learner Account
            </label>
            <select
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 shadow-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role}) — {a.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Learner Profile
            </label>
            <select
              required
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 shadow-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Select learner…</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.admissionNo}) — {l.grade}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              disabled={saving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
            >
              <Plus size={15} />
              {saving ? "Linking…" : "Authorize Link"}
            </button>
          </div>
        </div>
      </form>

      {/* Links List */}
      <div className="mt-6">
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Active Relationship Links
          </h3>

          <div className="relative w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter links…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Loading relationships…
          </div>
        ) : filteredLinks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No family links found matching criteria.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLinks.map((link) => (
              <div
                key={link.id}
                className="flex flex-col gap-3 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Link2 size={14} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {link.user.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {link.user.role}
                      </span>
                      <span className="text-xs text-slate-400">linked to</span>
                      <LearnerLink
                        id={link.learner.id || link.learner.admissionNo}
                        name={link.learner.name}
                        admissionNo={link.learner.admissionNo}
                        subtext={link.learner.grade}
                        className="inline-flex"
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {link.user.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => void remove(link.id)}
                  className="inline-flex items-center gap-1.5 self-start rounded-xl border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 sm:self-auto dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <Trash2 size={12} />
                  Sever Access
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
