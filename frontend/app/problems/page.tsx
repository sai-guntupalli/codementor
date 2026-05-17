"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch } from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";

type Problem = {
  id: string;
  title: string;
  language: string;
  difficulty: string;
  topic: string[];
};

type ProblemList = {
  items: Problem[];
  total: number;
};

export default function ProblemsPage() {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [error, setError] = useState<string | null>(null);
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
        const data = await apiFetch<ProblemList>("/problems", { token });
        setProblems(data.items);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load problems";
        if (
          message.includes("Token expired") ||
          message.includes("Invalid token") ||
          message.includes("Unauthorized")
        ) {
          router.replace("/login");
          return;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  return (
    <main className="min-h-screen bg-background">
      <AppHeader
        crumbs={[{ label: "Dashboard", href: "/dashboard" }]}
        title="Problems"
      />

      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-8 text-muted-foreground">
          Pick a challenge to practice in the IDE with live AI feedback.
        </p>

        {loading && <p className="text-sm text-muted-foreground">Loading problems…</p>}
        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {!loading && !error && problems.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No problems yet. Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              cd backend && uv run python -m seeds.problems
            </code>
          </p>
        )}
        <ul className="space-y-3">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/practice/${p.id}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-card transition-all hover:border-primary/25 hover:shadow-lg"
              >
                <div className="min-w-0">
                  <h2 className="font-semibold tracking-tight group-hover:text-primary">
                    {p.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {p.language}
                    </Badge>
                    <Badge variant={difficultyBadgeVariant(p.difficulty)} className="capitalize">
                      {p.difficulty}
                    </Badge>
                    {p.topic?.slice(0, 2).map((t) => (
                      <span key={t} className="text-xs text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="shrink-0 gap-1">
                  Practice
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
