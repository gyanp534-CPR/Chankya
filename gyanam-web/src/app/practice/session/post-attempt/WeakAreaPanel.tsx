export function WeakAreaPanel({ topics }: { topics: string[] }) {
  if (!topics || topics.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <h2 className="mb-2 text-lg font-medium">Focus Areas</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {topics.map((topic, idx) => (
          <span key={idx} className="rounded-full border bg-white px-3 py-1 text-sm">
            {topic}
          </span>
        ))}
      </div>
    </div>
  );
}
