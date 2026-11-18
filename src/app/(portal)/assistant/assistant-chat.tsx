"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, CheckCircle2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { Spinner } from "@/components/base/spinner/spinner";

type ReplyLink = { label: string; href: string };
type AssistantPayload = {
  reply: string;
  bullets: string[];
  links: ReplyLink[];
  suggestions: string[];
  provider: "local";
};
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  bullets?: string[];
  links?: ReplyLink[];
  suggestions?: string[];
  error?: boolean;
};

const staffPrompts = [
  "What fees are pending?",
  "Attendance today",
  "Anything waiting for approval?",
  "Marks waiting for review",
];

const learnerPrompts = ["My marks", "My attendance", "What homework is left?", "Practice games"];

const parentPrompts = ["Fee balance", "Attendance", "Latest results", "Any messages?"];

export function AssistantChat({ firstName, role }: { firstName: string; role: string }) {
  const family = role === "LEARNER" || role === "PARENT";
  const defaultPrompts = role === "LEARNER" ? learnerPrompts : role === "PARENT" ? parentPrompts : staffPrompts;
  const welcome = family
    ? role === "LEARNER"
      ? `Hello ${firstName}. Ask me about your marks, attendance, homework or practice games. I only read your own linked records.`
      : `Hello ${firstName}. Ask me about fees, attendance, results or messages for your children. I only read the children linked to your account.`
    : `Hello ${firstName}. Ask me anything about the school — fees, attendance, learners, marks, staff or where to find a page. I read the live records your role can already open.`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: welcome,
      suggestions: defaultPrompts,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!cardRef.current) return;
      if (cardRef.current.contains(event.target as Node)) return;
      setMinimized(true);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function nextId(prefix: string) {
    counter.current += 1;
    return `${prefix}-${counter.current}`;
  }

  function resetChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: welcome,
        suggestions: defaultPrompts,
      },
    ]);
    setInput("");
    setLoading(false);
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;

    setMessages((current) => [...current, { id: nextId("you"), role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await response.json().catch(() => null)) as (AssistantPayload & { error?: string }) | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "The assistant could not answer that. Try again.");
      }
      setMessages((current) => [
        ...current,
        {
          id: nextId("bot"),
          role: "assistant",
          text: data.reply,
          bullets: data.bullets,
          links: data.links,
          suggestions: data.suggestions,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: nextId("bot"),
          role: "assistant",
          text: error instanceof Error ? error.message : "The assistant could not answer that. Try again.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Restore assistant"
        className="fixed bottom-24 left-4 z-40 grid h-12 w-12 place-items-center rounded-full royal-panel text-white shadow-2xl shadow-black/30 transition hover:scale-105"
      >
        <Sparkles size={22} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div ref={cardRef} className={`overflow-hidden rounded-3xl border border-line bg-surface shadow-xl shadow-slate-950/5 ${family ? "learner-chat" : ""}`}>
      <div className={`flex items-center gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 ${family ? "bg-[#174b91]" : "royal-panel"}`} style={family ? undefined : { textShadow: "0 2px 10px rgb(0 0 0 / 0.35)" }}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/12 ring-1 ring-white/20">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-bold">Mary Royal Assistant</p>
          <p className="text-caption text-blue-100">Local · private · read-only</p>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-blue-50 transition hover:bg-white/20"
        >
          Minimize
        </button>
        <button
          type="button"
          onClick={resetChat}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-blue-50 transition hover:bg-white/20"
        >
          <RotateCcw size={12} aria-hidden="true" />
          Clear
        </button>
      </div>

      <div
        className="flex h-[min(60dvh,650px)] min-h-[360px] max-h-[720px] flex-col overflow-y-auto bg-sky-50/60 px-3 py-4 sm:px-5 dark:bg-slate-950/40"
        aria-live="polite"
        aria-label="Assistant conversation"
      >
        <div className="space-y-4">
          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[86%] rounded-2xl rounded-tr-md bg-gradient-to-br from-blue-700 to-indigo-700 px-3.5 py-2.5 text-body text-white shadow-md shadow-blue-900/20">
                    {message.text}
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className="flex items-start gap-2.5">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-sm ${
                    message.error ? "bg-rose-600" : "bg-gradient-to-br from-blue-600 to-indigo-700"
                  }`}
                >
                  <Bot size={15} aria-hidden="true" />
                </span>
                <div
                  className={`min-w-0 max-w-[88%] rounded-2xl rounded-tl-md border p-3.5 shadow-sm ${
                    message.error
                      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  <p className="text-body leading-relaxed">{message.text}</p>
                  {message.bullets?.length ? (
                    <ul className="mt-2.5 space-y-1.5">
                      {message.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-1.5 text-label text-ink-2">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
                          <span className="min-w-0">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {message.links?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {message.links.map((link) => (
                        <Link
                          key={`${link.href}:${link.label}`}
                          href={link.href}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          {link.label}
                          <span aria-hidden="true">→</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {message.id === lastAssistantId && message.suggestions?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {message.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          disabled={loading}
                          onClick={() => void ask(suggestion)}
                          className="rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 transition hover:border-brand-line hover:text-ink disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {loading ? (
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
                <Bot size={15} aria-hidden="true" />
              </span>
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5 text-label text-ink-2 shadow-sm">
                <Spinner size="sm" aria-hidden className="text-current" />
                Checking school records…
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-line bg-surface px-3 py-3 sm:px-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(input);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="assistant-question" className="sr-only">
            Ask the assistant a question
          </label>
          <textarea
            id="assistant-question"
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 500))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            maxLength={500}
            placeholder={role === "LEARNER" ? "Ask about marks, homework or games…" : family ? "Ask about fees, attendance or results…" : "Ask about fees, attendance, pending work…"}
            className="input max-h-28 min-h-11 flex-1 resize-none py-2.5"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send question"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-900/20 transition hover:from-blue-500 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </form>
        <p className="mt-2 flex items-start gap-1.5 text-caption text-ink-3">
          <LockKeyhole size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          Answers are generated on this server from records your role can already view. No school data is sent to an external AI service.
        </p>
      </div>
    </div>
  );
}
