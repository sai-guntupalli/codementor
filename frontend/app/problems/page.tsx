"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
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
  source: string;
  external_id: number | null;
};

type ProblemList = {
  items: Problem[];
  total: number;
  page: number;
  page_size: number;
};

type Filters = {
  language: string;
  difficulty: string;
  topic: string;
};

const PAGE_SIZE = 20;

const LANGUAGES = [
  { label: "All", value: "" },
  { label: "Python", value: "python" },
  { label: "SQL", value: "sql" },
];

const DIFFICULTIES = [
  { label: "All", value: "" },
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
];

export default function ProblemsPage() {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ language: "", difficulty: "", topic: "" });
  const [topicInput, setTopicInput] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function authenticate() {
      const supabase = createClient();
      const t = await getValidatedAccessToken(supabase);
      if (!t) {
        router.replace("/login");
        return;
      }
      setToken(t);
    }
    authenticate();
  }, [router]);

  const fetchProblems = useCallback(
    async (currentFilters: Filters, currentPage: number, authToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(currentPage), page_size: String(PAGE_SIZE) });
        if (currentFilters.language) params.set("language", currentFilters.language);
        if (currentFilters.difficulty) params.set("difficulty", currentFilters.difficulty);
        if (currentFilters.topic) params.set("topic", currentFilters.topic);
        const data = await apiFetch<ProblemList>(`/problems?${params}`, { token: authToken });
        setProblems(data.items);
        setTotal(data.total);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load problems";
        if (message.includes("Token expired") || message.includes("Invalid token") || message.includes("Unauthorized")) {
          router.replace("/login");
          return;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (token) fetchProblems(filters, page, token);
  }, [token, filters, page, fetchProblems]);

  function setFilter(key: keyof Filters, value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyTopicSearch() {
    setFilter("topic", topicInput.trim());
  }

  function clearTopicSearch() {
    setTopicInput("");
    setFilter("topic", "");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const hasActiveFilters = filters.language || filters.difficulty || filters.topic;

  return (
    <AppShell>
      <main className="flex min-h-0 flex-col bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-6 text-muted-foreground">
          Pick a challenge to practice in the IDE with live AI feedback.
        </p>

        {/* Filter bar */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center text-xs font-medium text-muted-foreground">Language:</span>
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                onClick={() => setFilter("language", l.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filters.language === l.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="flex items-center text-xs font-medium text-muted-foreground">Difficulty:</span>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => setFilter("difficulty", d.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filters.difficulty === d.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter by topic (e.g. arrays, dynamic programming)"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyTopicSearch()}
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {topicInput && (
                <button
                  onClick={clearTopicSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={applyTopicSearch}>
              Search
            </Button>
          </div>
        </div>

        {/* Count + reset row */}
        <div className="mb-4 flex items-center justify-between">
          {!loading && (
            <p className="text-xs text-muted-foreground">
              {total === 0
                ? "No problems found"
                : `Showing ${start}–${end} of ${total} problem${total !== 1 ? "s" : ""}`}
            </p>
          )}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilters({ language: "", difficulty: "", topic: "" });
                setTopicInput("");
                setPage(1);
              }}
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-20 animate-pulse rounded-xl border border-border/50 bg-muted/30" />
            ))}
          </ul>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && problems.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No problems match your filters."
                : "No problems yet. Run "}
            </p>
            {!hasActiveFilters && (
              <code className="mt-1 inline-block rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
                cd backend && uv run python -m seeds.problems
              </code>
            )}
          </div>
        )}

        {!loading && !error && problems.length > 0 && (
          <>
            <ul className="space-y-3">
              {problems.map((p, idx) => (
                <li key={p.id}>
                  <Link
                    href={`/practice/${p.id}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-card transition-all hover:border-primary/25 hover:shadow-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        {p.external_id && (
                          <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground/60">
                            #{p.external_id}
                          </span>
                        )}
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
                            {p.source && p.source !== "local" && (
                              <Badge variant="outline" className="capitalize">
                                {p.source}
                              </Badge>
                            )}
                            {p.topic?.slice(0, 3).map((t) => (
                              <span key={t} className="text-xs text-muted-foreground">
                                {t.replace(/_/g, " ")}
                              </span>
                            ))}
                            {(p.topic?.length ?? 0) > 3 && (
                              <span className="text-xs text-muted-foreground/60">
                                +{p.topic.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      </main>
    </AppShell>
  );
}
