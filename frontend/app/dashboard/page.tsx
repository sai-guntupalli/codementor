"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, Sparkles, Star, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UserOut, type SubmissionHistoryItem, type LearningPathOut, type LearningPathProblem } from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPathProblem[]>([]);
  const [learningPathMessage, setLearningPathMessage] = useState("");
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
        const [user, submissions, path] = await Promise.all([
          apiFetch<UserOut>("/users/me", { token }),
          apiFetch<SubmissionHistoryItem[]>("/submissions/me?limit=3", { token }),
          apiFetch<LearningPathOut>("/users/me/learning-path", { token }),
        ]);
        if (!user.is_profile_complete) {
          router.replace("/profile/setup");
          return;
        }
        setProfile(user);
        setRecentSubmissions(submissions);
        setLearningPath(path.problems.slice(0, 4));
        setLearningPathMessage(path.message);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="h-3.5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded-xl bg-muted" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-border/50 bg-muted/40" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  const skillEntries = Object.entries(
    (profile?.skill_level as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a);

  return (
    <AppShell>
      <div className="flex items-center justify-end border-b border-border/80 px-6 py-3">
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 size-4" />
          Log out
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm font-medium text-primary">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
          {profile?.display_name ? `Hi, ${profile.display_name}` : "Your coding journey"}
        </h1>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
          Practice problems, get instant AI feedback, and level up with hints tailored to your
          profile.
        </p>

        {/* Stats row */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Zap className="size-4 text-primary" />}
            label="Total XP"
            value={profile?.xp_total?.toLocaleString() ?? "0"}
          />
          <StatCard
            icon={<Star className="size-4 text-amber-500" />}
            label="Streak"
            value={`${profile?.streak_days ?? 0} days`}
          />
          <StatCard
            icon={<Sparkles className="size-4 text-violet-500" />}
            label="Skills"
            value={`${skillEntries.length} tracked`}
          />
        </div>

        {/* Skill breakdown */}
        {skillEntries.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Skill progress</h2>
            <ul className="space-y-2.5">
              {skillEntries.slice(0, 6).map(([topic, level]) => (
                <li key={topic} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs font-medium capitalize text-foreground/80">
                    {topic.replace(/_/g, " ")}
                  </span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round(level * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(level * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Learning path */}
        {learningPath.length > 0 && (
          <div className="mt-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your learning path</h2>
              <Link href="/learn" className="text-xs font-medium text-primary hover:underline">
                View full path →
              </Link>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{learningPathMessage}</p>
            <ul className="space-y-2">
              {learningPath.map((p, idx) => (
                <li key={p.id}>
                  <Link
                    href={`/practice/${p.id}`}
                    className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                          {p.topic.slice(0, 2).join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {p.language}
                      </Badge>
                      <Badge
                        variant={difficultyBadgeVariant(p.difficulty)}
                        className="capitalize text-xs"
                      >
                        {p.difficulty}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent activity */}
        {recentSubmissions.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <Link href="/progress" className="text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </div>
            <ul className="space-y-2">
              {recentSubmissions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.problem_title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {s.language}
                    </Badge>
                    {s.score !== null && (
                      <span className="text-xs font-medium tabular-nums text-primary">
                        {Math.round(s.score * 100)}%
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* First-time CTA */}
        {recentSubmissions.length === 0 && learningPath.length > 0 && (
          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <p className="text-sm font-semibold">Ready to start your journey?</p>
            <p className="mt-1 text-sm text-muted-foreground">{learningPathMessage}</p>
            <Link href={`/practice/${learningPath[0].id}`} className="mt-4 inline-block">
              <Button className="gap-2">
                Start Problem 1
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
