"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContent, PageSkeleton } from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type ProblemFacets,
  type ProblemList,
  type ProblemSort,
  type ProblemTagsOut,
  type SolvedProblemIdsOut,
  type TagCount,
} from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

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

const SORT_OPTIONS: { label: string; value: ProblemSort }[] = [
  { label: "Recommended", value: "recommended" },
  { label: "Curated order", value: "default" },
  { label: "Title A–Z", value: "title" },
  { label: "Newest", value: "newest" },
];

type Filters = {
  language: string;
  difficulty: string;
  topic: string;
  q: string;
  sort: ProblemSort;
  unsolved_only: boolean;
};

function buildParams(filters: Filters, page: number): URLSearchParams {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
    sort: filters.sort,
  });
  if (filters.language) params.set("language", filters.language);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.q) params.set("q", filters.q);
  if (filters.unsolved_only) params.set("unsolved_only", "true");
  return params;
}

function filtersFromSearchParams(sp: URLSearchParams): Filters {
  return {
    language: sp.get("language") ?? "",
    difficulty: sp.get("difficulty") ?? "",
    topic: sp.get("topic") ?? "",
    q: sp.get("q") ?? "",
    sort: (sp.get("sort") as ProblemSort) || "recommended",
    unsolved_only: sp.get("unsolved_only") === "true",
  };
}

function FilterPills({
  label,
  options,
  value,
  onChange,
  counts,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {options.map((opt) => {
        const count =
          opt.value && counts ? counts[opt.value] : counts && !opt.value ? counts["_all"] : undefined;
        return (
          <button
            key={opt.value || "all"}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              value === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {opt.label}
            {count !== undefined && (
              <span className="ml-1 tabular-nums opacity-70">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ProblemsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <PageSkeleton rows={6} />
        </AppShell>
      }
    >
      <ProblemsPageContent />
    </Suspense>
  );
}

function ProblemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [problems, setProblems] = useState<ProblemList["items"]>([]);
  const [facets, setFacets] = useState<ProblemFacets | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<TagCount[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams]
  );

  const syncUrl = useCallback(
    (next: Filters, nextPage: number) => {
      const params = buildParams(next, nextPage);
      router.replace(`/problems?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    setSearchInput(filters.q || filters.topic);
    const p = parseInt(searchParams.get("page") ?? "1", 10);
    setPage(Number.isFinite(p) && p > 0 ? p : 1);
  }, [filters.q, filters.topic, searchParams]);

  useEffect(() => {
    if (!token) return;
    const query = searchInput.trim();
    if (query.length < 1) {
      setTagSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "12" });
        if (filters.language) params.set("language", filters.language);
        if (filters.difficulty) params.set("difficulty", filters.difficulty);
        const data = await apiFetch<ProblemTagsOut>(`/problems/topic-tags?${params}`, {
          token,
        });
        setTagSuggestions(data.tags);
      } catch {
        setTagSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [searchInput, token, filters.language, filters.difficulty]);

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
        /* non-critical */
      }
    }
    authenticate();
  }, [router]);

  const fetchData = useCallback(
    async (currentFilters: Filters, currentPage: number, authToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = buildParams(currentFilters, currentPage);
        const [list, meta] = await Promise.all([
          apiFetch<ProblemList>(`/problems?${params}`, { token: authToken }),
          apiFetch<ProblemFacets>(`/problems/facets?${params}`, { token: authToken }),
        ]);
        setProblems(list.items);
        setTotal(list.total);
        setFacets(meta);
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
    if (token) fetchData(filters, page, token);
  }, [token, filters, page, fetchData]);

  function updateFilters(patch: Partial<Filters>, resetPage = true) {
    const next = { ...filters, ...patch };
    const nextPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    syncUrl(next, nextPage);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const hasActiveFilters =
    filters.language ||
    filters.difficulty ||
    filters.topic ||
    filters.q ||
    filters.unsolved_only;

  function applySearch() {
    const text = searchInput.trim();
    if (!text) {
      updateFilters({ q: "", topic: "" });
      return;
    }
    // Prefer matching a known tag exactly when the query equals a suggestion
    const exact = tagSuggestions.find((t) => t.tag === normalizeTagQuery(text));
    if (exact) {
      updateFilters({ topic: exact.tag, q: "" });
    } else {
      updateFilters({ q: text, topic: "" });
    }
  }

  function selectTopic(tag: string) {
    const next = filters.topic === tag ? "" : tag;
    updateFilters({ topic: next, q: "" });
    setSearchInput(next);
    setSearchFocused(false);
  }

  const popularTags = facets?.popular_tags ?? [];

  const difficultyCounts = useMemo(() => {
    if (!facets) return undefined;
    const all = facets.total;
    return { _all: all, ...facets.by_difficulty };
  }, [facets]);

  if (loading && !facets && problems.length === 0) {
    return (
      <AppShell>
        <PageSkeleton rows={6} />
      </AppShell>
    );
  }

  const summaryLine = facets
    ? [
        `${facets.total.toLocaleString()} in library`,
        `${facets.solved_count} solved`,
        total > 0 ? `${start}–${end} shown` : "none shown",
        totalPages > 1 ? `p.${page}/${totalPages}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <AppShell>
      <PageContent width="xl" className="space-y-3">
        <section className="panel-card bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5 md:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <ListChecks className="size-4" />
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight">Problems</h1>
                {summaryLine && (
                  <p className="truncate text-xs text-muted-foreground">{summaryLine}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Link href="/learn">
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                  <BookOpen className="size-3.5" />
                  Path
                </Button>
              </Link>
              {facets && facets.unsolved_count > 0 && (
                <Button
                  size="sm"
                  variant={filters.unsolved_only ? "secondary" : "outline"}
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() =>
                    updateFilters({ unsolved_only: !filters.unsolved_only, sort: "recommended" })
                  }
                >
                  <Sparkles className="size-3.5" />
                  Unsolved ({facets.unsolved_count})
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2.5 p-3 md:p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search title or topic (e.g. arrays, graph)…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-16 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      updateFilters({ q: "", topic: "" });
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <Button size="sm" className="h-7 px-2.5 text-xs" onClick={applySearch}>
                  Go
                </Button>
              </div>
              {searchFocused && tagSuggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-popover py-0.5 shadow-lg">
                  {tagSuggestions.map((t) => (
                    <li key={t.tag}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectTopic(t.tag)}
                      >
                        <span className="capitalize">{formatTagLabel(t.tag)}</span>
                        <span className="tabular-nums text-muted-foreground">{t.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <select
                value={filters.sort}
                onChange={(e) => updateFilters({ sort: e.target.value as ProblemSort })}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Sort"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FilterPills
                label="Lang"
                options={LANGUAGES}
                value={filters.language}
                onChange={(v) => updateFilters({ language: v })}
                counts={facets?.by_language}
              />
              <FilterPills
                label="Level"
                options={DIFFICULTIES}
                value={filters.difficulty}
                onChange={(v) => updateFilters({ difficulty: v })}
                counts={difficultyCounts}
              />
              {(filters.topic || filters.q || hasActiveFilters) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    syncUrl(
                      {
                        language: "",
                        difficulty: "",
                        topic: "",
                        q: "",
                        sort: "recommended",
                        unsolved_only: false,
                      },
                      1
                    );
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {(filters.topic || filters.q) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {filters.topic && (
                  <button
                    type="button"
                    onClick={() => selectTopic(filters.topic)}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {formatTagLabel(filters.topic)}
                    <X className="size-3" />
                  </button>
                )}
                {filters.q && !filters.topic && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                    &ldquo;{filters.q}&rdquo;
                  </span>
                )}
              </div>
            )}

            {popularTags.length > 0 && (
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 scrollbar-thin">
                {popularTags.slice(0, 14).map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => selectTopic(t.tag)}
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                      filters.topic === t.tag
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/80 bg-muted/20 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {formatTagLabel(t.tag)}
                    <span className="ml-0.5 tabular-nums opacity-60">{t.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading && (
          <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-card">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="h-12 animate-pulse bg-muted/20" />
            ))}
          </ul>
        )}

        {!loading && !error && problems.length === 0 && (
          <div className="rounded-lg border border-border/50 bg-card px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? "No problems match your filters." : "No problems published yet."}
            </p>
          </div>
        )}

        {!loading && !error && problems.length > 0 && (
          <>
            <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50 bg-card">
              {problems.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/practice/${p.id}`}
                    className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 md:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium group-hover:text-primary">
                          {p.title}
                        </span>
                        {solvedIds.has(p.id) && (
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] capitalize">
                          {p.language}
                        </Badge>
                        <Badge
                          variant={difficultyBadgeVariant(p.difficulty)}
                          className="h-5 px-1.5 text-[10px] capitalize"
                        >
                          {p.difficulty}
                        </Badge>
                        {p.topic?.slice(0, 2).map((t) => (
                          <span key={t} className="text-[10px] text-muted-foreground capitalize">
                            {formatTagLabel(t)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={page === 1}
                  onClick={() => {
                    const next = page - 1;
                    setPage(next);
                    syncUrl(filters, next);
                  }}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={page === totalPages}
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    syncUrl(filters, next);
                  }}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </PageContent>
    </AppShell>
  );
}

function normalizeTagQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
}

function formatTagLabel(tag: string): string {
  return tag.replace(/-/g, " ");
}
