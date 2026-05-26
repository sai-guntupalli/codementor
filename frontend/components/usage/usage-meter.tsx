"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UsageOut } from "@/lib/api";

const FEATURE_LABELS: Record<string, string> = {
  code_review: "Code Review",
  code_quality_review: "Critique",
  hints_lazy: "Hints",
  hint_generate: "Hints",
  solution_generator: "Solution",
  teach_me: "Teach",
  freeform: "Chat",
  practice_chat: "Chat",
  surprise_me: "Surprise Me",
  llm_stream: "AI Stream",
};

function featureLabel(name: string): string {
  return FEATURE_LABELS[name] ?? name.replace(/_/g, " ");
}

function formatResetsAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

type UsageMeterProps = {
  usage: UsageOut;
  className?: string;
  compact?: boolean;
};

export function UsageMeter({ usage, className, compact = false }: UsageMeterProps) {
  const pct =
    usage.calls_limit > 0
      ? Math.min(100, Math.round((usage.calls_used / usage.calls_limit) * 100))
      : 0;
  const atLimit = usage.calls_used >= usage.calls_limit;
  const approaching = !atLimit && pct >= 80;

  const breakdownEntries = Object.entries(usage.breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {usage.calls_used} / {usage.calls_limit} calls used
        </p>
        {atLimit && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
            Limit reached
          </span>
        )}
        {approaching && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            Approaching limit
          </span>
        )}
      </div>

      <div
        className="stitch-progress h-2"
        role="progressbar"
        aria-valuenow={usage.calls_used}
        aria-valuemin={0}
        aria-valuemax={usage.calls_limit}
      >
        <div
          className={cn(
            "stitch-progress-fill h-2 transition-all duration-500",
            atLimit && "!bg-destructive",
            approaching && !atLimit && "!bg-amber-500"
          )}
          style={{ width: `${Math.max(pct, usage.calls_used > 0 ? 4 : 0)}%` }}
        />
      </div>

      {!compact && (
        <>
          <p className="text-xs text-muted-foreground">
            Cost this month: ${usage.cost_usd_month.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">Resets {formatResetsAt(usage.resets_at)}</p>

          {breakdownEntries.length > 0 && (
            <div className="space-y-3 border-t border-border/50 pt-4">
              <p className="text-xs font-medium text-muted-foreground">By feature</p>
              <ul className="space-y-3">
                {breakdownEntries.map(([name, count]) => {
                  const featurePct =
                    usage.calls_used > 0
                      ? Math.round((count / usage.calls_used) * 100)
                      : 0;
                  return (
                    <li key={name}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-foreground/90">
                          {featureLabel(name)}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {count} · {featurePct}%
                        </span>
                      </div>
                      <div className="stitch-progress h-1.5">
                        <div
                          className="stitch-progress-fill h-1.5 transition-all"
                          style={{ width: `${Math.max(featurePct, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {atLimit && (
            <p className="text-xs text-muted-foreground">
              <Link href="/settings" className="font-medium text-primary hover:underline">
                Upgrade to Pro
              </Link>{" "}
              for a higher monthly limit.
            </p>
          )}
        </>
      )}
    </div>
  );
}
