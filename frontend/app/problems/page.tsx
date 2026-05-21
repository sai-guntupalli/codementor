"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, ListChecks, Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContent, PageHero, PageSection } from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type SolvedProblemIdsOut } from "@/lib/api";
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
  { label: "Beginner", value: "beginner" },
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
];

function FilterPills({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function authenticate() {
      const supabase = createClient();
      const t = await getValidatedAccessToken(supabase);
      if (!t) {
        router.replace("/login");
        return;
      }
      setToken(t);
      try {
        const data = await apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", {
          token: t,
        });
        setSolvedIds(new Set(data.solved_ids));
      } catch {
        // non-critical
      }
    }
    authenticate();
  }, [router]);

  const fetchProblems = useCallback(
    async (currentFilters: Filters, currentPage: number, authToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          page_size: String(PAGE_SIZE),
        });
        if (currentFilters.language) params.set("language", currentFilters.language);
        if (currentFilters.difficulty) params.set("difficulty", currentFilters.difficulty);
        if (currentFilters.topic) params.set("topic", currentFilters.topic);
        const data = await apiFetch<ProblemList>(`/problems?${params}`, { token: authToken });
        setProblems(data.items);
        setTotal(data.total);
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
      <PageContent width="md">
        <PageHero
          icon={<ListChecks className="size-5" />}
          eyebrow="Practice library"
          title="Problems"
          description="Pick a challenge to practice in the IDE with live AI feedback."
        />

        <PageSection
          title="Filters"
          icon={<Search className="size-4 text-primary" />}
        >
          <div className="space-y-4 p-4 md:p-5">
            <FilterPills
              label="Language:"
              options={LANGUAGES}
              value={filters.language}
              onChange={(v) => setFilter("language", v)}
            />
            <FilterPills
              label="Difficulty:"
              options={DIFFICULTIES}
              value={filters.difficulty}
              onChange={(v) => setFilter("difficulty", v)}
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by topic (e.g. arrays, strings)"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyTopicSearch()}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
        </PageSection>

        <div className="flex items-center justify-between px-1">
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
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="panel-card h-20 animate-pulse bg-card/60" />
            ))}
          </ul>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && problems.length === 0 && (
          <div className="panel-card px-4 py-12 text-center">
            <ListChecks className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No problems match your filters."
                : "No problems yet. Run "}
            </p>
            {!hasActiveFilters && (
              <code className="mt-2 inline-block rounded-lg bg-muted px-2 py-1 font-mono text-xs text-foreground">
                cd backend && uv run python -m seeds.problems
              </code>
            )}
          </div>
        )}

        {!loading && !error && problems.length > 0 && (
          <>
            <ul className="space-y-3">
              {problems.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/practice/${p.id}`}
                    className="panel-card group flex items-center justify-between gap-4 bg-card p-4 transition-all hover:shadow-[var(--shadow-panel-hover)] md:p-5"
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
                            {solvedIds.has(p.id) && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" />
                                Solved
                              </span>
                            )}
                            <Badge variant="secondary" className="capitalize">
                              {p.language}
                            </Badge>
                            <Badge
                              variant={difficultyBadgeVariant(p.difficulty)}
                              className="capitalize"
                            >
                              {p.difficulty}
                            </Badge>
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
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
      </PageContent>
    </AppShell>
  );
}
