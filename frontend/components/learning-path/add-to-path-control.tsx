"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, BookmarkCheck, BookmarkPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  apiFetch,
  type LearningPathListItem,
  type LearningPathProblemItem,
} from "@/lib/api";
import { getCached, setCached, invalidateCachePrefix } from "@/lib/api-cache";
import { cn } from "@/lib/utils";
import { NewPathForm } from "./new-path-form";

type MembershipMap = Record<string, Set<string>>;

function buildMembership(
  paths: LearningPathListItem[],
  memberships: Record<string, string[]>
): MembershipMap {
  const map: MembershipMap = {};
  for (const path of paths) {
    map[path.id] = new Set(memberships[path.id] ?? []);
  }
  return map;
}

export function useCustomPaths(token: string | null) {
  const [customPaths, setCustomPaths] = useState<LearningPathListItem[]>([]);
  const [membership, setMembership] = useState<MembershipMap>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const cacheKey = "learning-paths";
      let all = force ? null : getCached<LearningPathListItem[]>(cacheKey, token);
      if (!all) {
        all = await apiFetch<LearningPathListItem[]>("/learning-paths", { token });
        setCached(cacheKey, token, all);
      }
      const custom = all.filter((p) => p.type === "custom");
      setCustomPaths(custom);

      if (custom.length === 0) {
        setMembership({});
        return;
      }

      const entries = await Promise.all(
        custom.map(async (path) => {
          const probKey = `learning-paths/${path.id}/problems`;
          let problems = force ? null : getCached<LearningPathProblemItem[]>(probKey, token);
          if (!problems) {
            problems = await apiFetch<LearningPathProblemItem[]>(
              `/learning-paths/${path.id}/problems`,
              { token }
            );
            setCached(probKey, token, problems);
          }
          return [path.id, problems.map((p) => p.id)] as const;
        })
      );
      setMembership(buildMembership(custom, Object.fromEntries(entries)));
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Expose a hard-refresh (bypasses cache) for after mutations.
  const forceRefresh = useCallback(() => {
    invalidateCachePrefix("learning-paths");
    return refresh(true);
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { customPaths, membership, loading, refresh: forceRefresh, setCustomPaths, setMembership };
}

export function AddToPathControl({
  problemId,
  token,
  customPaths,
  membership,
  onPathsChange,
  onMembershipChange,
  onToast,
}: {
  problemId: string;
  token: string;
  customPaths: LearningPathListItem[];
  membership: MembershipMap;
  onPathsChange: (paths: LearningPathListItem[]) => void;
  onMembershipChange: (next: MembershipMap) => void;
  onToast: (message: string, variant?: "info" | "error") => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const inAnyPath = customPaths.some((p) => membership[p.id]?.has(problemId));

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function togglePath(pathId: string) {
    const inPath = membership[pathId]?.has(problemId);
    setBusy(true);
    try {
      if (inPath) {
        await apiFetch(`/learning-paths/${pathId}/problems/${problemId}`, {
          method: "DELETE",
          token,
        });
        const next = { ...membership, [pathId]: new Set(membership[pathId]) };
        next[pathId].delete(problemId);
        onMembershipChange(next);
        onToast("Removed from path", "info");
      } else {
        await apiFetch(`/learning-paths/${pathId}/problems`, {
          method: "POST",
          token,
          body: JSON.stringify({ problem_id: problemId }),
        });
        const next = { ...membership, [pathId]: new Set(membership[pathId] ?? []) };
        next[pathId].add(problemId);
        onMembershipChange(next);
        onToast("Added to path", "info");
      }
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      if (msg.includes("Already in this path")) {
        onToast("Already in this path", "info");
      } else if (msg.includes("cannot be edited")) {
        onToast("This path can't be edited", "error");
      } else {
        onToast(msg, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
          setShowCreate(false);
        }}
        className={cn(
          "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          inAnyPath && "text-primary"
        )}
        aria-label="Add to learning path"
      >
        {inAnyPath ? (
          <BookmarkCheck className="size-4" />
        ) : (
          <BookmarkPlus className="size-4" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-border bg-popover py-1 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {showCreate ? (
            <div className="p-2">
              <NewPathForm
                token={token}
                compact
                onCancel={() => setShowCreate(false)}
                onCreated={(path) => {
                  onPathsChange([...customPaths, path]);
                  onMembershipChange({ ...membership, [path.id]: new Set() });
                  setShowCreate(false);
                  onToast(`Created "${path.title}"`, "info");
                }}
              />
            </div>
          ) : (
            <>
              {customPaths.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No custom paths yet
                </p>
              )}
              {customPaths.map((path) => {
                const checked = membership[path.id]?.has(problemId);
                return (
                  <button
                    key={path.id}
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => togglePath(path.id)}
                  >
                    {checked ? (
                      <BookmarkCheck className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{path.title}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className="w-full border-t border-border/60 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowCreate(true)}
              >
                Create new path…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function BulkAddBar({
  selectedIds,
  token,
  customPaths,
  onDone,
  onToast,
  onPathsChange,
  onRefreshMembership,
}: {
  selectedIds: string[];
  token: string;
  customPaths: LearningPathListItem[];
  onDone: () => void;
  onToast: (message: string, variant?: "info" | "error") => void;
  onPathsChange: (paths: LearningPathListItem[]) => void;
  onRefreshMembership?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function addToPath(pathId: string) {
    setBusy(true);
    setOpen(false);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((problemId) =>
          apiFetch(`/learning-paths/${pathId}/problems`, {
            method: "POST",
            token,
            body: JSON.stringify({ problem_id: problemId }),
          })
        )
      );

      let added = 0;
      let skipped = 0;
      let failed = 0;
      let lastError = "";

      for (const result of results) {
        if (result.status === "fulfilled") {
          added += 1;
        } else {
          const msg =
            result.reason instanceof Error ? result.reason.message : "Request failed";
          if (msg.includes("Already in this path")) {
            skipped += 1;
          } else {
            failed += 1;
            lastError = msg;
          }
        }
      }

      if (added > 0) {
        onRefreshMembership?.();
      }

      if (failed > 0 && added === 0 && skipped === 0) {
        onToast(lastError || "Bulk add failed", "error");
        return;
      }

      const parts: string[] = [];
      if (added > 0) parts.push(`Added ${added} problem${added === 1 ? "" : "s"}`);
      if (skipped > 0) parts.push(`${skipped} already in path`);
      if (failed > 0) parts.push(`${failed} failed`);
      onToast(parts.join(" · ") || "No changes", failed > 0 ? "error" : "info");
      if (added > 0 || skipped > 0) onDone();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Bulk add failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const bar = (
    <div
      ref={menuRef}
      className="glass-panel fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 px-4 py-3 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Adding…
            </span>
          ) : (
            `${selectedIds.length} selected`
          )}
        </span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setOpen((v) => !v)}
            >
              Add to path ▾
            </Button>
            {open && (
              <div
                className="absolute bottom-full right-0 z-[110] mb-1 w-52 rounded-lg border border-border bg-popover py-1 shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {showCreate ? (
                  <div className="p-2">
                    <NewPathForm
                      token={token}
                      compact
                      onCancel={() => setShowCreate(false)}
                      onCreated={(path) => {
                        onPathsChange([...customPaths, path]);
                        setShowCreate(false);
                        void addToPath(path.id);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    {customPaths.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        No paths yet — create one below
                      </p>
                    )}
                    {customPaths.map((path) => (
                      <button
                        key={path.id}
                        type="button"
                        disabled={busy}
                        className="block w-full px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void addToPath(path.id)}
                      >
                        {path.title}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={busy}
                      className="w-full border-t px-3 py-2 text-left text-xs font-medium text-primary hover:bg-muted disabled:opacity-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowCreate(true)}
                    >
                      Create new path…
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(bar, document.body);
}
