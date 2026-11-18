"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { NotificationCenter, type NotificationCenterItem } from "@/components/application/notification-center/notification-center";


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

export default function NotificationBell() {
  const router = useRouter();
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
  const boardNotifications: NotificationCenterItem[] = notifications.map((item) => ({
    id: item.id,
    category: item.type === "ACTION" ? "activity" : "system",
    group: new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(item.createdAt)),
    title: item.title,
    description: item.message,
    timestamp: timeAgo(item.createdAt),
    unread: !item.read,
    status: item.type === "SUCCESS" ? "success" : item.type === "WARNING" ? "error" : item.type === "ACTION" ? "information" : "neutral",
    actions: [
      ...(item.link ? [{ id: "open", label: "Open", variant: "secondary" as const }] : []),
      ...(item.actionRequired && !item.actionDone ? [{ id: "done", label: "Mark done", variant: "primary" as const }] : []),
    ],
  }));

  async function act(notificationId: string, actionId: string) {
    const item = notifications.find((notification) => notification.id === notificationId);
    if (!item) return;
    if (actionId === "done") {
      await markDone(item.id);
      return;
    }
    await markRead(item.id);
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  }

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
        <div className="absolute end-0 top-12 z-50 w-[min(430px,calc(100vw-1rem))]">
          <NotificationCenter
            title="Notifications"
            emptyMessage="No notifications yet"
            notifications={boardNotifications}
            onAction={(notificationId, actionId) => void act(notificationId, actionId)}
            onMarkAllRead={() => void markAllRead()}
            className="max-w-none"
          />
          {actionRequired.length > 0 ? <p className="sr-only">{actionRequired.length} notifications need your action.</p> : null}
          <button type="button" onClick={() => setOpen(false)} className="sr-only">Close notifications</button>
        </div>
      )}
    </div>
  );
}
