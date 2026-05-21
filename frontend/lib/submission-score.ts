export type ScoreTier = "excellent" | "good" | "needs-work";

export function scorePercent(score: number): number {
  return Math.round(score * 100);
}

export function getScoreTier(score: number): ScoreTier {
  if (score >= 0.9) return "excellent";
  if (score >= 0.75) return "good";
  return "needs-work";
}

export function getScoreLabel(score: number): string {
  const tier = getScoreTier(score);
  if (tier === "excellent") return "Excellent";
  if (tier === "good") return "Good";
  return "Needs work";
}

export const SCORE_TIER_STYLES: Record<
  ScoreTier,
  { bar: string; text: string; border: string; bg: string }
> = {
  excellent: {
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/10",
  },
  good: {
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/25",
    bg: "bg-amber-500/8",
  },
  "needs-work": {
    bar: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/25",
    bg: "bg-rose-500/8",
  },
};
