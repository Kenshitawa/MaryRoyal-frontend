"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  ExternalLink,
  Flame,
  Gamepad2,
  GraduationCap,
  Lightbulb,
  Trophy,
} from "lucide-react";

type Learner = { id: string; name: string; admissionNo: string; grade: string };
type Assessment = {
  subject: string;
  score: number;
  term: string;
  strand: string | null;
  competency: string | null;
  comment: string | null;
};
type Submission = {
  score: number | null;
  assignment: { title: string; subject: string; maxScore: number; createdAt: Date };
};
type Attempt = { id: string; gameKey: string; score: number; maxScore: number; createdAt: Date };
type Resource = {
  id: string;
  title: string;
  description: string;
  grade: string;
  subject: string;
  kind: string;
  url: string;
  createdAt: string;
  teacher: { name: string };
};
type Question = { prompt: string; answer: string; options: string[]; explanation: string };

function videoEmbed(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be")
      return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com")
      return `https://player.vimeo.com/video/${url.pathname.split("/").filter(Boolean)[0] ?? ""}`;
    if (host === "player.vimeo.com") return value;
  } catch {
    return null;
  }
  return null;
}

function makeQuestions(game: string, grade: string): Question[] {
  const numberGrade = Number(grade.replace("Grade ", "")) || (grade === "PP2" ? 1 : 0);
  if (game === "SCIENCE_EXPLORER") {
    const easy: Question[] = [
      {
        prompt: "Which part of a plant takes in water from the soil?",
        answer: "Roots",
        options: ["Roots", "Flower", "Fruit", "Leaf"],
        explanation: "Roots absorb water and minerals from the soil.",
      },
      {
        prompt: "Which one is a source of clean renewable energy?",
        answer: "Sunlight",
        options: ["Smoke", "Sunlight", "Plastic", "Diesel"],
        explanation: "Sunlight is renewable energy that produces zero pollution.",
      },
      {
        prompt: "What should you do before eating fresh fruit?",
        answer: "Wash it",
        options: ["Paint it", "Wash it", "Hide it", "Heat it in the sun"],
        explanation: "Washing fruit removes soil, germs, and pesticides.",
      },
      {
        prompt: "Which domestic animal gives us milk in Kenya?",
        answer: "Cow",
        options: ["Cow", "Eagle", "Lizard", "Frog"],
        explanation: "Dairy cows and goats are domestic animals kept for milk.",
      },
      {
        prompt: "What do we call water falling from clouds?",
        answer: "Rain",
        options: ["Rain", "Dust", "Wind", "Smoke"],
        explanation: "Precipitation in liquid form is rain.",
      },
    ];
    const advanced: Question[] = [
      {
        prompt: "Which process allows green plants to manufacture food using solar energy?",
        answer: "Photosynthesis",
        options: ["Photosynthesis", "Evaporation", "Pollination", "Germination"],
        explanation: "Photosynthesis uses light, water, and carbon dioxide to produce glucose.",
      },
      {
        prompt: "Which gas do plants absorb from the air during photosynthesis?",
        answer: "Carbon dioxide",
        options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
        explanation: "Plants take in carbon dioxide and release oxygen.",
      },
      {
        prompt: "What is the safest immediate first aid action for a small surface cut?",
        answer: "Wash hands and rinse the cut",
        options: [
          "Cover it with dry soil",
          "Wash hands and rinse the cut",
          "Rub it vigorously",
          "Ignore it",
        ],
        explanation: "Clean water and sanitized hands prevent infection.",
      },
      {
        prompt: "Which conservation action best prevents topsoil erosion?",
        answer: "Planting trees",
        options: ["Removing all grass cover", "Planting trees", "Burning bushes", "Leaving soil bare"],
        explanation: "Tree roots bind topsoil and vegetation reduces water runoff speed.",
      },
      {
        prompt: "The state transition of water from liquid to vapour is called…",
        answer: "Evaporation",
        options: ["Condensation", "Evaporation", "Freezing", "Filtration"],
        explanation: "Heat causes liquid water molecules to vaporize into steam.",
      },
    ];
    return numberGrade <= 3 ? easy : advanced;
  }
  return Array.from({ length: 5 }, (_, index) => {
    const scale = numberGrade <= 1 ? 10 : numberGrade <= 3 ? 30 : numberGrade <= 6 ? 12 : 25;
    const a = 2 + Math.floor(Math.random() * scale);
    const b = 2 + Math.floor(Math.random() * scale);
    let answer: number;
    let prompt: string;
    let explanation: string;
    if (numberGrade < 4) {
      answer = a + b;
      prompt = `What is ${a} + ${b}?`;
      explanation = `Sum of ${a} and ${b} equals ${answer}.`;
    } else if (numberGrade < 7 || index % 2 === 0) {
      answer = a * b;
      prompt = `What is ${a} × ${b}?`;
      explanation = `${a} multiplied by ${b} equals ${answer}.`;
    } else {
      const quotient = 2 + Math.floor(Math.random() * 12);
      answer = quotient;
      const divisor = 2 + Math.floor(Math.random() * 9);
      const dividend = quotient * divisor;
      prompt = `What is ${dividend} ÷ ${divisor}?`;
      explanation = `${dividend} divided by ${divisor} gives ${answer}.`;
    }
    const candidates = new Set([
      answer,
      Math.max(0, answer - 1 - index),
      answer + 1 + index,
      answer + 3 + index,
    ]);
    return {
      prompt,
      answer: String(answer),
      options: [...candidates].map(String).sort(() => Math.random() - 0.5),
      explanation,
    };
  });
}

export default function LearningClient({
  learner,
  assessments,
  submissions,
  attempts,
  attendance,
}: {
  learner: Learner;
  assessments: Assessment[];
  submissions: Submission[];
  attempts: Attempt[];
  attendance: { status: string }[];
}) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceError, setResourceError] = useState("");
  const [game, setGame] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState("");
  const [gameMessage, setGameMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

  const loadResources = useCallback(async () => {
    try {
      const response = await fetch("/api/learning/resources");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResources(data.resources);
    } catch (error) {
      setResourceError(
        error instanceof Error ? error.message : "Learning resources are currently unavailable."
      );
    }
  }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const subjects = useMemo(() => {
    const rows = new Map<string, number[]>();
    for (const row of assessments) {
      rows.set(row.subject, [...(rows.get(row.subject) ?? []), row.score]);
    }
    for (const row of submissions) {
      if (row.score !== null) {
        rows.set(row.assignment.subject, [
          ...(rows.get(row.assignment.subject) ?? []),
          (row.score / row.assignment.maxScore) * 100,
        ]);
      }
    }
    return [...rows.entries()]
      .map(([subject, values]) => ({
        subject,
        average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      }))
      .sort((a, b) => b.average - a.average);
  }, [assessments, submissions]);

  const attendanceRate = attendance.length
    ? Math.round(
        (attendance.filter((row) => row.status === "PRESENT").length / attendance.length) * 100
      )
    : null;

  function startGame(key: string) {
    setGame(key);
    setQuestions(makeQuestions(key, learner.grade));
    setQuestionIndex(0);
    setScore(0);
    setSelected("");
    setGameMessage("");
    setFinished(false);
  }

  async function answerQuestion() {
    if (!selected || saving) return;
    const nextScore = score + (selected === questions[questionIndex].answer ? 1 : 0);
    setScore(nextScore);
    setSelected("");
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((index) => index + 1);
      return;
    }
    setSaving(true);
    setFinished(true);
    try {
      const response = await fetch("/api/learning/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameKey: game,
          score: nextScore,
          maxScore: questions.length,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGameMessage("Great job! Your score was recorded.");
    } catch (error) {
      setGameMessage(
        error instanceof Error ? error.message : "Your score could not be saved. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl p-4 pb-12 sm:p-6 md:p-8 space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1f44] via-blue-900 to-indigo-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-sm">
              <GraduationCap size={13} />
              CBC Learner Portal · {learner.grade}
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Jambo, {learner.name.split(" ")[0]}!
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100">
              Welcome to your digital classroom. Review lessons from your teachers, solve practice
              challenges, and track your achievements.
            </p>
          </div>

          <Link
            href="/assignments"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-xs font-bold text-blue-950 shadow-md transition hover:bg-blue-50 active:scale-95"
          >
            <BookOpenCheck size={16} />
            My Classwork Tasks
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Released Marks
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <Trophy size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {assessments.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Official assessments</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tasks Handed In
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <BookOpenCheck size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
              {submissions.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Evaluated by teacher</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Practice Games
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <Gamepad2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700 dark:text-purple-400">
              {attempts.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Completed quiz rounds</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attendance
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {attendanceRate === null ? "—" : `${attendanceRate}%`}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recent classroom record</p>
        </div>
      </div>

      {/* Progress & Quick Games Bento Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        {/* Learning Progress Card */}
        <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Flame size={18} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Academic Proficiency
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Average competency scores across assessed learning areas.
              </p>
            </div>
          </div>

          {subjects.length ? (
            <div className="mt-6 space-y-4">
              {subjects.map((row) => (
                <div key={row.subject}>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 dark:text-slate-200">{row.subject}</span>
                    <span className="font-mono text-blue-700 dark:text-blue-400">
                      {row.average}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-700 to-indigo-600 transition-all duration-500"
                      style={{ width: `${Math.max(4, row.average)}%` }}
                    />
                  </div>
                </div>
              ))}

              {subjects.length > 1 && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <CheckCircle2 size={14} />
                      Your Strongest Area
                    </div>
                    <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                      You excel in <strong>{subjects[0].subject}</strong> ({subjects[0].average}%).
                      Keep building confidence!
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                      <Lightbulb size={14} />
                      Growth Opportunity
                    </div>
                    <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
                      Spend revision time on{" "}
                      <strong>{subjects[subjects.length - 1].subject}</strong>. Your teachers are
                      here to help.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Subject proficiency trends will show here once assessments are published.
            </p>
          )}
        </section>

        {/* Quick Learning Games Card */}
        <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
                <Gamepad2 size={18} />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Practice Challenges
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quick 5-question CBC skill quizzes.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                onClick={() => startGame("NUMBER_QUEST")}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-xl font-bold dark:bg-blue-950/60">
                  🔢
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white">
                    Number Quest
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Maths arithmetic &amp; logic · 5 questions
                  </p>
                </div>
              </button>

              <button
                onClick={() => startGame("SCIENCE_EXPLORER")}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xl font-bold dark:bg-emerald-950/60">
                  🌱
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white">
                    Science Explorer
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Nature, ecology, health · 5 questions
                  </p>
                </div>
              </button>
            </div>
          </div>

          {attempts.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recent best scores
              </p>
              <div className="mt-2 space-y-1.5">
                {attempts.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
                  >
                    <span>
                      {item.gameKey === "NUMBER_QUEST" ? "Number Quest" : "Science Explorer"}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {item.score} / {item.maxScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Interactive Quiz Modal/Section */}
      {game && (
        <section className="glass dark:glass-dark rounded-3xl border border-blue-200/80 p-6 shadow-md dark:border-blue-900/60">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                {game === "NUMBER_QUEST" ? "Number Quest" : "Science Explorer"}
              </span>
              <h2 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                {finished ? "Round Completed!" : `Question ${questionIndex + 1} of ${questions.length}`}
              </h2>
            </div>

            <button
              onClick={() => {
                setGame("");
                setFinished(false);
              }}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Exit Challenge
            </button>
          </div>

          {!finished ? (
            <div className="mt-5">
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {questions[questionIndex]?.prompt}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {questions[questionIndex]?.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => setSelected(option)}
                    className={`min-h-12 rounded-2xl border p-4 text-left text-xs font-bold transition ${
                      selected === option
                        ? "border-blue-700 bg-blue-50 text-blue-900 shadow-sm dark:border-blue-500 dark:bg-blue-950/60 dark:text-white"
                        : "border-slate-200 bg-white/70 hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900/50"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  disabled={!selected || saving}
                  onClick={() => void answerQuestion()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
                >
                  {questionIndex === questions.length - 1 ? "Submit Round" : "Next Question"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-blue-50/70 p-6 text-center dark:bg-blue-950/40">
              <Trophy size={36} className="mx-auto text-blue-700 dark:text-blue-400" />
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                You scored {score} out of {questions.length}!
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {score === questions.length
                  ? "Hongera! Perfect score!"
                  : score >= 3
                  ? "Good effort! Practice makes permanent."
                  : "Keep trying! You will get better each time."}
              </p>
              {gameMessage && (
                <p className="mt-2 text-xs font-bold text-blue-700 dark:text-blue-400">
                  {gameMessage}
                </p>
              )}
              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={() => startGame(game)}
                  className="rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Classroom Resources Section */}
      <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Class Lessons &amp; Readings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Videos and study links recommended by your teachers for {learner.grade}.
            </p>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {resources.length} Available
          </span>
        </div>

        {resourceError && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {resourceError}
          </p>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {resources.map((resource) => (
            <article
              key={resource.id}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
            >
              {resource.kind === "VIDEO" && /\.(mp4|webm)(\?.*)?$/i.test(resource.url) ? (
                <video
                  controls
                  preload="none"
                  className="aspect-video w-full bg-slate-950"
                  src={resource.url}
                  aria-label={resource.title}
                />
              ) : resource.kind === "VIDEO" && videoEmbed(resource.url) ? (
                <div className="aspect-video bg-slate-950">
                  <iframe
                    loading="lazy"
                    className="h-full w-full"
                    src={videoEmbed(resource.url) ?? undefined}
                    title={resource.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ) : (
                <div className="grid aspect-[2.5/1] place-items-center bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm dark:bg-slate-900">
                    {resource.kind === "VIDEO" ? <CirclePlay size={22} /> : <BookOpenCheck size={22} />}
                  </span>
                </div>
              )}

              <div className="p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {resource.subject}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {resource.kind}
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                  {resource.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {resource.description}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Teacher {resource.teacher.name}
                  </span>

                  {resource.kind !== "VIDEO" && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                    >
                      <ExternalLink size={13} />
                      Open Resource
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Released Results Overview */}
      <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Released CBC Assessments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only scores officially released by the Director or Head Teacher.
            </p>
          </div>
        </div>

        {assessments.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assessments.slice(0, 9).map((item, index) => (
              <article
                key={`${item.term}-${item.subject}-${index}`}
                className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white">{item.subject}</h3>
                  <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                    {item.score}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {item.term} · {item.strand ?? item.competency ?? "Curriculum Strand"}
                </p>
                {item.comment && (
                  <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-300">
                    &ldquo;{item.comment}&rdquo;
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            No released assessments recorded yet.
          </p>
        )}
      </section>
    </section>
  );
}
