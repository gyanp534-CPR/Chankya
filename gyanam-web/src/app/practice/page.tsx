"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type AssembleResponse = {
  attemptId: string;
};

export default function PracticePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginDiagnostic() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/tests/assemble`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
