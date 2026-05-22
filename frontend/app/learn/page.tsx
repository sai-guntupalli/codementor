"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  PartyPopper,
  Sparkles,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  PageContent,
  PageHero,
  PageSection,
  PageSkeleton,
  PageStat,
  PageStatGrid,
} from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type LearningPathOut,
  type LearningPathProblem,
  type SolvedProblemIdsOut,
  type UserOut,
} from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";
import { cn } from "@/lib/utils";

export default function LearnPage() {
  const router = useRouter();
  const [learningPath, setLearningPath] = useState<LearningPathOut | null>(null);
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const [path, solved, user] = await Promise.all([
          apiFetch<LearningPathOut>("/users/me/learning-path", { token }),
          apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }),
          apiFetch<UserOut>("/users/me", { token }),
        ]);
        setLearningPath(path);
        setSolvedIds(new Set(solved.solved_ids));
        setProfile(user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const solvedCount = useMemo(() => {
    if (!learningPath) return 0;
    return learningPath.problems.filter((p) => solvedIds.has(p.id)).length;
  }, [learningPath, solvedIds]);

  const totalCount = learningPath?.problems.length ?? 0;
  const progressPct =
    totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  const nextProblem = useMemo(() => {
    return learningPath?.problems.find((p) => !solvedIds.has(p.id));
  }, [learningPath, solvedIds]);

  const pathComplete = totalCount > 0 && solvedCount === totalCount;
  const nextAfterPath = useMemo(() => {
    const extras = learningPath?.next_problems ?? [];
    return extras.filter((p) => !solvedIds.has(p.id)).slice(0, 6);
  }, [learningPath, solvedIds]);

  const streak = profile?.streak_days ?? 0;
  const libraryTotal = learningPath?.library_total ?? 0;

  if (loading) {
    return (
      <AppShell>
        <PageSkeleton rows={6} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContent width="lg">
        <PageHero
          icon={<BookOpen className="size-5" />}
          eyebrow="Personalized for you"
          title="Your Learning Path"
          description={
            <>
              {learningPath?.message ||
                "A beginner-friendly sequence — work through each step at your own pace."}
              {libraryTotal > 0 && (
                <span className="mt-2 block text-xs text-muted-foreground">
                  Your path highlights {totalCount} of {libraryTotal.toLocaleString()} problems
                  matched to your level
                  {learningPath?.difficulties?.length
                    ? ` (${learningPath.difficulties.join(", ")})`
                    : ""}
                  .
                </span>
              )}
            </>
          }
        >
          {libraryTotal > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/problems?sort=recommended&unsolved_only=true"
                className="inline-block"
              >
                <Button size="sm" variant="outline" className="gap-1.5">
                  Browse full library
                  <ChevronRight className="size-3.5" />
                </Button>
              </Link>
            </div>
          )}
          {totalCount > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {solvedCount} of {totalCount} completed
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {progressPct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(progressPct, solvedCount > 0 ? 4 : 0)}%` }}
                />
              </div>
              {nextProblem && (
                <Link href={`/practice/${nextProblem.id}`} className="mt-3 inline-block">
                  <Button size="sm" className="gap-2 shadow-sm">
                    Continue: {nextProblem.title}
                    <ChevronRight className="size-3.5" />
                  </Button>
                </Link>
              )}
              {pathComplete && (
                <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <PartyPopper className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-semibold text-foreground">
                        Learning path complete!
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        You finished every step. Keep your streak going with more problems below, or
                        browse the full library.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/problems?sort=recommended&unsolved_only=true">
                          <Button size="sm" variant="outline" className="gap-1.5">
                            Browse unsolved problems
                          </Button>
                        </Link>
                        <Link href="/progress">
                          <Button size="sm" variant="outline" className="gap-1.5">
                            View progress
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </PageHero>

        {totalCount > 0 && (
          <PageStatGrid>
            <PageStat
              icon={<Target className="size-4 text-emerald-500" />}
              label="Completed"
              value={String(solvedCount)}
            />
            <PageStat
              icon={<BookOpen className="size-4 text-primary" />}
              label="In path"
              value={String(totalCount)}
            />
            <PageStat
              label="Remaining"
              value={String(totalCount - solvedCount)}
              hint={pathComplete ? "Path complete!" : undefined}
            />
            <PageStat
              icon={
                <Flame
                  className={`size-4 ${streak > 0 ? "text-orange-500" : "text-muted-foreground"}`}
                />
              }
              label="Streak"
              value={`${streak}d`}
              hint={streak === 0 ? "Submit today to start" : undefined}
            />
          </PageStatGrid>
        )}

        {pathComplete && nextAfterPath.length > 0 && (
          <PageSection
            title="Keep practicing"
            description="More problems picked for you — outside your completed path"
            icon={<Sparkles className="size-4 text-primary" />}
          >
            <ul className="divide-y divide-border/50 p-2 md:p-3">
              {nextAfterPath.map((problem) => (
                <ProblemStep
                  key={problem.id}
                  problem={problem}
                  index={0}
                  solved={solvedIds.has(problem.id)}
                  isNext={false}
                  isLast={false}
                  showIndex={false}
                />
              ))}
            </ul>
          </PageSection>
        )}

        {pathComplete && nextAfterPath.length === 0 && (
          <div className="sub-card rounded-xl border-border/50 bg-card px-5 py-4 text-center shadow-sm">
            <p className="text-sm font-medium">You&apos;re caught up on recommendations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Explore the full problem library for more practice.
            </p>
            <Link href="/problems" className="mt-3 inline-block">
              <Button size="sm" className="gap-2 shadow-sm">
                Browse problems
                <ChevronRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!error && learningPath && (
          <PageSection
            title="Steps"
            description={
              totalCount === 0
                ? "No problems in your path yet"
                : pathComplete
                  ? "Review any step or pick up from Keep practicing above"
                  : "Tap a step to open the practice workspace"
            }
            icon={<BookOpen className="size-4 text-primary" />}
          >
            {learningPath.problems.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <BookOpen className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">No learning path yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Complete your profile or browse problems to get recommendations.
                </p>
                <Link href="/problems" className="mt-4 inline-block">
                  <Button size="sm" variant="outline">
                    Browse problems
                  </Button>
                </Link>
              </div>
            ) : (
              <ol className="divide-y divide-border/50 p-2 md:p-3">
                {learningPath.problems.map((problem, idx) => (
                  <ProblemStep
                    key={problem.id}
                    problem={problem}
                    index={idx + 1}
                    solved={solvedIds.has(problem.id)}
                    isNext={nextProblem?.id === problem.id}
                    isLast={idx === learningPath.problems.length - 1}
                  />
                ))}
              </ol>
            )}
          </PageSection>
        )}
      </PageContent>
    </AppShell>
  );
}

function ProblemStep({
  problem,
  index,
  solved,
  isNext,
  isLast,
  showIndex = true,
}: {
  problem: LearningPathProblem;
  index: number;
  solved: boolean;
  isNext: boolean;
  isLast: boolean;
  showIndex?: boolean;
}) {
  return (
    <li className="relative">
      {showIndex && !isLast && (
        <span
          className={cn(
            "absolute left-[1.35rem] top-12 bottom-0 w-px",
            solved ? "bg-emerald-500/30" : "bg-border/60"
          )}
          aria-hidden
        />
      )}
      <Link
        href={`/practice/${problem.id}`}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all",
          "hover:bg-muted/50",
          solved && "opacity-90",
          isNext && "ring-1 ring-primary/25 bg-primary/5"
        )}
      >
        <span
          className={cn(
            "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            solved
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : isNext
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          )}
        >
          {solved ? (
            <CheckCircle2 className="size-4" />
          ) : showIndex ? (
            index
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium group-hover:text-primary">
              {problem.title}
            </p>
            {isNext && !solved && (
              <Badge variant="default" className="shrink-0 text-[10px]">
                Up next
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={difficultyBadgeVariant(problem.difficulty)}
              className="text-[10px] capitalize"
            >
              {problem.difficulty}
            </Badge>
            {problem.topic.slice(0, 3).map((t) => (
              <span key={t} className="text-xs capitalize text-muted-foreground">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </Link>
    </li>
  );
}
