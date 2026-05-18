"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CheckCircle, Eye, Lightbulb } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UserOut, type SubmissionHistoryItem } from "@/lib/api";

export default function ProgressPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
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
        const [user, subs] = await Promise.all([
          apiFetch<UserOut>("/users/me", { token }),
          apiFetch<SubmissionHistoryItem[]>("/submissions/me?limit=50", { token }),
        ]);
        setProfile(user);
        setSubmissions(subs);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
          ))}
        </div>
      </AppShell>
    );
  }

  const skillEntries = Object.entries(
    (profile?.skill_level as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a);

  const langCounts = submissions.reduce<Record<string, number>>((acc, s) => {
    acc[s.language] = (acc[s.language] ?? 0) + 1;
    return acc;
  }, {});

  const scoredSubs = submissions.filter((s) => s.score !== null);
  const avgScore =
    scoredSubs.length > 0
      ? scoredSubs.reduce((sum, s) => sum + (s.score ?? 0), 0) / scoredSubs.length
      : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your coding journey — submissions, skill levels, and consistency.
        </p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Problems solved" value={String(submissions.length)} />
          <MiniStat label="XP earned" value={(profile?.xp_total ?? 0).toLocaleString()} />
          <MiniStat label="Streak" value={`${profile?.streak_days ?? 0}d`} />
          <MiniStat
            label="Avg score"
            value={avgScore !== null ? `${Math.round(avgScore * 100)}%` : "—"}
          />
        </div>

        {/* Language breakdown */}
        {Object.keys(langCounts).length > 0 && (
          <div className="mt-6 rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">By language</h2>
            <div className="flex gap-3">
              {Object.entries(langCounts).map(([lang, count]) => (
                <div key={lang} className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {lang}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill breakdown */}
        {skillEntries.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Skill levels</h2>
            <ul className="space-y-2.5">
              {skillEntries.map(([topic, level]) => (
                <li key={topic} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs font-medium capitalize text-foreground/80">
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

        {/* Submission history */}
        <div className="mt-4">
          <h2 className="mb-3 text-sm font-semibold">Submission history</h2>
          {submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
              <BarChart3 className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                No submissions yet. Solve a problem to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Problem</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Lang</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Hints</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border/50 last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="truncate font-medium">{s.problem_title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {s.language}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.score !== null ? (
                          <span className="font-medium text-primary">
                            {Math.round(s.score * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="flex items-center justify-end gap-1 text-muted-foreground">
                          {s.hints_used > 0 && (
                            <>
                              <Lightbulb className="size-3" />
                              {s.hints_used}
                            </>
                          )}
                          {s.solution_viewed && <Eye className="size-3 ml-1" />}
                          {s.hints_used === 0 && !s.solution_viewed && (
                            <CheckCircle className="size-3 text-emerald-500" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
