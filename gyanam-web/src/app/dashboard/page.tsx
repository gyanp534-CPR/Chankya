import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Summary = {
  globalMastery: number;
  globalSkillBand: string;
  subjects: Array<{
    subjectId: string;
    mastery: number;
    skillBand: string;
  }>;
};

type TopicRow = {
  topicId: string;
  mastery: number;
  skillBand: string;
  confidence: "low" | "medium" | "high";
  isWeak: boolean;
};

type RevisionRow = {
  taskId: string;
  topicId: string;
  dueAt: string;
};

function bandColor(band: string): string {
  switch (band) {
    case "Emerging":
      return "text-red-500";
    case "Developing":
      return "text-amber-600";
    case "Proficient":
      return "text-blue-600";
    case "Advanced":
      return "text-green-600";
    default:
      return "text-gray-900";
  }
}

async function fetchWithCookies<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${API}${path}`, {
    headers: { cookie: cookieHeader },
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401) {
    redirect("/login");
  }

  if (!res.ok) {
    throw new Error(`Failed to load ${path} (${res.status})`);
  }

  const body = (await res.json()) as { data: T };
  return body.data;
}

export default async function DashboardPage() {
  const [summary, topics, revision] = await Promise.all([
    fetchWithCookies<Summary>("/v1/analytics/summary"),
    fetchWithCookies<TopicRow[]>("/v1/analytics/topics"),
    fetchWithCookies<RevisionRow[]>("/v1/revision/due"),
  ]);

  return (
    <main className="space-y-8 p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <section className="rounded bg-white p-6 shadow">
        <h2 className={`mb-2 text-xl font-semibold ${bandColor(summary.globalSkillBand)}`}>
          {summary.globalSkillBand}
        </h2>
        <p className="mb-4 text-gray-600">Global Mastery: {summary.globalMastery}</p>

        <div className="grid grid-cols-2 gap-4">
          {summary.subjects.map((subject) => (
            <div key={subject.subjectId} className="rounded border p-3">
              <p className="font-medium">{subject.subjectId}</p>
              <p className="text-sm text-gray-600">
                {subject.mastery} | {subject.skillBand}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Topic Mastery</h2>

        {topics.length === 0 ? (
          <div className="text-sm text-gray-500">
            No learning data yet.
            <div className="mt-2">
              Start your first practice session to generate mastery insights.
            </div>
            <a
              href="/practice"
              className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white"
            >
              Start First Practice
            </a>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b text-sm text-gray-600">
                <th className="pb-2">Topic</th>
                <th>Mastery</th>
                <th>Band</th>
                <th>Confidence</th>
                <th>Weak</th>
              </tr>
            </thead>

            <tbody>
              {topics.map((topic) => (
                <tr key={topic.topicId} className={`border-b ${topic.isWeak ? "bg-red-50" : ""}`}>
                  <td className="py-2">{topic.topicId}</td>
                  <td className={topic.isWeak ? "font-semibold text-red-600" : ""}>{topic.mastery}</td>
                  <td className={bandColor(topic.skillBand)}>{topic.skillBand}</td>
                  <td>{topic.confidence}</td>
                  <td>{topic.isWeak ? <span className="font-medium text-red-500">!</span> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Revision Due</h2>

        {revision.length === 0 ? (
          <p className="text-gray-500">No revision due today.</p>
        ) : (
          <ul className="space-y-2">
            {revision.map((item) => (
              <li key={item.taskId} className="flex items-center justify-between rounded border p-3">
                <span>{item.topicId}</span>
                <button className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Revise</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
