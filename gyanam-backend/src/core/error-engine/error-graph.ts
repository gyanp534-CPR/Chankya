import fs from "node:fs";
import path from "node:path";
import type { ErrorGraph } from "./types.js";

const DEFAULT_GRAPH_PATH = path.join(process.cwd(), "data", "pyq", "tagging", "error-graph.v1.json");

export function loadErrorGraph(graphPath: string = DEFAULT_GRAPH_PATH): ErrorGraph {
  const raw = fs.readFileSync(graphPath, "utf-8");
  const parsed = JSON.parse(raw) as ErrorGraph;
  if (!parsed || typeof parsed !== "object" || !parsed.nodes || !parsed.edges) {
    throw new Error(`Invalid error graph at ${graphPath}`);
  }
  return parsed;
}

export function pickNextLikelyError(graph: ErrorGraph, lastError: string): string | null {
  const edges = graph.edges[lastError];
  if (!edges) {
    return null;
  }

  let best: { error: string; weight: number } | null = null;
  for (const [error, edge] of Object.entries(edges)) {
    if (!edge || typeof edge.weight !== "number") {
      continue;
    }
    if (!best || edge.weight > best.weight) {
      best = { error, weight: edge.weight };
    }
  }

  return best?.error ?? null;
}
