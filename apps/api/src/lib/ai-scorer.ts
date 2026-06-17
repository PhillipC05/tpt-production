import type { OrderInput, RoutingCandidate } from "@tpt/types";
import { featureFlags } from "@tpt/core/flags";

export let aiScorerEnabled = featureFlags.ENABLE_AI_AGENTS && Boolean(process.env.AI_SCORER_ENDPOINT);
export let aiScorerEndpoint: string | null = process.env.AI_SCORER_ENDPOINT ?? null;

export function getScorerStatus() {
  return { enabled: aiScorerEnabled, endpoint: aiScorerEndpoint };
}

export function updateScorerStatus(input: { enabled: boolean; endpoint?: string | null }) {
  aiScorerEnabled = input.enabled;
  if (input.endpoint !== undefined) {
    aiScorerEndpoint = input.endpoint ?? null;
  }
  return getScorerStatus();
}

export async function callAiScorer(candidate: RoutingCandidate, order: OrderInput): Promise<number> {
  if (!aiScorerEndpoint) return 0;
  try {
    const res = await fetch(aiScorerEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate, order }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { score?: unknown };
    const score = data.score;
    return typeof score === "number" ? Math.max(0, Math.min(1, score)) : 0;
  } catch {
    return 0;
  }
}