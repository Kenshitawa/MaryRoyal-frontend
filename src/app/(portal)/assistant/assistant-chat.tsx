"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, CheckCircle2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { Spinner } from "@/components/base/spinner/spinner";
import { Input } from "@/components/base/input/input";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

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
      <Button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Restore assistant"
        variant="primary"
        iconOnly
        leadingIcon={Sparkles}
        className="fixed bottom-24 start-4 z-40 h-12 w-12 rounded-full shadow-md"
      >
      </Button>
    );
  }

  return (
    <div ref={cardRef} className={cx("overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-sm", family && "learner-chat")}>
      <div className="flex items-center gap-3 border-b border-separator-border bg-background-secondary-default px-4 py-3.5 text-text-primary sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background-primary-default text-foreground-icon-primary">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-medium">Mary Royal Assistant</p>
          <p className="text-caption-1-regular text-text-secondary">Local · private · role-scoped</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => setMinimized(true)}
        >
          Minimize
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={resetChat}
          leadingIcon={RotateCcw}
        >
          Clear
        </Button>
      </div>

      <div
        className="flex h-[min(48dvh,560px)] min-h-[280px] max-h-[720px] flex-col overflow-y-auto bg-background-full px-3 py-4 sm:h-[min(60dvh,650px)] sm:min-h-[360px] sm:px-5"
        aria-live="polite"
        aria-label="Assistant conversation"
      >
        <div className="space-y-4">
          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[86%] rounded-2xl rounded-tr-md bg-accent-100 px-3.5 py-2.5 text-body-regular text-text-primary">
                    {message.text}
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className="flex items-start gap-2.5">
                <span
                  className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-background-secondary-default text-foreground-icon-primary", message.error && "text-text-error-primary")}
                >
                  <Bot size={15} aria-hidden="true" />
                </span>
                <div
                  className={cx("min-w-0 max-w-[88%] rounded-2xl rounded-tl-md border p-3.5 shadow-sm", message.error
                    ? "border-border-error-default bg-background-primary-default text-text-error-primary"
                    : "border-border-button-default bg-background-primary-default text-text-primary")}
                >
                  <p className="text-body-regular leading-relaxed">{message.text}</p>
                  {message.bullets?.length ? (
                    <ul className="mt-2.5 space-y-1.5">
                      {message.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-1.5 text-body-2-regular text-text-secondary">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-foreground-icon-primary" aria-hidden="true" />
                          <span className="min-w-0">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {message.links?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {message.links.map((link) => (
                        <ButtonLink
                          key={`${link.href}:${link.label}`}
                          href={link.href}
                          variant="primary"
                          size="small"
                        >
                          {link.label}
                        </ButtonLink>
                      ))}
                    </div>
                  ) : null}
                  {message.id === lastAssistantId && message.suggestions?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {message.suggestions.map((suggestion) => (
                        <Button
                          key={suggestion}
                          type="button"
                          disabled={loading}
                          onClick={() => void ask(suggestion)}
                          variant="secondary"
                          size="small"
                        >
                          {suggestion}
                        </Button>
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
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-border-button-default bg-background-primary-default px-3.5 py-2.5 text-body-2-regular text-text-secondary">
                <Spinner size="sm" aria-hidden className="text-current" />
                Checking school records…
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-separator-border bg-background-primary-default px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(input);
          }}
          className="flex items-end gap-2"
        >
          <Input
            id="assistant-question"
            aria-label="Ask the assistant a question"
            value={input}
            onChange={(value) => setInput(value.slice(0, 500))}
            placeholder={role === "LEARNER" ? "Ask about marks, homework or games…" : family ? "Ask about fees, attendance or results…" : "Ask about fees, attendance, pending work…"}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send question"
            className="h-11 w-11 shrink-0 p-0"
            iconOnly
            leadingIcon={ArrowUp}
          >
          </Button>
        </form>
        <p className="mt-2 flex items-start gap-1.5 text-caption-1-regular text-text-tertiary">
          <LockKeyhole size={12} className="mt-0.5 shrink-0 text-foreground-icon-secondary" aria-hidden="true" />
          Answers are generated on this server from records your role can already view. No school data is sent to an external AI service.
        </p>
      </div>
    </div>
  );
}
