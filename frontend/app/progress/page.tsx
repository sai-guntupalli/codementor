"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Eye,
  Flame,
  Lightbulb,
  ListChecks,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
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
  type SubmissionHistoryItem,
  type UserOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ProgressPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPathOut | null>(null);
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
        const [user, subs, path, solved] = await Promise.all([
          apiFetch<UserOut>("/users/me", { token }),
          apiFetch<SubmissionHistoryItem[]>("/submissions/me?limit=50", { token }),
          apiFetch<LearningPathOut>("/users/me/learning-path", { token }),
          apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }),
        ]);
        setProfile(user);
        setSubmissions(subs);
        setLearningPath(path);
        setSolvedIds(new Set(solved.solved_ids));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const skillEntries = useMemo(
    () =>
      Object.entries((profile?.skill_level as Record<string, number>) ?? {}).sort(
        ([, a], [, b]) => b - a
      ),
    [profile?.skill_level]
  );

  const langCounts = useMemo(
    () =>
      submissions.reduce<Record<string, number>>((acc, s) => {
        acc[s.language] = (acc[s.language] ?? 0) + 1;
        return acc;
      }, {}),
    [submissions]
  );

  const scoredSubs = submissions.filter((s) => s.score !== null);
  const avgScore =
    scoredSubs.length > 0
      ? scoredSubs.reduce((sum, s) => sum + (s.score ?? 0), 0) / scoredSubs.length
      : null;

  const streak = profile?.streak_days ?? 0;
  const solvedCount = solvedIds.size;
  const pathTotal = learningPath?.problems.length ?? 0;
  const pathCompleted = useMemo(() => {
    if (!learningPath || pathTotal === 0) return 0;
    return learningPath.problems.filter((p) => solvedIds.has(p.id)).length;
  }, [learningPath, pathTotal, solvedIds]);
  const pathPct = pathTotal > 0 ? Math.round((pathCompleted / pathTotal) * 100) : 0;
  const pathComplete = pathTotal > 0 && pathCompleted === pathTotal;

  const continueHref = useMemo(() => {
    const nextInPath = learningPath?.problems.find((p) => !solvedIds.has(p.id));
    if (nextInPath) return `/practice/${nextInPath.id}`;
    const nextExtra = (learningPath?.next_problems ?? []).find((p) => !solvedIds.has(p.id));
    if (nextExtra) return `/practice/${nextExtra.id}`;
    if (submissions[0]) return `/practice/${submissions[0].problem_id}`;
    return "/problems";
  }, [learningPath, solvedIds, submissions]);

  const continueLabel = useMemo(() => {
    const nextInPath = learningPath?.problems.find((p) => !solvedIds.has(p.id));
    if (nextInPath) return `Continue: ${nextInPath.title}`;
    const nextExtra = (learningPath?.next_problems ?? []).find((p) => !solvedIds.has(p.id));
    if (nextExtra) return `Practice: ${nextExtra.title}`;
    if (submissions[0]) return "Practice again";
    return "Start practicing";
  }, [learningPath, solvedIds, submissions]);

  const nextAfterPath = useMemo(() => {
    return (learningPath?.next_problems ?? [])
      .filter((p) => !solvedIds.has(p.id))
      .slice(0, 5);
  }, [learningPath, solvedIds]);

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
          icon={<TrendingUp className="size-5" />}
          eyebrow="Your journey"
          title="Progress"
          description="Track submissions, skill levels, and consistency over time."
        >
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={continueHref}>
              <Button size="sm" className="gap-2 shadow-sm">
                <Play className="size-3.5" />
                {continueLabel}
                <ChevronRight className="size-3.5" />
              </Button>
            </Link>
            <Link href="/learn">
              <Button size="sm" variant="outline" className="gap-1.5">
                <BookOpen className="size-3.5" />
                Learning path
              </Button>
            </Link>
            <Link href="/problems">
              <Button size="sm" variant="outline">
                Browse problems
              </Button>
            </Link>
          </div>
          {pathTotal > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Learning path: {pathCompleted} of {pathTotal} completed
                </span>
                <span className="font-medium tabular-nums text-foreground">{pathPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(pathPct, pathCompleted > 0 ? 4 : 0)}%` }}
                />
              </div>
              {pathComplete && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Path complete — keep practicing to grow your streak and skills.
                </p>
              )}
            </div>
          )}
        </PageHero>

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <PageStatGrid>
          <PageStat
            icon={<Target className="size-4 text-emerald-500" />}
            label="Problems solved"
            value={String(solvedCount)}
            hint={`${submissions.length} submission${submissions.length === 1 ? "" : "s"}`}
          />
          <PageStat
            icon={<Zap className="size-4 text-primary" />}
            label="XP earned"
            value={(profile?.xp_total ?? 0).toLocaleString()}
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
          <PageStat
            icon={<Award className="size-4 text-violet-500" />}
            label="Avg score"
            value={avgScore !== null ? `${Math.round(avgScore * 100)}%` : "—"}
            hint={
              scoredSubs.length > 0
                ? `from ${scoredSubs.length} reviewed`
                : "submit for AI review"
            }
          />
        </PageStatGrid>

        {pathComplete && nextAfterPath.length > 0 && (
          <PageSection
            title="Keep practicing"
            description="Recommended problems beyond your completed path"
            icon={<Sparkles className="size-4 text-primary" />}
            action={{ href: "/problems", label: "All problems →" }}
          >
            <ul className="divide-y divide-border/50 p-2 md:p-3">
              {nextAfterPath.map((problem) => (
                <RecommendedRow key={problem.id} problem={problem} />
              ))}
            </ul>
          </PageSection>
        )}

        {Object.keys(langCounts).length > 0 && (
          <PageSection
            title="By language"
            description="Submissions per language"
            icon={<BarChart3 className="size-4 text-primary" />}
          >
            <ul className="space-y-3 p-4 md:p-5">
              {Object.entries(langCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([lang, count]) => {
                  const pct =
                    submissions.length > 0
                      ? Math.round((count / submissions.length) * 100)
                      : 0;
                  return (
                    <li key={lang}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {lang}
                        </Badge>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {count} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary/80 transition-all"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </PageSection>
        )}

        {skillEntries.length > 0 && (
          <PageSection
            title="Skill levels"
            description="Confidence by topic from your reviews"
            icon={<TrendingUp className="size-4 text-primary" />}
          >
            <ul className="space-y-3 p-4 md:p-5">
              {skillEntries.map(([topic, level]) => {
                const pct = Math.round(level * 100);
                return (
                  <li key={topic}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium capitalize">
                        {topic.replace(/_/g, " ")}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </PageSection>
        )}

        <PageSection
          title="Submission history"
          description="Recent practice sessions — tap to reopen"
          icon={<ListChecks className="size-4 text-primary" />}
          action={
            submissions.length > 0
              ? { href: "/problems", label: "New problem →" }
              : undefined
          }
        >
          {submissions.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <ListChecks className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">No submissions yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Solve a problem to start tracking XP, skills, and streaks.
              </p>
              <Link href="/problems" className="mt-4 inline-block">
                <Button size="sm" className="gap-2 shadow-sm">
                  Browse problems
                  <ChevronRight className="size-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/50 p-2 md:p-3">
              {submissions.map((s) => (
                <SubmissionRow key={s.id} submission={s} />
              ))}
            </ul>
          )}
        </PageSection>
      </PageContent>
    </AppShell>
  );
}

function RecommendedRow({ problem }: { problem: LearningPathProblem }) {
  return (
    <li>
      <Link
        href={`/practice/${problem.id}`}
        className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-muted/50"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ChevronRight className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-primary">
            {problem.title}
          </p>
          <Badge variant="secondary" className="mt-1 text-[10px] capitalize">
            {problem.difficulty}
          </Badge>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </Link>
    </li>
  );
}

function SubmissionRow({ submission }: { submission: SubmissionHistoryItem }) {
  const scorePct =
    submission.score !== null ? Math.round(submission.score * 100) : null;
  const dateLabel = new Date(submission.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li>
      <Link
        href={`/practice/${submission.problem_id}`}
        className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-muted/50"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            scorePct !== null && scorePct >= 90
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {scorePct !== null ? (
            <span className="text-[10px] tabular-nums">{scorePct}%</span>
          ) : (
            <CheckCircle2 className="size-4 opacity-60" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-primary">
            {submission.problem_title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px] capitalize">
              {submission.language}
            </Badge>
            <span>{dateLabel}</span>
            {submission.hints_used > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Lightbulb className="size-3" />
                {submission.hints_used} hint{submission.hints_used === 1 ? "" : "s"}
              </span>
            )}
            {submission.solution_viewed && (
              <span className="inline-flex items-center gap-0.5">
                <Eye className="size-3" />
                solution viewed
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </Link>
    </li>
  );
}
