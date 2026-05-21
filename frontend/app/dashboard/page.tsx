"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  ListChecks,
  Play,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type UserOut,
  type SubmissionHistoryItem,
  type LearningPathOut,
  type LearningPathProblem,
  type SolvedProblemIdsOut,
} from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPathProblem[]>([]);
  const [learningPathMessage, setLearningPathMessage] = useState("");
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const [user, submissions, path, solved] = await Promise.all([
          apiFetch<UserOut>("/users/me", { token }),
          apiFetch<SubmissionHistoryItem[]>("/submissions/me?limit=5", { token }),
          apiFetch<LearningPathOut>("/users/me/learning-path", { token }),
          apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }).catch(
            () => ({ solved_ids: [] as string[] })
          ),
        ]);
        if (!user.is_profile_complete) {
          router.replace("/profile/setup");
          return;
        }
        setProfile(user);
        setRecentSubmissions(submissions);
        setLearningPath(path.problems.slice(0, 5));
        setLearningPathMessage(path.message);
        setSolvedIds(new Set(solved.solved_ids));
      } catch {
        router.replace("/login");
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

  const solvedCount = solvedIds.size;

  const continueHref = useMemo(() => {
    const next = learningPath.find((p) => !solvedIds.has(p.id));
    if (next) return `/practice/${next.id}`;
    if (learningPath[0]) return `/practice/${learningPath[0].id}`;
    if (recentSubmissions[0]) return `/practice/${recentSubmissions[0].problem_id}`;
    return "/problems";
  }, [learningPath, recentSubmissions, solvedIds]);

  if (loading) {
    return (
      <AppShell>
        <div className="workspace-canvas min-h-full p-4 md:p-6">
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="panel-card h-36 animate-pulse bg-card/60" />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="panel-card h-80 animate-pulse bg-card/60 lg:col-span-2" />
              <div className="panel-card h-80 animate-pulse bg-card/60" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const displayName = profile?.display_name ?? "there";
  const streak = profile?.streak_days ?? 0;

  return (
    <AppShell>
      <div className="workspace-canvas min-h-full">
        <div className="mx-auto max-w-6xl space-y-4 p-4 md:space-y-5 md:p-6">
          {/* Hero */}
          <section className="panel-card overflow-hidden bg-card">
            <div className="relative bg-gradient-to-br from-primary/15 via-card to-card px-5 py-6 md:px-8 md:py-8">
              <p className="text-sm font-medium text-primary">Welcome back</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                Hi, {displayName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {learningPathMessage ||
                  "Pick up where you left off — practice, get AI feedback, and unlock hints as you go."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={continueHref}>
                  <Button size="sm" className="gap-2 shadow-sm">
                    <Play className="size-3.5" />
                    {recentSubmissions.length > 0 ? "Continue coding" : "Start practicing"}
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
                <Link href="/problems">
                  <Button size="sm" variant="outline">
                    Browse problems
                  </Button>
                </Link>
                <Link href="/learn">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <BookOpen className="size-3.5" />
                    Learning path
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              icon={<Zap className="size-4 text-primary" />}
              label="Total XP"
              value={profile?.xp_total?.toLocaleString() ?? "0"}
            />
            <StatCard
              icon={<Target className="size-4 text-emerald-500" />}
              label="Solved"
              value={String(solvedCount)}
              hint="problems with submissions"
            />
            <StatCard
              icon={<Flame className={cn("size-4", streak > 0 ? "text-orange-500" : "text-muted-foreground")} />}
              label="Streak"
              value={`${streak} ${streak === 1 ? "day" : "days"}`}
              hint={streak === 0 ? "Solve a problem today" : undefined}
            />
            <StatCard
              icon={<Sparkles className="size-4 text-violet-500" />}
              label="Skills"
              value={`${skillEntries.length} tracked`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            {/* Main column — learning path */}
            <div className="space-y-4 lg:col-span-2">
              <section className="panel-card flex flex-col bg-card">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 md:px-5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">Recommended for you</h2>
                  </div>
                  <Link
                    href="/learn"
                    className="text-xs font-medium text-primary transition-colors hover:underline"
                  >
                    Full path →
                  </Link>
                </div>

                {learningPath.length > 0 ? (
                  <ul className="divide-y divide-border/50 p-2 md:p-3">
                    {learningPath.map((p, idx) => {
                      const done = solvedIds.has(p.id);
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/practice/${p.id}`}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-3 transition-all",
                              "hover:bg-muted/50",
                              done && "opacity-80"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                                done
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {done ? <CheckCircle2 className="size-4" /> : idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{p.title}</p>
                              <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                                {p.topic.slice(0, 3).join(" · ") || p.language}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {p.language}
                              </Badge>
                              <Badge
                                variant={difficultyBadgeVariant(p.difficulty)}
                                className="text-[10px] capitalize"
                              >
                                {p.difficulty}
                              </Badge>
                              <ChevronRight className="size-4 text-muted-foreground/50" />
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <ListChecks className="mx-auto size-8 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-medium">No recommendations yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Browse the problem library to get started.
                    </p>
                    <Link href="/problems" className="mt-4 inline-block">
                      <Button size="sm" variant="outline">
                        Explore problems
                      </Button>
                    </Link>
                  </div>
                )}
              </section>

              {/* Recent activity */}
              <section className="panel-card bg-card">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 md:px-5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">Recent activity</h2>
                  </div>
                  <Link
                    href="/progress"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View progress →
                  </Link>
                </div>
                {recentSubmissions.length > 0 ? (
                  <ul className="divide-y divide-border/50 p-2 md:p-3">
                    {recentSubmissions.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/practice/${s.problem_id}`}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.problem_title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                              {s.hints_used > 0 && ` · ${s.hints_used} hint${s.hints_used > 1 ? "s" : ""}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {s.score !== null && (
                              <span className="text-xs font-semibold tabular-nums text-primary">
                                {Math.round(s.score * 100)}%
                              </span>
                            )}
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {s.language}
                            </Badge>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No submissions yet — your first solve will show up here.
                  </p>
                )}
              </section>
            </div>

            {/* Sidebar column */}
            <div className="space-y-4">
              {streak === 0 && (
                <section className="sub-card border-amber-500/25 bg-amber-500/8 p-4">
                  <div className="flex items-start gap-3">
                    <Star className="mt-0.5 size-5 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold">Start a streak</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Submit any solution today to begin your daily streak.
                      </p>
                      <Link href={continueHref} className="mt-3 inline-block">
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          Practice now
                        </Button>
                      </Link>
                    </div>
                  </div>
                </section>
              )}

              {skillEntries.length > 0 && (
                <section className="panel-card bg-card p-4 md:p-5">
                  <h2 className="text-sm font-semibold">Skill progress</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Updates after each submission
                  </p>
                  <ul className="mt-4 space-y-3">
                    {skillEntries.slice(0, 8).map(([topic, level]) => {
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
                </section>
              )}

              <section className="panel-card bg-card p-4 md:p-5">
                <h2 className="text-sm font-semibold">Quick links</h2>
                <ul className="mt-3 space-y-1">
                  <QuickLink href="/problems" icon={ListChecks} label="Problem library" />
                  <QuickLink href="/learn" icon={BookOpen} label="Learning path" />
                  <QuickLink href="/progress" icon={TrendingUp} label="Progress & history" />
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="panel-card flex flex-col justify-center bg-card px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/80">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-bold tabular-nums tracking-tight">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <Icon className="size-4 text-primary/70" />
        {label}
        <ArrowRight className="ml-auto size-3.5 text-muted-foreground/40" />
      </Link>
    </li>
  );
}
