"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

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

type AssembleResponse = {
  attemptId: string;
};

type LearningPathItem = {
  key: string;
  topic: string;
  concept?: string;
  conceptId?: string;
  trapType?: string | null;
  priority: "urgent" | "reinforce" | "ignore";
  reason?: string;
  nextAction?: {
    label: string;
    actionType: "revise" | "practice" | "challenge";
    strategy?: string;
  };
};

export default function PracticePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [startingFocusKey, setStartingFocusKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusItems, setFocusItems] = useState<LearningPathItem[]>([]);
  const [focusLoading, setFocusLoading] = useState(true);
  const [focusError, setFocusError] = useState<string | null>(null);

  async function loadLearningPath() {
    setFocusLoading(true);
    setFocusError(null);
    try {
      const res = await fetch(`${API}/v1/learning-path`, {
        headers: {
          "x-guest-id": getGuestId(),
        },
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load learning path (${res.status})`);
      }
      const body = (await res.json()) as { data: { items: LearningPathItem[] } };
      setFocusItems(body.data.items ?? []);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not load learning path.";
      setFocusError(message);
    } finally {
      setFocusLoading(false);
    }
  }

  async function startFocus(item: LearningPathItem) {
    setLoading(true);
    setStartingFocusKey(item.key);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/learning-path/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-guest-id": getGuestId(),
        },
        credentials: "include",
        body: JSON.stringify({
          focusKey: item.key,
          questionCount: 10,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to start focus set (${res.status})`);
      }
      const body = (await res.json()) as { data: AssembleResponse & { focusKey?: string } };
      if (typeof window !== "undefined") {
        sessionStorage.setItem("practice:focusKey", item.key);
        sessionStorage.setItem(
          "practice:focusLabel",
          item.nextAction?.label ?? item.reason ?? item.topic,
        );
      }
      router.push(`/practice/session?attemptId=${encodeURIComponent(body.data.attemptId)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not start focus set.";
      setError(message);
    } finally {
      setLoading(false);
      setStartingFocusKey(null);
    }
  }

  useEffect(() => {
    void loadLearningPath();
  }, []);

  async function beginDiagnostic() {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("practice:focusKey");
        sessionStorage.removeItem("practice:focusLabel");
      }
      const res = await fetch(`${API}/v1/tests/assemble`, {
        method: "POST",
        // Allow guest flow when no auth cookie is present.
        // Backend will treat x-guest-id as a guest user.
        headers: {
          "content-type": "application/json",
          "x-guest-id": getGuestId(),
        },
        credentials: "include",
        body: JSON.stringify({
          mode: "diagnostic_mixed",
          questionCount: 20,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to start diagnostic (${res.status})`);
      }

      const body = (await res.json()) as { data: AssembleResponse };
      router.push(`/practice/session?attemptId=${encodeURIComponent(body.data.attemptId)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not start diagnostic.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-8">
      <h1 className="mb-2 text-2xl font-bold">Take Your Diagnostic Test</h1>
      <div className="mb-8 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Today&apos;s Focus</h2>
        {focusLoading ? (
          <p className="mt-2 text-sm text-gray-600">Loading focus recommendations...</p>
        ) : focusError ? (
          <p className="mt-2 text-sm text-red-600">{focusError}</p>
        ) : focusItems.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No focus items yet. Start with a diagnostic test.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {focusItems.slice(0, 3).map((item) => (
              <div
                key={item.key}
                role="button"
                tabIndex={0}
                onClick={() => startFocus(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    startFocus(item);
                  }
                }}
                className="cursor-pointer rounded border border-gray-100 bg-gray-50 p-3 focus:outline-none focus:ring-2 focus:ring-black/20"
              >
                <p className="text-sm font-medium">{item.nextAction?.label ?? item.reason ?? item.topic}</p>
                {item.reason ? (
                  <p className="mt-1 text-xs text-gray-600">{item.reason}</p>
                ) : null}
                {item.nextAction?.strategy ? (
                  <p className="mt-1 text-xs text-gray-500">{item.nextAction.strategy}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => startFocus(item)}
                  disabled={loading || startingFocusKey === item.key}
                  className="mt-3 rounded bg-black px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && startingFocusKey === item.key ? "Starting..." : "Start Focused Set"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-gray-600">Questions: 20</p>
      <p className="text-gray-600">Subjects: Mixed bootstrap (phase-1 simplified)</p>
      <p className="mb-6 text-gray-600">Time: ~10 minutes</p>

      <button
        type="button"
        onClick={beginDiagnostic}
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Starting..." : "Begin Diagnostic"}
      </button>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </main>
  );
}
