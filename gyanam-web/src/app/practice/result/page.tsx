import { Suspense } from "react";

import PracticeResultClient from "./ResultClient";

export const dynamic = "force-dynamic";

export default function PracticeResultPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-2xl p-8 text-sm text-gray-600">Loading result...</main>}
    >
      <PracticeResultClient />
    </Suspense>
  );
}
