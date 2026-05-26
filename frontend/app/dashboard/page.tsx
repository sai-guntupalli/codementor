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
  Route,
  Star,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ActivePathSwitcher } from "@/components/dashboard/active-path-switcher";
import { DashboardAiUsage } from "@/components/dashboard/dashboard-ai-usage";
import { DashboardBookmarks } from "@/components/dashboard/dashboard-bookmarks";
import { DashboardDailySection } from "@/components/dashboard/dashboard-daily-section";
import { DashboardPathComplete } from "@/components/dashboard/dashboard-path-complete";
import { DashboardResumeCard } from "@/components/dashboard/dashboard-resume-card";
import { DashboardSuggestedPath } from "@/components/dashboard/dashboard-suggested-path";
import { DashboardWeakTopics } from "@/components/dashboard/dashboard-weak-topics";
import { DashboardWeekStats } from "@/components/dashboard/dashboard-week-stats";
import {
  RecommendedEmpty,
  RecommendedSection,
} from "@/components/dashboard/recommended-section";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  focusLearningPath,
  type DashboardOut,
  type DailyChallengeOut,
  type DailyGoalOut,
  type LastSessionOut,
  type LearningPathListItem,
  type LearningPathProblemItem,
  type PathCompletionOut,
  type SuggestedPathOut,
  type UsageOut,
  type UserOut,
  type WeakTopicOut,
  type BookmarkSummaryOut,
  type WeekStatsOut,
} from "@/lib/api";
import {
  PRACTICE_PATH_KEY,
  recordActiveLearningPath,
  setPracticePathContext,
} from "@/lib/learning-path-context";
import {
  EXPERIENCE_MESSAGES,
  pickActiveLearningPath,
} from "@/lib/learning-path-utils";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [paths, setPaths] = useState<LearningPathListItem[]>([]);
  const [activePath, setActivePath] = useState<LearningPathListItem | null>(null);
  const [activePathProblems, setActivePathProblems] = useState<LearningPathProblemItem[]>([]);
  const [solvedCount, setSolvedCount] = useState(0);
  const [libraryTotal, setLibraryTotal] = useState<number | null>(null);
  const [usage, setUsage] = useState<UsageOut | null>(null);
  const [dailyGoal, setDailyGoal] = useState<DailyGoalOut | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeOut | null>(null);
  const [weakTopics, setWeakTopics] = useState<WeakTopicOut[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkSummaryOut[]>([]);
  const [weekStats, setWeekStats] = useState<WeekStatsOut | null>(null);
  const [lastSession, setLastSession] = useState<LastSessionOut | null>(null);
  const [pathCompletion, setPathCompletion] = useState<PathCompletionOut | null>(null);
  const [suggestedPath, setSuggestedPath] = useState<SuggestedPathOut | null>(null);
  const [pathsStartedCount, setPathsStartedCount] = useState(0);
  const [hasAnySubmission, setHasAnySubmission] = useState(false);
  const [resumeHasDraft, setResumeHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingPath, setSwitchingPath] = useState(false);

  function applyDashboard(data: DashboardOut) {
    setProfile(data.user);
    setPaths(data.learning_paths);
    setSolvedCount(data.solved_count);
    setLibraryTotal(data.library_total);
    setUsage(data.usage);
    setDailyGoal(data.daily_goal);
    setDailyChallenge(data.daily_challenge);
    setWeakTopics(data.weak_topics);
    setBookmarks(data.bookmarks);
    setWeekStats(data.week_stats);
    setLastSession(data.last_session);
    setPathCompletion(data.path_completion);
    setSuggestedPath(data.suggested_path);
    setPathsStartedCount(data.paths_started_count);
    setHasAnySubmission(data.has_any_submission);
    const selected =
      data.learning_paths.find((p) => p.id === data.active_path_id) ??
      pickActiveLearningPath(data.learning_paths, data.active_path_id);
    setActivePath(selected ?? null);
    setActivePathProblems(data.active_path_problems);
    if (data.last_session && typeof window !== "undefined") {
      setResumeHasDraft(
        Boolean(localStorage.getItem(`cm_code_${data.last_session.problem_id}`))
      );
    } else {
      setResumeHasDraft(false);
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        let data = await apiFetch<DashboardOut>("/dashboard/me", { token });
        if (!data.user.is_profile_complete) {
          router.replace("/profile/setup");
          return;
        }

        const stored =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PRACTICE_PATH_KEY)
            : null;
        if (
          stored &&
          stored !== data.active_path_id &&
          data.learning_paths.some((p) => p.id === stored)
        ) {
          await focusLearningPath(token, stored);
          setPracticePathContext(stored);
          data = await apiFetch<DashboardOut>("/dashboard/me", { token });
        }

        applyDashboard(data);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  async function handlePathSwitch(pathId: string) {
    const supabase = createClient();
    const token = await getValidatedAccessToken(supabase);
    if (!token) return;
    setSwitchingPath(true);
    try {
      setPracticePathContext(pathId);
      await focusLearningPath(token, pathId);
      const data = await apiFetch<DashboardOut>("/dashboard/me", { token });
      applyDashboard(data);
    } finally {
      setSwitchingPath(false);
    }
  }

  const recommendationSubtitle = useMemo(() => {
    if (!activePath) return undefined;
    if (activePath.type === "personalized") {
      const experience = profile?.coding_experience ?? "none";
      return EXPERIENCE_MESSAGES[experience] ?? EXPERIENCE_MESSAGES.none;
    }
    return activePath.description ?? undefined;
  }, [activePath, profile?.coding_experience]);

  const continueHref = useMemo(() => {
    const next = activePathProblems.find((p) => !p.solved);
    if (next && activePath) {
      return `/practice/${next.id}?path=${encodeURIComponent(activePath.id)}`;
    }
    if (activePathProblems[0] && activePath) {
      return `/practice/${activePathProblems[0].id}?path=${encodeURIComponent(activePath.id)}`;
    }
    if (lastSession) {
      const base = `/practice/${lastSession.problem_id}`;
      return lastSession.path_id
        ? `${base}?path=${encodeURIComponent(lastSession.path_id)}`
        : base;
    }
    return "/problems";
  }, [activePath, activePathProblems, lastSession]);

  function handleContinueClick() {
    if (!activePath) return;
    const supabase = createClient();
    void getValidatedAccessToken(supabase).then((token) => {
      recordActiveLearningPath(activePath.id, token);
    });
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingSkeleton />
      </AppShell>
    );
  }

  const displayName = profile?.display_name ?? "there";
  const streak = profile?.streak_days ?? 0;

  return (
    <AppShell>
      <div className="workspace-canvas min-h-full">
        <div className="mx-auto max-w-6xl space-y-4 p-4 md:space-y-5 md:p-6">
          <section className="panel-card overflow-hidden">
            <div className="relative px-5 py-6 md:px-8 md:py-8">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-primary/3"
                aria-hidden
              />
              <p className="relative font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-primary uppercase">
                Welcome back
              </p>
              <h1 className="relative mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                Hi, {displayName}
              </h1>
              <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {recommendationSubtitle ||
                  (activePath
                    ? `Continue ${activePath.title} — practice, get AI feedback, and unlock hints as you go.`
                    : "Pick up where you left off — practice, get AI feedback, and unlock hints as you go.")}
              </p>
              <div className="relative mt-5 flex flex-wrap gap-2">
                <Link href={continueHref} onClick={handleContinueClick}>
                  <Button size="sm" className="gap-2 shadow-sm">
                    <Play className="size-3.5" />
                    {hasAnySubmission ? "Continue coding" : "Start practicing"}
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
                <Link href="/problems?sort=recommended">
                  <Button size="sm" variant="outline">
                    {libraryTotal != null
                      ? `Browse ${libraryTotal.toLocaleString()} problems`
                      : "Browse problems"}
                  </Button>
                </Link>
                <Link href="/learn">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <BookOpen className="size-3.5" />
                    All paths
                  </Button>
                </Link>
              </div>
            </div>
          </section>

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
              icon={<Route className="size-4 text-violet-500" />}
              label="Paths started"
              value={`${pathsStartedCount}`}
              hint={`of ${paths.length} available`}
            />
          </div>

          {weekStats && <DashboardWeekStats stats={weekStats} />}

          {pathCompletion && <DashboardPathComplete completion={pathCompletion} />}

          {suggestedPath && (
            <DashboardSuggestedPath
              suggested={suggestedPath}
              onSelect={() => {
                const supabase = createClient();
                void getValidatedAccessToken(supabase).then((token) => {
                  recordActiveLearningPath(suggestedPath.path_id, token);
                });
              }}
            />
          )}

          <DashboardGrid
            activePath={activePath}
            activePathProblems={activePathProblems}
            recommendationSubtitle={recommendationSubtitle}
            paths={paths}
            continueHref={continueHref}
            handleContinueClick={handleContinueClick}
            onPathSwitch={handlePathSwitch}
            switchingPath={switchingPath}
            streak={streak}
            usage={usage}
            dailyGoal={dailyGoal}
            dailyChallenge={dailyChallenge}
            weakTopics={weakTopics}
            bookmarks={bookmarks}
            lastSession={lastSession}
            resumeHasDraft={resumeHasDraft}
            hasAnySubmission={hasAnySubmission}
            pathsStartedCount={pathsStartedCount}
          />
        </div>
      </div>
    </AppShell>
  );
}

function LoadingSkeleton() {
  return (
    <div className="workspace-canvas min-h-full p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="panel-card h-36 animate-pulse bg-card/60" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel-card h-80 animate-pulse bg-card/60 lg:col-span-2" />
          <div className="panel-card h-80 animate-pulse bg-card/60" />
        </div>
      </div>
    </div>
  );
}

function DashboardGrid({
  activePath,
  activePathProblems,
  recommendationSubtitle,
  paths,
  continueHref,
  handleContinueClick,
  onPathSwitch,
  switchingPath,
  streak,
  usage,
  dailyGoal,
  dailyChallenge,
  weakTopics,
  bookmarks,
  lastSession,
  resumeHasDraft,
  hasAnySubmission,
  pathsStartedCount,
}: {
  activePath: LearningPathListItem | null;
  activePathProblems: LearningPathProblemItem[];
  recommendationSubtitle?: string;
  paths: LearningPathListItem[];
  continueHref: string;
  handleContinueClick: () => void;
  onPathSwitch: (pathId: string) => void;
  switchingPath: boolean;
  streak: number;
  usage: UsageOut | null;
  dailyGoal: DailyGoalOut | null;
  dailyChallenge: DailyChallengeOut | null;
  weakTopics: WeakTopicOut[];
  bookmarks: BookmarkSummaryOut[];
  lastSession: LastSessionOut | null;
  resumeHasDraft: boolean;
  hasAnySubmission: boolean;
  pathsStartedCount: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      <div className="space-y-4 lg:col-span-2">
        {lastSession && (
          <DashboardResumeCard
            session={lastSession}
            hasLocalDraft={resumeHasDraft}
            onResume={handleContinueClick}
          />
        )}

        {dailyGoal && (
          <DashboardDailySection
            dailyGoal={dailyGoal}
            dailyChallenge={dailyChallenge}
            onPracticeClick={handleContinueClick}
          />
        )}

        {activePath && activePathProblems.length > 0 ? (
          <RecommendedSection
            activePath={activePath}
            problems={activePathProblems}
            subtitle={recommendationSubtitle}
            allPaths={paths}
          />
        ) : (
          <RecommendedEmpty pathsStartedCount={pathsStartedCount} hasAnySubmission={hasAnySubmission} />
        )}

        <DashboardWeakTopics topics={weakTopics} />
        <DashboardBookmarks bookmarks={bookmarks} />
      </div>

      <SidebarColumn
        activePath={activePath}
        activePathProblems={activePathProblems}
        paths={paths}
        continueHref={continueHref}
        handleContinueClick={handleContinueClick}
        onPathSwitch={onPathSwitch}
        switchingPath={switchingPath}
        streak={streak}
        usage={usage}
      />
    </div>
  );
}

function SidebarColumn({
  activePath,
  activePathProblems,
  paths,
  continueHref,
  handleContinueClick,
  onPathSwitch,
  switchingPath,
  streak,
  usage,
}: {
  activePath: LearningPathListItem | null;
  activePathProblems: LearningPathProblemItem[];
  paths: LearningPathListItem[];
  continueHref: string;
  handleContinueClick: () => void;
  onPathSwitch: (pathId: string) => void;
  switchingPath: boolean;
  streak: number;
  usage: UsageOut | null;
}) {
  const pathSolved = activePathProblems.filter((p) => p.solved).length;
  const pathTotal = activePathProblems.length;
  const pathPct = pathTotal > 0 ? Math.round((pathSolved / pathTotal) * 100) : 0;
  const nextProblem = activePathProblems.find((p) => !p.solved) ?? null;

  return (
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
              <Link href={continueHref} onClick={handleContinueClick} className="mt-3 inline-block">
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  Practice now
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {activePath && pathTotal > 0 && (
        <section className="panel-card p-4 md:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Route className="size-4 shrink-0 text-primary" />
              <h2 className="text-sm font-semibold">Active path</h2>
            </div>
            <ActivePathSwitcher
              paths={paths}
              activePathId={activePath.id}
              onSelect={onPathSwitch}
              disabled={switchingPath}
            />
          </div>
          <p className="mt-1.5 text-xs font-medium text-foreground">{activePath.title}</p>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{pathSolved} of {pathTotal} complete</span>
              <span className="tabular-nums font-medium text-foreground">{pathPct}%</span>
            </div>
            <div className="stitch-progress h-2">
              <div
                className="stitch-progress-fill h-2"
                style={{ width: `${Math.max(pathPct, pathSolved > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>

          {nextProblem ? (
            <Link
              href={`/practice/${nextProblem.id}?path=${encodeURIComponent(activePath.id)}`}
              onClick={handleContinueClick}
              className="group mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <ChevronRight className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium group-hover:text-primary">
                {nextProblem.title}
              </span>
            </Link>
          ) : (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Path complete
            </div>
          )}
        </section>
      )}

      {usage && <DashboardAiUsage usage={usage} />}

      <section className="panel-card p-4 md:p-5">
        <h2 className="text-sm font-semibold">Quick links</h2>
        <ul className="mt-3 space-y-1">
          <QuickLink href="/problems" icon={ListChecks} label="Problem library" />
          <QuickLink href="/learn" icon={BookOpen} label="Learning paths" />
          <QuickLink href="/progress" icon={TrendingUp} label="Progress & history" />
        </ul>
      </section>
    </div>
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
    <div className="panel-card flex flex-col justify-center px-4 py-3.5">
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
