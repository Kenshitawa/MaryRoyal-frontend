"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, X, Clock, AlertCircle, Info, Zap } from "lucide-react";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  actionRequired: boolean;
  actionDone: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const typeIcon: Record<string, React.ReactNode> = {
  INFO: <Info size={14} className="text-blue-500" />,
  SUCCESS: <Check size={14} className="text-emerald-500" />,
  WARNING: <AlertCircle size={14} className="text-amber-500" />,
  ACTION: <Zap size={14} className="text-rose-500" />,
};

const typeBg: Record<string, string> = {
  INFO: "bg-blue-50 dark:bg-blue-950/30",
  SUCCESS: "bg-emerald-50 dark:bg-emerald-950/30",
  WARNING: "bg-amber-50 dark:bg-amber-950/30",
  ACTION: "bg-rose-50 dark:bg-rose-950/30",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(id);
  }, [load]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read-all" }) });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function markDone(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "done" }) });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true, actionDone: true } : n));
    setUnread((c) => Math.max(0, c - 1));
  }

  const actionRequired = notifications.filter((n) => n.actionRequired && !n.actionDone);

  return (
    <div className="relative" ref={panelRef}>
      <button
        id="notification-bell"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        onClick={() => { setOpen((o) => !o); if (!open) void load(); }}
        className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-700 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[350px] rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-blue-700" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} title="Mark all read" className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-blue-700">
                  <CheckCheck size={12} /> All read
                </button>
              )}
              <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Action required badge */}
          {actionRequired.length > 0 && (
            <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 dark:border-rose-900/30 dark:bg-rose-950/20">
              <p className="text-[11px] font-bold text-rose-700">
                ⚡ {actionRequired.length} item{actionRequired.length > 1 ? "s" : ""} require your action
              </p>
            </div>
          )}

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell size={28} className="text-slate-200" />
                <p className="text-xs text-slate-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`relative border-b border-slate-50 px-4 py-3 transition last:border-0 dark:border-slate-800 ${!n.read ? typeBg[n.type] ?? "bg-blue-50" : "bg-white dark:bg-slate-900"}`}
                >
                  {!n.read && <span className="absolute right-4 top-3.5 h-1.5 w-1.5 rounded-full bg-blue-600" />}
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">{typeIcon[n.type] ?? typeIcon.INFO}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-900 dark:text-white">{n.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{n.message}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock size={9} />{timeAgo(n.createdAt)}
                        </span>
                        {n.link && (
                          <Link href={n.link} onClick={() => { void markRead(n.id); setOpen(false); }}
                            className="text-[10px] font-semibold text-blue-700 hover:underline">
                            View →
                          </Link>
                        )}
                        {n.actionRequired && !n.actionDone && (
                          <button onClick={() => void markDone(n.id)} className="flex items-center gap-1 rounded-md bg-blue-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-blue-800">
                            <Check size={9} /> Done
                          </button>
                        )}
                        {!n.read && (
                          <button onClick={() => void markRead(n.id)} className="text-[10px] text-slate-400 hover:text-blue-700">
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
