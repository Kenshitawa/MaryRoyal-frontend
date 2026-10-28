"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Clock, Save, Shield } from "lucide-react";

type Staff = { id: string; name: string; role: string; staffNumber: string | null };
type Status = "PRESENT" | "ABSENT" | "LATE";

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default function StaffAttendanceClient({ staff }: { staff: Staff[] }) {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/attendance/staff?date=${date}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) {
          setStatus(
            Object.fromEntries(
              (data.records as Array<{ staffId: string; status: Status }>).map((row) => [
                row.staffId,
                row.status,
              ])
            )
          );
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : "Could not load the staff register."
          );
        }
      });
    return () => {
      active = false;
    };
  }, [date]);

  const summary = useMemo(
    () =>
      Object.values(status).reduce(
        (counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }),
        {} as Record<string, number>
      ),
    [status]
  );

  function markAllStaff(val: Status) {
    const updated: Record<string, Status> = {};
    staff.forEach((s) => {
      updated[s.id] = val;
    });
    setStatus(updated);
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const records = staff
        .filter((person) => status[person.id])
        .map((person) => ({
          staffId: person.id,
          status: status[person.id],
          note: note || undefined,
        }));
      const response = await fetch("/api/attendance/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, records }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`Staff attendance verified and saved for ${data.records.length} personnel.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Staff attendance could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm sm:p-7 dark:border-slate-800/80">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300">
              <Shield size={12} />
              Faculty Register
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Staff & Educator Attendance
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Record leadership, teaching faculty, and administrative daily check-in status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            aria-label="Attendance date"
            value={date}
            max={today()}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />

          <button
            type="button"
            onClick={() => markAllStaff("PRESENT")}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            <Check size={12} />
            All Present
          </button>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 size={12} />
          Present: {summary.PRESENT ?? 0}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <Clock size={12} />
          Late: {summary.LATE ?? 0}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
          Absent: {summary.ABSENT ?? 0}
        </span>
      </div>

      {/* Staff Rows */}
      <div className="mt-5">
        {!staff.length ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No active staff accounts registered.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white/70 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
            {staff.map((person) => {
              const currentStatus = status[person.id];
              return (
                <div
                  key={person.id}
                  className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">
                        {person.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {person.role.replaceAll("_", " ")}
                        {person.staffNumber ? ` · ID: ${person.staffNumber}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 self-end sm:self-auto dark:border-slate-800 dark:bg-slate-950/60">
                    {(["PRESENT", "LATE", "ABSENT"] as const).map((value) => {
                      const isSelected = currentStatus === value;
                      const activeColor =
                        value === "ABSENT"
                          ? "bg-red-600 text-white"
                          : value === "LATE"
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-600 text-white";

                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setStatus((curr) => ({ ...curr, [person.id]: value }))}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            isSelected
                              ? `${activeColor} shadow-sm`
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          }`}
                        >
                          {value[0] + value.slice(1).toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note and Save Row */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="staff-attendance-note" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Register Annotation / Log Note (Optional)
          </label>
          <input
            id="staff-attendance-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={240}
            placeholder="e.g. Science department on authorized field excursion"
            className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <button
          type="button"
          disabled={busy || Object.keys(status).length === 0}
          onClick={() => void save()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save size={15} />
          {busy ? "Saving…" : "Save Staff Register"}
        </button>
      </div>

      {message && (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3.5 text-xs font-semibold text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          {message}
        </div>
      )}
    </section>
  );
}
