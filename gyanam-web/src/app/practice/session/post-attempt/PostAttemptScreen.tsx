import { LearningModeBadge } from "./LearningModeBadge";
import { WeakAreaPanel } from "./WeakAreaPanel";
import type { PostAttemptResponse } from "./types";

export default function PostAttemptScreen({ data }: { data: PostAttemptResponse }) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold leading-snug">{data.headline}</h1>
        <p className="mt-2 max-w-xl text-gray-600">{data.message}</p>
        {data.explanation?.reason ? (
          <p className="mt-2 text-sm text-gray-500">{data.explanation.reason}</p>
        ) : null}
        {data.explanation?.pattern ? (
          <p className="mt-2 text-sm text-red-500">{data.explanation.pattern}</p>
        ) : null}
      </div>

      <LearningModeBadge mode={data.mode} />

      <WeakAreaPanel topics={data.mentorFeedback?.focus || data.focus} />

      <div className="pt-4">
        <div className="flex flex-col gap-1">
          <button className="rounded-2xl bg-black px-5 py-2.5 text-white transition hover:opacity-90">
            {data.nextAction.label}
          </button>
          {data.nextAction.strategy ? (
            <p className="text-xs text-gray-500">{data.nextAction.strategy}</p>
          ) : null}
          {data.nextAction.trapType ? (
            <span className="text-xs text-gray-400">Trap: {data.nextAction.trapType}</span>
          ) : null}
          {data.nextAction.topic ? (
            <span className="text-xs text-gray-400">Focus: {data.nextAction.topic}</span>
          ) : null}
          {data.nextAction.severity === "high" ? (
            <p className="text-xs text-red-500">High priority area — focus now</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
