"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, MoreVertical, Plus, Route, Target, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  PageContent,
  PageHeader,
  PageSection,
  PageSkeleton,
  PageStat,
  PageStatGrid,
} from "@/components/layout/page-layout";
import { NewPathForm } from "@/components/learning-path/new-path-form";
import { PathCard } from "@/components/learning-path/path-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type LearningPathListItem } from "@/lib/api";

export default function LearnPage() {
  const router = useRouter();
  const [paths, setPaths] = useState<LearningPathListItem[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewPath, setShowNewPath] = useState(false);
  const [menuPathId, setMenuPathId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const loadPaths = useCallback(async (authToken: string) => {
    const data = await apiFetch<LearningPathListItem[]>("/learning-paths", {
      token: authToken,
    });
    setPaths(data);
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const t = await getValidatedAccessToken(supabase);
      if (!t) {
        router.replace("/login");
        return;
      }
      setToken(t);
      try {
        await loadPaths(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, loadPaths]);

  const curatedSection = useMemo(() => {
    const curated = paths.filter((p) => p.type === "curated");
    const personalized = paths.filter((p) => p.type === "personalized");
    return [...curated, ...personalized];
  }, [paths]);

  const customPaths = useMemo(
    () => paths.filter((p) => p.type === "custom"),
    [paths]
  );

  const stats = useMemo(() => {
    const totalProblems = paths.reduce((s, p) => s + p.progress.total_count, 0);
    const solved = paths.reduce((s, p) => s + p.progress.solved_count, 0);
    const pct =
      totalProblems > 0 ? Math.round((solved / totalProblems) * 100) : 0;
    return {
      pathCount: paths.length,
      curatedCount: curatedSection.length,
      customCount: customPaths.length,
      totalProblems,
      solved,
      pct,
    };
  }, [paths, curatedSection.length, customPaths.length]);

  const summaryLine = [
    `${stats.pathCount} path${stats.pathCount === 1 ? "" : "s"}`,
    stats.totalProblems > 0
      ? `${stats.solved} of ${stats.totalProblems} solved`
      : null,
    stats.customCount > 0 ? `${stats.customCount} custom` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function deletePath(pathId: string) {
    if (!token) return;
    if (!confirm("Delete this path? Problems in it will be removed from the path.")) return;
    try {
      await apiFetch(`/learning-paths/${pathId}`, { method: "DELETE", token });
      setPaths((prev) => prev.filter((p) => p.id !== pathId));
      setMenuPathId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function saveRename(pathId: string) {
    if (!token || !renameTitle.trim()) return;
    try {
      const updated = await apiFetch<LearningPathListItem>(
        `/learning-paths/${pathId}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ title: renameTitle.trim() }),
        }
      );
      setPaths((prev) => prev.map((p) => (p.id === pathId ? updated : p)));
      setRenamingId(null);
      setMenuPathId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageSkeleton rows={6} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContent width="xl" className="space-y-3">
        <PageHeader
          icon={<BookOpen className="size-4" />}
          title="Learning Paths"
          subtitle={
            summaryLine ||
            "Curated tracks, your personalized sequence, and custom collections"
          }
          action={
            token ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setShowNewPath((v) => !v)}
              >
                <Plus className="size-3.5" />
                New path
              </Button>
            ) : undefined
          }
        />

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <PageStatGrid>
          <PageStat
            icon={<Route className="size-4 text-primary" />}
            label="Paths"
            value={String(stats.pathCount)}
            hint={`${stats.curatedCount} curated & personalized`}
          />
          <PageStat
            icon={<Target className="size-4 text-emerald-500" />}
            label="Solved in paths"
            value={String(stats.solved)}
            hint={
              stats.totalProblems > 0
                ? `of ${stats.totalProblems} problems`
                : undefined
            }
          />
          <PageStat
            icon={<BookOpen className="size-4 text-violet-500" />}
            label="Custom paths"
            value={String(stats.customCount)}
          />
          <PageStat
            icon={<Target className="size-4 text-muted-foreground" />}
            label="Path progress"
            value={`${stats.pct}%`}
          />
        </PageStatGrid>

        {showNewPath && token && (
          <section className="panel-card bg-card p-3 md:p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              Create a custom path
            </p>
            <NewPathForm
              token={token}
              onCancel={() => setShowNewPath(false)}
              onCreated={(path) => {
                setPaths((prev) => [...prev, path]);
                setShowNewPath(false);
              }}
            />
          </section>
        )}

        <PageSection
          title="Curated & personalized"
          description="Official tracks and your generated learning sequence"
          icon={<BookOpen className="size-4 text-primary" />}
        >
          {curatedSection.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Complete your profile to generate a personalized path, or check back
              for curated tracks.
            </p>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 md:p-4">
              {curatedSection.map((path) => (
                <PathCard key={path.id} path={path} />
              ))}
            </div>
          )}
        </PageSection>

        <PageSection
          title="My paths"
          description="Custom collections — add problems from the library"
          action={
            <Link
              href="/problems"
              className="text-xs font-medium text-primary transition-colors hover:underline"
            >
              Browse problems
            </Link>
          }
        >
          {customPaths.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              You haven&apos;t created any paths yet. Use{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setShowNewPath(true)}
              >
                New path
              </button>{" "}
              or add problems from the library.
            </p>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 md:p-4">
              {customPaths.map((path) => (
                <PathCard
                  key={path.id}
                  path={path}
                  menu={
                    <div className="relative">
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() =>
                          setMenuPathId((id) => (id === path.id ? null : path.id))
                        }
                        aria-label="Path options"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                      {menuPathId === path.id && (
                        <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-border bg-popover py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
                            onClick={() => {
                              setRenamingId(path.id);
                              setRenameTitle(path.title);
                              setMenuPathId(null);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-destructive hover:bg-muted"
                            onClick={() => deletePath(path.id)}
                          >
                            <Trash2 className="size-3" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  }
                />
              ))}
            </div>
          )}

          {renamingId && (
            <div className="border-t border-border/50 p-3 md:p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Rename path</p>
              <div className="flex gap-2">
                <input
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                />
                <Button size="sm" onClick={() => saveRename(renamingId)}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRenamingId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </PageSection>
      </PageContent>
    </AppShell>
  );
}
