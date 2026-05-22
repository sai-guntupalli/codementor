"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  PageContent,
  PageHeader,
  PageSection,
  PageSkeleton,
} from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type LearningPathListItem,
  type LearningPathProblemItem,
} from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { setPracticePathContext } from "@/lib/learning-path-context";

const TYPE_LABELS: Record<string, string> = {
  curated: "CURATED",
  personalized: "PERSONALIZED",
  custom: "CUSTOM",
};

export default function LearnPathDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pathId = params.id as string;

  const [pathMeta, setPathMeta] = useState<LearningPathListItem | null>(null);
  const [problems, setProblems] = useState<LearningPathProblemItem[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (authToken: string) => {
      const [allPaths, pathProblems] = await Promise.all([
        apiFetch<LearningPathListItem[]>("/learning-paths", { token: authToken }),
        apiFetch<LearningPathProblemItem[]>(
          `/learning-paths/${pathId}/problems`,
          { token: authToken }
        ),
      ]);
      const meta = allPaths.find((p) => p.id === pathId);
      if (!meta) {
        throw new Error("Learning path not found");
      }
      setPathMeta(meta);
      setProblems(pathProblems);
    },
    [pathId]
  );

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const t = await getValidatedAccessToken(supabase);
      if (!t) {
        router.replace("/login");
        return;
      }
      setToken(t);
      try {
        await load(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, load]);

  const isCustom = pathMeta?.type === "custom";
  const nextUnsolved = useMemo(
    () => problems.find((p) => !p.solved),
    [problems]
  );

  async function removeProblem(problemId: string) {
    if (!token) return;
    try {
      await apiFetch(`/learning-paths/${pathId}/problems/${problemId}`, {
        method: "DELETE",
        token,
      });
      setProblems((prev) => prev.filter((p) => p.id !== problemId));
      if (pathMeta) {
        const total = pathMeta.progress.total_count - 1;
        const solved = pathMeta.progress.solved_count;
        setPathMeta({
          ...pathMeta,
          progress: {
            total_count: total,
            solved_count: Math.min(solved, total),
            progress_pct: total > 0 ? Math.round((solved / total) * 100) : 0,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageSkeleton rows={6} />
      </AppShell>
    );
  }

  if (!pathMeta) {
    return (
      <AppShell>
        <PageContent width="xl">
          <p className="text-sm text-destructive">{error ?? "Path not found"}</p>
          <Link href="/learn" className="mt-4 inline-block text-sm text-primary">
            Back to paths
          </Link>
        </PageContent>
      </AppShell>
    );
  }

  const { progress } = pathMeta;

  const subtitle = [
    TYPE_LABELS[pathMeta.type] ?? pathMeta.type,
    `${progress.solved_count} of ${progress.total_count} solved`,
    `${progress.progress_pct}%`,
  ].join(" · ");

  return (
    <AppShell>
      <PageContent width="xl" className="space-y-3">
        <PageHeader
          icon={<BookOpen className="size-4" />}
          title={pathMeta.title}
          subtitle={subtitle}
          action={
            <Link
              href="/learn"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              All paths
            </Link>
          }
        >
          <div className="space-y-3">
            {pathMeta.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {pathMeta.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {TYPE_LABELS[pathMeta.type] ?? pathMeta.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {progress.solved_count} of {progress.total_count} solved ·{" "}
                {progress.progress_pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.max(progress.progress_pct, progress.solved_count > 0 ? 4 : 0)}%`,
                }}
              />
            </div>
            {nextUnsolved && (
              <Link
                href={`/practice/${nextUnsolved.id}?path=${encodeURIComponent(pathId)}`}
                className="inline-block"
                onClick={() => setPracticePathContext(pathId)}
              >
                <Button size="sm" className="gap-1.5">
                  Continue: {nextUnsolved.title}
                  <ChevronRight className="size-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </PageHeader>

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <PageSection
          title="Problems"
          description={
            isCustom
              ? "Remove problems or add more from the library"
              : "Work through each problem at your own pace"
          }
          action={
            isCustom ? { href: "/problems", label: "Add more problems" } : undefined
          }
        >
          {problems.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">No problems in this path yet.</p>
              {isCustom && (
                <Link href="/problems" className="mt-3 inline-block">
                  <Button size="sm">Browse problems</Button>
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border/50 p-2 md:p-3">
              {problems.map((problem) => (
                <li
                  key={problem.id}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/40"
                >
                  <span className="shrink-0">
                    {problem.solved ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground/50" />
                    )}
                  </span>
                  <Link
                    href={`/practice/${problem.id}?path=${encodeURIComponent(pathId)}`}
                    className="min-w-0 flex-1"
                    onClick={() => setPracticePathContext(pathId)}
                  >
                    <p className="truncate text-sm font-medium hover:text-primary">
                      {problem.title}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge
                        variant={difficultyBadgeVariant(problem.difficulty)}
                        className="text-[10px] capitalize"
                      >
                        {problem.difficulty}
                      </Badge>
                      {problem.topic.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-xs capitalize text-muted-foreground"
                        >
                          {t.replace(/-/g, " ")}
                        </span>
                      ))}
                    </div>
                  </Link>
                  {isCustom && token && (
                    <button
                      type="button"
                      onClick={() => removeProblem(problem.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove from path"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
                </li>
              ))}
            </ul>
          )}
        </PageSection>
      </PageContent>
    </AppShell>
  );
}
