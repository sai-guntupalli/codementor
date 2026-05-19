"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type LearningPathOut,
  type LearningPathProblem,
  type SolvedProblemIdsOut,
} from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";

export default function LearnPage() {
  const router = useRouter();
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
        const [path, solved] = await Promise.all([
          apiFetch<LearningPathOut>("/users/me/learning-path", { token }),
          apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }),
        ]);
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

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-6 py-10">
          <div className="h-7 w-48 animate-pulse rounded-xl bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-muted/60" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-border/50 bg-muted/40"
              />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Your Learning Path</h1>
        {learningPath?.message && (
          <p className="mt-1 text-sm text-muted-foreground">{learningPath.message}</p>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {!error && learningPath && (
          <ol className="mt-8 space-y-3">
            {learningPath.problems.map((problem, idx) => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                index={idx + 1}
                solved={solvedIds.has(problem.id)}
              />
            ))}
          </ol>
        )}
      </div>
    </AppShell>
  );
}

function ProblemCard({
  problem,
  index,
  solved,
}: {
  problem: LearningPathProblem;
  index: number;
  solved: boolean;
}) {
  return (
    <li>
      <Link
        href={`/practice/${problem.id}`}
        className={`group flex items-center gap-4 rounded-xl border bg-card px-4 py-3 shadow-card transition-all hover:shadow-md ${
          solved
            ? "border-emerald-500/20 hover:border-emerald-500/40"
            : "border-border/80 hover:border-primary/30"
        }`}
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            solved
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {solved ? <CheckCircle2 className="size-4" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-primary">{problem.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={difficultyBadgeVariant(problem.difficulty)}
              className="capitalize text-xs"
            >
              {problem.difficulty}
            </Badge>
            {problem.topic.slice(0, 3).map((t) => (
              <span key={t} className="text-xs text-muted-foreground capitalize">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
      </Link>
    </li>
  );
}
