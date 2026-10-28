"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trash2,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Settings,
  X,
} from "lucide-react";
import { LearnerLink } from "@/components/learner-link";

interface AdmissionRecord {
  id: string;
  admissionNo: string;
  status: string;
  currentStep: number;
  updatedAt: string | Date;
  submittedAt?: string | Date | null;
  learner?: { id: string; name: string; grade: string } | null;
  documents: { category: string }[];
}

interface AdmissionsClientProps {
  initialAdmissions: AdmissionRecord[];
  canDelete: boolean;
  canConfigureRetention: boolean;
  retentionNotice: string | null;
  initialRetentionDays: number;
}

export function AdmissionsClient({
  initialAdmissions,
  canDelete,
  canConfigureRetention,
  retentionNotice,
  initialRetentionDays,
}: AdmissionsClientProps) {
  const router = useRouter();
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>(initialAdmissions);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Single delete modal state
  const [singleTarget, setSingleTarget] = useState<AdmissionRecord | null>(null);

  // Bulk delete modal state
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Retention setting modal state
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [retentionDays, setRetentionDays] = useState(initialRetentionDays);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [activeNotice, setActiveNotice] = useState(retentionNotice);

  const draftRecords = admissions.filter((r) => r.status === "DRAFT");
  const allDraftsSelected = draftRecords.length > 0 && draftRecords.every((r) => selectedIds.includes(r.id));

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  function toggleSelectAll() {
    if (allDraftsSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(draftRecords.map((r) => r.id));
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  async function handleSingleDelete() {
    if (!singleTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admissions/${singleTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to delete draft.", "error");
      } else {
        showToast(`Draft admission ${singleTarget.admissionNo} deleted permanently.`);
        setAdmissions((prev) => prev.filter((r) => r.id !== singleTarget.id));
        setSelectedIds((prev) => prev.filter((id) => id !== singleTarget.id));
        setSingleTarget(null);
        router.refresh();
      }
    } catch {
      showToast("Network error while deleting draft.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admissions/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to delete selected drafts.", "error");
      } else {
        showToast(`Deleted ${data.count} draft admission(s) permanently.`);
        setAdmissions((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
        setSelectedIds([]);
        setShowBulkModal(false);
        router.refresh();
      }
    } catch {
      showToast("Network error while deleting drafts.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRetention(e: React.FormEvent) {
    e.preventDefault();
    setRetentionSaving(true);
    try {
      const res = await fetch("/api/admissions/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftRetentionDays: retentionDays }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Retention settings updated.");
        setActiveNotice(
          retentionDays > 0
            ? `Notice: Automatic cleanup is configured. Inactive drafts untouched for more than ${retentionDays} days will be permanently purged.`
            : null
        );
        setShowRetentionModal(false);
      } else {
        showToast(data.error || "Could not save retention setting.", "error");
      }
    } catch {
      showToast("Network error updating retention policy.", "error");
    } finally {
      setRetentionSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-white shadow-xl transition animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === "success" ? "bg-emerald-700" : "bg-rose-700"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Auto-cleanup retention notice banner */}
      {activeNotice && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{activeNotice}</span>
          </div>
          {canConfigureRetention && (
            <button
              onClick={() => setShowRetentionModal(true)}
              className="text-[11px] font-bold underline hover:text-amber-700 shrink-0"
            >
              Configure
            </button>
          )}
        </div>
      )}

      {/* Action Bar: Bulk Selection & Retention Settings */}
      {canDelete && draftRecords.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={allDraftsSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Select all drafts ({draftRecords.length})</span>
            </label>

            {selectedIds.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {selectedIds.length} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition"
              >
                <Trash2 size={13} />
                Delete Selected ({selectedIds.length})
              </button>
            )}

            {canConfigureRetention && (
              <button
                onClick={() => setShowRetentionModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                title="Configure automatic draft cleanup policy"
              >
                <Settings size={13} />
                Auto-Cleanup
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table List with Delete Actions */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="hidden grid-cols-[auto_1.1fr_1.5fr_.8fr_.7fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:grid dark:border-slate-800 dark:bg-slate-800/50">
          <span className="w-5"></span>
          <span>Admission</span>
          <span>Learner</span>
          <span>Documents</span>
          <span>Updated</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {admissions.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {admissions.map((record) => {
              const isDraft = record.status === "DRAFT";
              const isSelected = selectedIds.includes(record.id);

              return (
                <div
                  key={record.id}
                  className={`grid gap-2 px-4 py-4 transition sm:grid-cols-[auto_1.1fr_1.5fr_.8fr_.7fr_1fr_auto] sm:items-center sm:gap-4 sm:px-5 ${
                    isSelected
                      ? "bg-blue-50/70 dark:bg-blue-950/40"
                      : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <div className="w-5">
                    {canDelete && isDraft && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(record.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Select draft ${record.admissionNo}`}
                      />
                    )}
                  </div>

                  <div>
                    {record.learner ? (
                      <LearnerLink id={record.learner.id} admissionNo={record.admissionNo} />
                    ) : (
                      <Link
                        href={`/admissions/${record.id}`}
                        className="font-mono text-xs font-bold text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {record.admissionNo}
                      </Link>
                    )}
                  </div>

                  <div>
                    {record.learner ? (
                      <LearnerLink id={record.learner.id} name={record.learner.name} />
                    ) : (
                      <Link
                        href={`/admissions/${record.id}`}
                        className="text-xs font-bold text-slate-900 hover:underline dark:text-white"
                      >
                        Admission draft
                      </Link>
                    )}
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {record.learner?.grade ?? `Step ${record.currentStep} of 7`}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {record.documents.length} document{record.documents.length === 1 ? "" : "s"}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Intl.DateTimeFormat("en-KE", {
                      dateStyle: "medium",
                      timeZone: "Africa/Nairobi",
                    }).format(new Date(record.updatedAt))}
                  </p>

                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                        record.status === "DRAFT"
                          ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          : record.status === "SUBMITTED"
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {record.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {canDelete && isDraft && (
                      <button
                        onClick={() => setSingleTarget(record)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition"
                        title={`Delete draft ${record.admissionNo}`}
                        aria-label={`Delete draft ${record.admissionNo}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}

                    <Link
                      href={`/admissions/${record.id}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition"
                      aria-label={`Open admission ${record.admissionNo}`}
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500">
            No admission records found matching current criteria.
          </div>
        )}
      </div>

      {/* Single Delete Confirmation Dialog */}
      {singleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Admission Draft</h3>
                <p className="text-xs text-slate-500">Draft #{singleTarget.admissionNo}</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete draft <strong>{singleTarget.admissionNo}</strong>
              {singleTarget.learner?.name ? ` for ${singleTarget.learner.name}` : ""}?
            </p>

            <div className="mt-3 rounded-xl bg-rose-50 p-3 text-[11px] font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              ⚠️ This action cannot be undone. All uploaded private documents for this draft will be permanently deleted and the reserved admission number will be released.
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSingleTarget(null)}
                disabled={loading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSingleDelete()}
                disabled={loading}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Yes, Delete Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Selected Drafts</h3>
                <p className="text-xs text-slate-500">{selectedIds.length} drafts selected</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete all <strong>{selectedIds.length}</strong> selected admission drafts?
            </p>

            <div className="mt-3 rounded-xl bg-rose-50 p-3 text-[11px] font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              ⚠️ This action cannot be undone. All associated private document files will be permanently purged and admission numbers will be released.
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                disabled={loading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={loading}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {loading ? "Deleting..." : `Delete ${selectedIds.length} Drafts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatic Cleanup Settings Dialog */}
      {showRetentionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Draft Retention Policy</h3>
              </div>
              <button
                onClick={() => setShowRetentionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Configure automatic cleanup of abandoned admission drafts untouched for more than N days. Set to 0 to disable automatic cleanup.
            </p>

            <form onSubmit={handleSaveRetention} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Retention Window (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {retentionDays === 0
                    ? "Automatic cleanup is currently OFF."
                    : `Drafts inactive for more than ${retentionDays} days will be purged with prior warning banner.`}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRetentionModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={retentionSaving}
                  className="rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {retentionSaving ? "Saving..." : "Save Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
