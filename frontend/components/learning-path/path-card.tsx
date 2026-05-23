"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LearningPathListItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<LearningPathListItem["type"], string> = {
  curated: "CURATED",
  personalized: "PERSONALIZED",
  custom: "CUSTOM",
};

export function PathCard({
  path,
  menu,
}: {
  path: LearningPathListItem;
  menu?: React.ReactNode;
}) {
  const { progress } = path;
  const actionLabel =
    progress.progress_pct === 0 ? "Start" : "Continue";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/15 p-4 transition-colors hover:border-primary/25 hover:bg-muted/25">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{path.title}</h3>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {TYPE_LABELS[path.type]}
            </Badge>
          </div>
          {path.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {path.description}
            </p>
          )}
        </div>
        {menu}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.solved_count} of {progress.total_count} solved
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {progress.progress_pct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-1.5 rounded-full bg-primary transition-all",
              progress.progress_pct === 0 && "w-0"
            )}
            style={{
              width: `${Math.max(progress.progress_pct, progress.solved_count > 0 ? 4 : 0)}%`,
            }}
          />
        </div>
      </div>

      <Link href={`/learn/${path.id}`}>
        <Button size="sm" className="w-full gap-1.5">
          {actionLabel}
          <ChevronRight className="size-3.5" />
        </Button>
      </Link>
    </div>
  );
}
