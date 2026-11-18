"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Sparkles, Volume2, VolumeX, X } from "lucide-react";

const MUTE_KEY = "learner-guide-muted";

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function pageGuide(pathname: string): string {
  const target = pathname.toLowerCase();
  if (target.startsWith("/learning")) return "This is My Learning! Tap Assignments to see your homework.";
  if (target.startsWith("/assignments")) return "Here are your assignments. Tap one to open it!";
  if (target.startsWith("/learning-videos")) return "Video time! Pick one and watch carefully.";
  if (target.startsWith("/library")) return "These are your books. Tap one to open it!";
  if (target.startsWith("/timetable")) return "This is your timetable for the week.";
  if (target.includes("fee")) return "This page is about school fees. A grown-up can help you here.";
  if (target.startsWith("/profile")) return "This is your profile page.";
  if (target.startsWith("/dashboard")) return "This is your dashboard — your whole day at a glance!";
  if (target.startsWith("/portal")) return "Welcome to your school portal!";
  if (target.startsWith("/attendance")) return "This shows your attendance record.";
  return "Let's explore this page together — I'm right here!";
}

const TOUCH_RULES: Array<[RegExp, string]> = [
  [/assignment/i, "Let's check this assignment together!"],
  [/video|watch/i, "Ooh, a video! Watch and listen carefully."],
  [/timetable/i, "Here's what your day looks like!"],
  [/fee|pay|balance/i, "Fees help our school run. Ask a grown-up to help here."],
  [/sign out|log ?out/i, "See you soon, buddy!"],
  [/profile|menu/i, "That's your profile menu."],
  [/search/i, "Looking for something? Type it here!"],
  [/notification/i, "These are your updates!"],
  [/back/i, "Let's go back safely."],
  [/submit|save|mark|done|turn in|open/i, "Great job pressing that!"],
];

const CHEERS = [
  "Good tap!",
  "Let's explore this together!",
  "Ooh, nice choice!",
  "You're doing great!",
  "I'm right here with you!",
];

function lineFor(label: string, name: string): string {
  const clean = label.trim();
  if (!clean) return CHEERS[Math.floor(Math.random() * CHEERS.length)];
  for (const [pattern, line] of TOUCH_RULES) {
    if (pattern.test(clean)) return line;
  }
  if (/help|guide|royal|robot/i.test(clean)) return "That's me! Hi!";
  const lower = clean.toLowerCase();
  if (lower.includes(name.toLowerCase())) return `Yes, ${firstNameOf(name)}? I'm listening!`;
  return CHEERS[Math.floor(Math.random() * CHEERS.length)];
}

function accessibleLabel(element: Element): string {
  const html = element as HTMLElement;
  const aria = html.getAttribute("aria-label") ?? html.getAttribute("title");
  if (aria) return aria;
  if (html instanceof HTMLInputElement) {
    const label = html.labels?.[0]?.textContent?.trim();
    return label ?? html.placeholder ?? "";
  }
  return (html.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
}

function playPop() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    if (context.state === "suspended") {
      void context.close();
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(480, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(740, context.currentTime + 0.09);
    gain.gain.setValueAtTime(0.05, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
    oscillator.onended = () => void context.close();
  } catch {
    /* sound is a bonus; never block on it */
  }
}

export function LearnerGuide({ name }: { name: string }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);
  const [pulse, setPulse] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const aliveRef = useRef(false);
  const mutedRef = useRef(false);
  const lastLineRef = useRef("");
  const lineTokenRef = useRef(0);
  const typeTimerRef = useRef<number | null>(null);
  const lastReactRef = useRef(0);
  const pathnameRef = useRef(pathname);
  const firstPathRef = useRef<string | null>(null);
  const pumpRef = useRef<() => void>(() => {});

  const firstName = firstNameOf(name);

  const speakLine = useCallback((text: string, onDone: () => void) => {
    const token = (lineTokenRef.current += 1);
    lastLineRef.current = text;
    if (typeTimerRef.current) {
      window.clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
    setTyped("");
    const finish = () => {
      if (lineTokenRef.current !== token) return;
      setTyped(text);
      if (typeTimerRef.current) {
        window.clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
      }
      onDone();
    };
    if (mutedRef.current || !("speechSynthesis" in window)) {
      // Silent typewriter keeps the pace of speech without sound.
      const step = Math.max(18, Math.min(42, Math.round(1500 / Math.max(text.length, 1))));
      let shown = 0;
      typeTimerRef.current = window.setInterval(() => {
        if (lineTokenRef.current !== token) {
          if (typeTimerRef.current) window.clearInterval(typeTimerRef.current);
          typeTimerRef.current = null;
          return;
        }
        shown += 2;
        setTyped(text.slice(0, shown));
        if (shown >= text.length) {
          if (typeTimerRef.current) window.clearInterval(typeTimerRef.current);
          typeTimerRef.current = null;
          onDone();
        }
      }, step);
      return;
    }
    const synth = window.speechSynthesis;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.65;
    const voices = synth.getVoices();
    const kidVoice =
      voices.find((voice) => /kid|child|junior/i.test(voice.name)) ??
      voices.find((voice) => /female|zira|susan|samantha|hazel|aria|libby/i.test(voice.name) && voice.lang.toLowerCase().startsWith("en")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
    if (kidVoice) utterance.voice = kidVoice;
    let boundarySeen = false;
    utterance.onboundary = (event) => {
      if (lineTokenRef.current !== token) return;
      boundarySeen = true;
      const end = event.charIndex + (event.charLength || 0);
      if (end > 0) setTyped(text.slice(0, Math.min(text.length, end)));
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    try {
      synth.speak(utterance);
    } catch {
      finish();
      return;
    }
    // Some engines never fire word boundaries; fall back to timed typing.
    window.setTimeout(() => {
      if (boundarySeen || lineTokenRef.current !== token) return;
      const step = Math.max(22, Math.min(55, Math.round(1700 / Math.max(text.length, 1))));
      let shown = 0;
      typeTimerRef.current = window.setInterval(() => {
        shown += 2;
        setTyped(text.slice(0, shown));
        if (shown >= text.length && typeTimerRef.current) {
          window.clearInterval(typeTimerRef.current);
          typeTimerRef.current = null;
        }
      }, step);
    }, 800);
  }, []);

  const pump = useCallback(() => {
    if (busyRef.current || !aliveRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    speakLine(next, () => {
      busyRef.current = false;
      window.setTimeout(() => pumpRef.current(), 320);
    });
  }, [speakLine]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const say = useCallback((lines: string | string[], interrupt = false) => {
    if (!aliveRef.current) return;
    const list = Array.isArray(lines) ? lines : [lines];
    if (interrupt) {
      queueRef.current = [];
      busyRef.current = false;
      if (typeTimerRef.current) {
        window.clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    }
    queueRef.current.push(...list);
    pumpRef.current();
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Lifecycle: alive flag + global cleanup.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (typeTimerRef.current) window.clearInterval(typeTimerRef.current);
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Mount only: the launcher waits for the learner; nothing pops up on its own.
  useEffect(() => {
    setMounted(true);
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Route changes: keep guiding while the bubble is open.
  useEffect(() => {
    if (!mounted || !open) return;
    if (firstPathRef.current === null) {
      firstPathRef.current = pathname;
      return;
    }
    if (firstPathRef.current === pathname) return;
    firstPathRef.current = pathname;
    say(pageGuide(pathname), true);
  }, [mounted, open, pathname, say]);

  // React to anything the learner touches on the page.
  useEffect(() => {
    if (!mounted || !open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      const interactive = target.closest("a[href], button, [role='button'], [role='link'], input, select, textarea, label, summary, [role='checkbox'], [role='radio']");
      if (!interactive) return;
      // Navigating links are covered by the route-change announcement.
      if (interactive.closest("a[href]")) return;
      const now = Date.now();
      if (now - lastReactRef.current < 4500) return;
      lastReactRef.current = now;
      setPulse(true);
      window.setTimeout(() => setPulse(false), 700);
      say(lineFor(accessibleLabel(interactive), name), true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [mounted, open, say, name]);

  function dismiss() {
    setOpen(false);
    queueRef.current = [];
    busyRef.current = false;
    if (typeTimerRef.current) {
      window.clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }

  function reopen() {
    setOpen(true);
    playPop();
    say([`Hi ${firstName}! I'm Royal, your learning buddy!`, pageGuide(pathname)], true);
  }

  function toggleMute() {
    setMuted((current) => {
      const next = !current;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
    if (!muted) {
      if (typeTimerRef.current) {
        window.clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      setTyped(lastLineRef.current);
      busyRef.current = false;
      queueRef.current = [];
    }
  }

  function repeat() {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 700);
    if (lastLineRef.current) say(lastLineRef.current, true);
  }

  if (!mounted) return null;

  if (!open) {
    return createPortal(
      <button
        type="button"
        onClick={reopen}
        aria-label="Open Royal Guide"
        title="Royal Guide"
        className="royal-guide-pop fixed bottom-24 right-4 z-[60] grid h-14 w-14 place-items-center rounded-full royal-panel text-white shadow-xl shadow-black/30 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 lg:bottom-6 lg:right-6"
      >
        <Sparkles size={22} aria-hidden="true" />
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={rootRef}
      className={`royal-guide-pop fixed bottom-24 right-4 z-[60] w-[min(320px,calc(100vw-2rem))] lg:bottom-6 lg:right-6 ${
        pulse ? "royal-guide-head--pulse" : ""
      }`}
    >
      <div className="relative royal-panel rounded-3xl px-4 pb-3 pt-3 text-white shadow-2xl shadow-black/30">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-blue-100">
            <Sparkles size={12} aria-hidden="true" /> Royal Guide
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close guide"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 min-h-[3.2em] text-[13px] leading-relaxed text-white" role="status" aria-live="polite">
          {typed || "Tap me any time and I'll explain what's on this page."}
        </p>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute guide voice" : "Mute guide voice"}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={repeat}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-xs font-bold text-white transition hover:bg-white/25"
          >
            Say again
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
