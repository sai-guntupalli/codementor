import { CheckCircle2 } from "lucide-react";
import { scorePercent } from "@/lib/submission-score";
import { cn } from "@/lib/utils";

type SolvedBannerProps = {
  score: number | null;
  submittedAt: string;
  hasDraft?: boolean;
  onRestoreSubmission?: () => void;
  className?: string;
};

/** Compact one-line status when revisiting a completed problem */
export function SolvedBanner({
  score,
  submittedAt,
  hasDraft,
  onRestoreSubmission,
  className,
}: SolvedBannerProps) {
  const dateLabel = new Date(submittedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-2",
        className
      )}
    >
      <p className="flex min-w-0 items-center gap-2 text-xs">
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium text-emerald-800 dark:text-emerald-300">Solved</span>
        {score != null && (
          <span className="tabular-nums text-muted-foreground">{scorePercent(score)}%</span>
        )}
        <span className="text-muted-foreground">· {dateLabel}</span>
      </p>
      {hasDraft && onRestoreSubmission && (
        <button
          type="button"
          onClick={onRestoreSubmission}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Restore submission
        </button>
      )}
    </div>
  );
}
