"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LearningPathListItem, LearningPathProblemItem } from "@/lib/api";
import { setPracticePathContext } from "@/lib/learning-path-context";
import {
  otherLearningPaths,
  PATH_TYPE_LABELS,
} from "@/lib/learning-path-utils";
import { difficultyBadgeVariant } from "@/lib/tags";
import { cn } from "@/lib/utils";

type RecommendedSectionProps = {
  activePath: LearningPathListItem;
  problems: LearningPathProblemItem[];
  subtitle?: string;
  allPaths: LearningPathListItem[];
};

function practiceHref(pathId: string, problemId: string) {
  return `/practice/${problemId}?path=${encodeURIComponent(pathId)}`;
}

export function RecommendedSection({
  activePath,
  problems,
  subtitle,
  allPaths,
}: RecommendedSectionProps) {
  const { progress } = activePath;
  const nextIdx = problems.findIndex((p) => !p.solved);
  const nextProblem = nextIdx >= 0 ? problems[nextIdx] : null;
  const windowStart =
    nextIdx >= 0 ? Math.max(0, nextIdx - 1) : Math.max(0, problems.length - 5);
  const visibleProblems = problems.slice(windowStart, windowStart + 5);
  const others = otherLearningPaths(allPaths, activePath.id);

  return (
    <section className="panel-card flex flex-col bg-card">
      <HeaderBlock
        activePath={activePath}
        progress={progress}
        subtitle={subtitle}
      />

      {nextProblem && (
        <div className="border-b border-border/50 px-4 py-3 md:px-5">
          <Link
            href={practiceHref(activePath.id, nextProblem.id)}
            onClick={() => setPracticePathContext(activePath.id)}
            className="group flex items-center justify-between gap-3 rounded-xl bg-primary/8 px-4 py-3 transition-colors hover:bg-primary/12"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                {progress.progress_pct === 0 ? "Start here" : "Up next"}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold group-hover:text-primary">
                {nextProblem.title}
              </p>
            </div>
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm">
              Continue
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </div>
      )}

      <ul className="divide-y divide-border/50 p-2 md:p-3">
        {visibleProblems.map((p) => {
          const isNext = p.id === nextProblem?.id;
          const globalIdx = problems.findIndex((item) => item.id === p.id);
          return (
            <li key={p.id}>
              <Link
                href={practiceHref(activePath.id, p.id)}
                onClick={() => setPracticePathContext(activePath.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-muted/50",
                  p.solved && "opacity-75",
                  isNext && "bg-primary/5 ring-1 ring-primary/15"
                )}
              >
                <span className="shrink-0">
                  {p.solved ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <Circle
                      className={cn(
                        "size-5",
                        isNext ? "text-primary" : "text-muted-foreground/40"
                      )}
                    />
                  )}
                </span>
                <ProblemRowMeta problem={p} index={globalIdx} isNext={isNext} />
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
              </Link>
            </li>
          );
        })}
      </ul>

      {others.length > 0 && (
        <div className="border-t border-border/50 px-4 py-3 md:px-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Also in progress
          </p>
          <div className="flex flex-wrap gap-2">
            {others.map((path) => (
              <Link
                key={path.id}
                href={`/learn/${path.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-muted/40"
              >
                <span className="max-w-[140px] truncate">{path.title}</span>
                <span className="tabular-nums text-muted-foreground">
                  {path.progress.progress_pct}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function HeaderBlock({
  activePath,
  progress,
  subtitle,
}: {
  activePath: LearningPathListItem;
  progress: LearningPathListItem["progress"];
  subtitle?: string;
}) {
  return (
    <div className="border-b border-border/50 px-4 py-4 md:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <h2 className="text-sm font-semibold">Recommended for you</h2>
          </div>
          <PathTitle activePath={activePath} />
        </div>
        <Link
          href={`/learn/${activePath.id}`}
          className="shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
        >
          View path →
        </Link>
      </div>
      {(subtitle || activePath.description) && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {subtitle ?? activePath.description}
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.solved_count} of {progress.total_count} solved
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {progress.progress_pct}%
          </span>
        </div>
        <ProgressBar progress={progress} />
      </div>
    </div>
  );
}

function PathTitle({ activePath }: { activePath: LearningPathListItem }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <p className="truncate text-sm font-medium text-foreground/90">
        {activePath.title}
      </p>
      <Badge variant="secondary" className="text-[10px]">
        {PATH_TYPE_LABELS[activePath.type]}
      </Badge>
    </div>
  );
}

function ProgressBar({
  progress,
}: {
  progress: LearningPathListItem["progress"];
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-2 rounded-full bg-primary transition-all"
        style={{
          width: `${Math.max(progress.progress_pct, progress.solved_count > 0 ? 4 : 0)}%`,
        }}
      />
    </div>
  );
}

function ProblemRowMeta({
  problem,
  index,
  isNext,
}: {
  problem: LearningPathProblemItem;
  index: number;
  isNext: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-medium">{problem.title}</p>
        {isNext && <Badge className="shrink-0 text-[10px]">Next</Badge>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-xs tabular-nums text-muted-foreground">#{index + 1}</span>
        <Badge
          variant={difficultyBadgeVariant(problem.difficulty)}
          className="text-[10px] capitalize"
        >
          {problem.difficulty}
        </Badge>
        {problem.topic.slice(0, 2).map((t) => (
          <span key={t} className="text-xs capitalize text-muted-foreground">
            {t.replace(/-/g, " ")}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RecommendedEmpty() {
  return (
    <section className="panel-card flex flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 md:px-5">
        <BookOpen className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Recommended for you</h2>
      </div>
      <div className="px-5 py-10 text-center">
        <BookOpen className="mx-auto size-8 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium">No learning paths yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Browse curated tracks or complete your profile for a personalized path.
        </p>
        <Link href="/learn" className="mt-4 inline-block">
          <Button size="sm" variant="outline" className="gap-1.5">
            Explore paths
            <ChevronRight className="size-3.5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
