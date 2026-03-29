"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PostAttemptScreen from "./post-attempt/PostAttemptScreen";
import type { PostAttemptResponse } from "./post-attempt/types";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;
const mockModes = ["challenge", "revision", "recovery", "stabilize"] as const;
type ModeKey = (typeof mockModes)[number];

function getGuestId(): string {
  const key = "guest-id";
  if (typeof window === "undefined") {
    return "server";
  }
  const existing = sessionStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

type SessionQuestion = {
  id: string;
  topicId: string;
  stem: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
};

type SessionPayload = {
  attemptId: string;
  questions: SessionQuestion[];
};

type SubmitResult = {
  rawScore: number;
  maxScore: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  postAttempt?: PostAttemptResponse;
  mentorFeedback?: {
    headline: string;
    message: string;
    mode: "challenge" | "stabilize" | "revision" | "recovery";
    focus?: Array<{ topicId: string; topicLabel?: string; errorType: string | null }>;
    nextAction?: string;
  };
};

type AnswerState = {
  selectedIndex: number | null;
  timeSpentSeconds: number;
};

type AttemptFeedback = {
  isCorrect: boolean;
  chosen: string | null;
  correct: string | null;
  trapType?: string | null;
  trapInsight?: string | null;
  whyWrong?: string | null;
  whyCorrect?: string | null;
  strategy?: string | null;
  correctThinking?: string | null;
};

function PracticeSessionContent() {
  const router = useRouter();
  const params = useSearchParams();
  const attemptId = params.get("attemptId");
  const debugPostAttempt = params.get("debug") === "1";
  const debugMode = params.get("mode");
  const resolvedMode = (mockModes.includes(debugMode as ModeKey)
    ? (debugMode as ModeKey)
    : "recovery") as PostAttemptResponse["mode"];
  const mockPostAttempt: PostAttemptResponse = {
    headline: "Strong attempt, but conceptual gaps detected",
    message: "You’re doing well, but a few reasoning errors are pulling you down.",
    focus: ["Time & Work", "Logical Reasoning"],
    nextAction: {
      label: "Fix misreading errors in Time & Work",
      actionType: "practice",
      topic: "Time & Work",
      errorType: "misreading",
      severity: "high",
    },
    mode: resolvedMode,
    explanation: {
      reason: "Multiple weak topics identified",
      pattern: "You are repeatedly making the same mistake",
      signals: {
        accuracy: 52,
        weakTopics: 2,
        trend: "flat",
      },
    },
    mentorFeedback: {
      focus: ["Time & Work", "Logical Reasoning"],
    },
  };
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [topicWrongCounts, setTopicWrongCounts] = useState<Record<string, number>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now());
  const [postAttempt, setPostAttempt] = useState<PostAttemptResponse | null>(null);
  const [lastFeedback, setLastFeedback] = useState<AttemptFeedback | null>(null);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);

  const questionById = useMemo(() => {
    if (!session) {
      return new Map<string, SessionQuestion>();
    }
    return new Map(session.questions.map((question) => [question.id, question]));
  }, [session]);

  const currentQuestionId = queue[0] ?? null;
  const question = currentQuestionId ? questionById.get(currentQuestionId) ?? null : null;

  useEffect(() => {
    if (debugPostAttempt) {
      setLoading(false);
      return;
    }
    if (typeof window !== "undefined") {
      setFocusLabel(sessionStorage.getItem("practice:focusLabel"));
    }
    async function loadSession() {
      if (!attemptId) {
        setError("Missing attempt id.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API}/v1/tests/session/${encodeURIComponent(attemptId)}`, {
          credentials: "include",
          cache: "no-store",
          headers: {
            "x-guest-id": getGuestId(),
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to load session (${res.status})`);
        }

        const body = (await res.json()) as { data: SessionPayload };
        setSession(body.data);
        setQueue(body.data.questions.map((item) => item.id));
        setQuestionStartedAt(Date.now());
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not load practice session.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadSession();
  }, [attemptId, debugPostAttempt, router]);

  function selectOption(questionId: string, selectedIndex: number) {
    setAnswers((previous) => {
      const existing = previous[questionId] ?? { selectedIndex: null, timeSpentSeconds: 0 };
      return {
        ...previous,
        [questionId]: {
          ...existing,
          selectedIndex,
        },
      };
    });
  }

  function reorderRemaining(remaining: string[], wrongCounts: Record<string, number>) {
    return [...remaining].sort((left, right) => {
      const leftTopic = questionById.get(left)?.topicId ?? "";
      const rightTopic = questionById.get(right)?.topicId ?? "";
      const leftScore = wrongCounts[leftTopic] ?? 0;
      const rightScore = wrongCounts[rightTopic] ?? 0;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return left.localeCompare(right);
    });
  }

  async function lockCurrentAnswerAndContinue() {
    if (!session || !question || !currentQuestionId) {
      return;
    }

    const selectedIndex = answers[currentQuestionId]?.selectedIndex ?? null;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000));

    setAnswers((previous) => ({
      ...previous,
      [currentQuestionId]: {
        selectedIndex,
        timeSpentSeconds: elapsedSeconds,
      },
    }));

    let nextWrongCounts = topicWrongCounts;
    if (selectedIndex !== null) {
      const evalRes = await fetch(`${API}/v1/tests/session/evaluate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-guest-id": getGuestId() },
        credentials: "include",
        body: JSON.stringify({
          attemptId: session.attemptId,
          questionId: currentQuestionId,
          selectedIndex,
        }),
      });
      if (!evalRes.ok) {
        throw new Error(`Failed to evaluate answer (${evalRes.status})`);
      }

      const evalBody = (await evalRes.json()) as { data: { isCorrect: boolean; topicId: string; feedback?: AttemptFeedback } };
      if (!evalBody.data.isCorrect) {
        nextWrongCounts = {
          ...topicWrongCounts,
          [evalBody.data.topicId]: (topicWrongCounts[evalBody.data.topicId] ?? 0) + 1,
        };
        setTopicWrongCounts(nextWrongCounts);
        setLastFeedback(evalBody.data.feedback ?? null);
      } else {
        setLastFeedback(null);
      }
    }

    const remaining = queue.slice(1);
    setQueue(reorderRemaining(remaining, nextWrongCounts));
    setQuestionStartedAt(Date.now());
  }

  async function submitAttempt() {
    if (!session) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const focusKey = typeof window !== "undefined" ? sessionStorage.getItem("practice:focusKey") : null;
      const res = await fetch(`${API}/v1/tests/submit`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-guest-id": getGuestId() },
        credentials: "include",
        body: JSON.stringify({
          attemptId: session.attemptId,
          focusKey: focusKey ?? undefined,
          answers: session.questions.map((item) => ({
            questionId: item.id,
            selectedIndex: answers[item.id]?.selectedIndex ?? null,
            timeSpentSeconds: answers[item.id]?.timeSpentSeconds ?? 0,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to submit test (${res.status})`);
      }

      const body = (await res.json()) as { data: SubmitResult };
      if (body.data.postAttempt) {
        setPostAttempt(body.data.postAttempt);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("practice:focusKey");
          sessionStorage.removeItem("practice:focusLabel");
        }
        return;
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("practice:result", JSON.stringify(body.data));
        sessionStorage.removeItem("practice:focusKey");
        sessionStorage.removeItem("practice:focusLabel");
      }
      const query = new URLSearchParams({
        rawScore: String(body.data.rawScore),
        maxScore: String(body.data.maxScore),
        totalQuestions: String(body.data.totalQuestions),
        correctCount: String(body.data.correctCount),
        incorrectCount: String(body.data.incorrectCount),
        skippedCount: String(body.data.skippedCount),
      });
      router.push(`/practice/result?${query.toString()}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not submit test.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function next() {
    try {
      await lockCurrentAnswerAndContinue();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not move to next question.";
      setError(message);
    }
  }

  if (debugPostAttempt) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PostAttemptScreen data={mockPostAttempt} />
      </main>
    );
  }

  if (loading) {
    return <main className="p-8">Loading session...</main>;
  }

  if (error) {
    return (
      <main className="p-8">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (postAttempt && !debugPostAttempt) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PostAttemptScreen data={postAttempt} />
      </main>
    );
  }

  if (!session || !question || !currentQuestionId) {
    return (
      <main className="p-8">
        <p>No active session found.</p>
      </main>
    );
  }

  const currentIndex = session.questions.length - queue.length + 1;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Practice Session</h1>
        <p className="text-sm text-gray-600">
          Question {currentIndex} / {session.questions.length}
        </p>
      </div>
      {focusLabel ? (
        <p className="mb-4 text-xs text-gray-500">You are currently working on: {focusLabel}</p>
      ) : null}

      {lastFeedback && !lastFeedback.isCorrect ? (
        <section className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm">
          <p>
            <span className="font-medium">You chose:</span> {lastFeedback.chosen ?? "-"}
          </p>
          <p>
            <span className="font-medium">Correct:</span> {lastFeedback.correct ?? "-"}
          </p>
          {lastFeedback.trapInsight ? (
            <p className="mt-2 text-red-500">{lastFeedback.trapInsight}</p>
          ) : null}
          {lastFeedback.whyWrong ? (
            <p className="mt-2">Why your answer is wrong: {lastFeedback.whyWrong}</p>
          ) : null}
          {lastFeedback.strategy ? (
            <p className="mt-2">How to fix: {lastFeedback.strategy}</p>
          ) : null}
          {(lastFeedback.correctThinking || lastFeedback.strategy) ? (
            <p className="mt-2 text-gray-600">
              Correct thinking: {lastFeedback.correctThinking ?? lastFeedback.strategy}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded border bg-white p-5 shadow-sm">
        <p className="mb-4 whitespace-pre-line font-medium">{question.stem}</p>
        <ul className="space-y-2">
          {question.options.map((option, idx) => (
            <li key={`${question.id}-opt-${idx}`}>
              <label className="flex cursor-pointer items-center gap-2 rounded border p-2">
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[question.id]?.selectedIndex === idx}
                  onChange={() => selectOption(question.id, idx)}
                />
                <span className="whitespace-pre-line">{option}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 flex items-center justify-end">
        {queue.length > 1 ? (
          <button type="button" className="rounded bg-blue-600 px-4 py-2 text-white" onClick={next}>
            Next
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60"
            disabled={submitting}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void submitAttempt();
            }}
          >
            {submitting ? "Submitting..." : "Submit Test"}
          </button>
        )}
      </div>
    </main>
  );
}

export default function PracticeSessionPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-3xl p-8 text-sm text-gray-600">Loading session...</main>}
    >
      <PracticeSessionContent />
    </Suspense>
  );
}
