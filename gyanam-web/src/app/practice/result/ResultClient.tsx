"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type MentorFeedback = {
  headline: string;
  message: string;
  mode: "challenge" | "stabilize" | "revision" | "recovery";
  focus?: Array<{ topicId: string; topicLabel?: string; errorType: string | null }>;
  nextAction?: string;
};

function readNumber(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function PracticeResultClient() {
  const params = useSearchParams();
  const [mentorFeedback, setMentorFeedback] = useState<MentorFeedback | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = sessionStorage.getItem("practice:result");
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as { mentorFeedback?: MentorFeedback };
      if (parsed?.mentorFeedback) {
        setMentorFeedback(parsed.mentorFeedback);
      }
    } catch {
      // Ignore malformed cached payloads.
    }
  }, []);

  const rawScore = readNumber(params.get("rawScore"));
  const maxScore = readNumber(params.get("maxScore"));
  const totalQuestions = readNumber(params.get("totalQuestions"));
  const correctCount = readNumber(params.get("correctCount"));
  const incorrectCount = readNumber(params.get("incorrectCount"));
  const skippedCount = readNumber(params.get("skippedCount"));

  const modeMeta = mentorFeedback
    ? {
        challenge: { label: "Challenge", className: "bg-indigo-100 text-indigo-800" },
        revision: { label: "Revision", className: "bg-amber-100 text-amber-800" },
        recovery: { label: "Recovery", className: "bg-rose-100 text-rose-800" },
        stabilize: { label: "Stabilize", className: "bg-emerald-100 text-emerald-800" },
      }[mentorFeedback.mode]
    : null;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Test Result</h1>

      {mentorFeedback && (
        <section className="mb-8 rounded border bg-white p-6 shadow-md">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">{mentorFeedback.headline}</h2>
            {modeMeta && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${modeMeta.className}`}>
                {modeMeta.label}
              </span>
            )}
          </div>
          <p className="text-base text-gray-800">{mentorFeedback.message}</p>
          {mentorFeedback.nextAction && (
            <p className="mt-4 text-sm text-gray-700">
              <span className="font-semibold">Next:</span> {mentorFeedback.nextAction}
            </p>
          )}
        </section>
      )}

      {mentorFeedback?.focus && mentorFeedback.focus.length > 0 && (
        <section className="mb-6 rounded border bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Focus Areas</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-800">
            {mentorFeedback.focus.map((focus) => (
              <li key={focus.topicId}>{focus.topicLabel ?? focus.topicId}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border bg-white p-4 text-sm text-gray-700 shadow-sm">
        <p className="mb-2 text-base font-semibold text-gray-800">
          Score: {rawScore} / {maxScore}
        </p>
        <p>Questions: {totalQuestions}</p>
        <p>Correct: {correctCount}</p>
        <p>Incorrect: {incorrectCount}</p>
        <p>Skipped: {skippedCount}</p>
      </section>

      <div className="mt-6">
        <Link href="/dashboard" className="rounded bg-blue-600 px-4 py-2 text-white">
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
