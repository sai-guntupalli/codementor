"use client";

import Link from "next/link";
import { ChevronDown, Route } from "lucide-react";
import type { LearningPathListItem } from "@/lib/api";
import { cn } from "@/lib/utils";

type ActivePathSwitcherProps = {
  paths: LearningPathListItem[];
  activePathId: string | null;
  onSelect: (pathId: string) => void;
  disabled?: boolean;
};

export function ActivePathSwitcher({
  paths,
  activePathId,
  onSelect,
  disabled,
}: ActivePathSwitcherProps) {
  const inProgress = paths
    .filter(
      (p) =>
        p.progress.total_count > 0 &&
        p.progress.progress_pct > 0 &&
        p.progress.progress_pct < 100
    )
    .sort((a, b) => b.progress.progress_pct - a.progress.progress_pct);

  const started = paths.filter(
    (p) =>
      p.progress.total_count > 0 &&
      p.progress.progress_pct === 0 &&
      p.id !== activePathId
  );

  const options = [...inProgress, ...started].filter(
    (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
  );

  if (options.length === 0) {
    return (
      <Link href="/learn" className="text-xs font-medium text-primary hover:underline">
        Browse paths
      </Link>
    );
  }

  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline",
          "[&::-webkit-details-marker]:hidden",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Route className="size-3.5" />
        Switch path
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-card p-1 shadow-lg">
        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Your paths
        </p>
        <ul className="max-h-48 overflow-y-auto">
          {options.map((path) => (
            <li key={path.id}>
              <button
                type="button"
                disabled={disabled || path.id === activePathId}
                onClick={() => onSelect(path.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors hover:bg-muted/60",
                  path.id === activePathId && "bg-primary/10 font-medium text-primary"
                )}
              >
                <span className="min-w-0 truncate">{path.title}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {path.progress.progress_pct}%
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-border/50 p-1">
          <Link
            href="/learn"
            className="block rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            View all paths →
          </Link>
        </div>
      </div>
    </details>
  );
}
