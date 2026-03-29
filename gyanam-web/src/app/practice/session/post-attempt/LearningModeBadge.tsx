const modeConfig = {
  challenge: {
    label: "Challenge Mode",
    color: "bg-red-100 text-red-700",
  },
  revision: {
    label: "Revision Mode",
    color: "bg-blue-100 text-blue-700",
  },
  recovery: {
    label: "Recovery Mode",
    color: "bg-yellow-100 text-yellow-800",
  },
  stabilize: {
    label: "Stabilize Mode",
    color: "bg-green-100 text-green-700",
  },
};

export function LearningModeBadge({ mode }: { mode: keyof typeof modeConfig }) {
  const config = modeConfig[mode];

  return (
    <div className={`inline-block rounded-full px-3 py-1 text-sm ${config.color}`}>
      {config.label}
    </div>
  );
}
