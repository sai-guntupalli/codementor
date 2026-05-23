import { cn } from "@/lib/utils";
import {
  getScoreLabel,
  getScoreTier,
  scorePercent,
  SCORE_TIER_STYLES,
} from "@/lib/submission-score";

type SubmissionScoreProps = {
  score: number;
  className?: string;
  compact?: boolean;
};

export function SubmissionScoreBadge({ score, className }: SubmissionScoreProps) {
  const pct = scorePercent(score);
  const tier = getScoreTier(score);
  const styles = SCORE_TIER_STYLES[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        styles.border,
        styles.bg,
        styles.text,
        className
      )}
    >
      Score {pct}%
    </span>
  );
}

export function SubmissionScoreCard({ score, className, compact }: SubmissionScoreProps) {
  const pct = scorePercent(score);
  const tier = getScoreTier(score);
  const styles = SCORE_TIER_STYLES[tier];
  const label = getScoreLabel(score);

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
          styles.border,
          styles.bg,
          className
        )}
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Submission score
          </p>
          <p className={cn("text-lg font-bold tabular-nums", styles.text)}>{pct}%</p>
        </div>
        <span className={cn("text-xs font-medium", styles.text)}>{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "sub-card rounded-xl border p-4",
        styles.border,
        styles.bg,
        className
      )}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Submission score
          </p>
          <p className={cn("mt-0.5 text-3xl font-bold tabular-nums tracking-tight", styles.text)}>
            {pct}%
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            styles.border,
            styles.text
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", styles.bar)}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Based on correctness and how closely your solution meets the problem requirements.
      </p>
    </div>
  );
}
