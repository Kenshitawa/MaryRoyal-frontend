"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{ notify: (message: string, tone?: ToastTone) => void }>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++counter.current;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[95] flex flex-col items-center gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end">
        {items.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? TriangleAlert : Info;
          return (
            <div
              key={item.id}
              className={`toast pointer-events-auto w-full max-w-sm ${item.tone === "success" ? "toast-success" : item.tone === "error" ? "toast-error" : ""}`}
              role="status"
            >
              <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{item.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
