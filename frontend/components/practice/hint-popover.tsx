"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { cn } from "@/lib/utils";

const MAX_HINTS = 3;

type HintPopoverProps = {
  hints: string[];
  hintCount: number;
  loading: boolean;
  onRequestHint: (n: number) => void;
};

export function HintPopover({ hints, hintCount, loading, onRequestHint }: HintPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const autoFetchedRef = useRef(false);

  const nextHintNumber = hintCount + 1;
  const canRevealMore = hintCount < MAX_HINTS;
  const nextAvailable = canRevealMore && (nextHintNumber === 1 || hintCount >= nextHintNumber - 1);
  const nextHintPending = nextAvailable && !(hints[nextHintNumber - 1]?.trim() ?? "");

  const revealedHints = hints
    .map((h, i) => ({ n: i + 1, content: h }))
    .filter((h) => h.content.trim().length > 0);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      autoFetchedRef.current = false;
      return;
    }
    if (loading || !nextHintPending || autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    onRequestHint(nextHintNumber);
  }, [open, loading, nextHintPending, nextHintNumber, onRequestHint]);

  function handleToggle() {
    setOpen((o) => !o);
  }

  function handleRevealNext() {
    if (!nextAvailable || loading) return;
    onRequestHint(nextHintNumber);
  }

  const showNextButton =
    canRevealMore && revealedHints.length > 0 && !nextHintPending && !loading;

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          "h-7 gap-1.5 px-2 text-xs",
          open ? "bg-primary/10 text-primary" : "text-muted-foreground"
        )}
        onClick={handleToggle}
        title={
          canRevealMore
            ? `Hints (${hintCount}/${MAX_HINTS} revealed)`
            : `All ${MAX_HINTS} hints revealed`
        }
      >
        <Lightbulb className={cn("size-3.5", hintCount > 0 && "text-amber-500")} />
        <span className="tabular-nums">
          {hintCount}/{MAX_HINTS}
        </span>
      </Button>

      {open && (
        <div
          className="panel-card absolute top-full right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden"
          role="dialog"
          aria-label="Hints"
        >
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/25 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              <span className="text-sm font-semibold">Hints</span>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {hintCount}/{MAX_HINTS}
            </span>
          </div>

          <div className="max-h-[min(320px,50vh)] overflow-y-auto p-4">
            {loading && revealedHints.length === 0 && (
              <div className="sub-card flex items-center gap-2 border-dashed p-4">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Loading hint {nextHintNumber}…
                </span>
              </div>
            )}

            {revealedHints.map((h, i) => (
              <div key={h.n} className={cn("sub-card p-3", i > 0 && "mt-3")}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                  Hint {h.n}
                </p>
                <MarkdownContent content={h.content} />
              </div>
            ))}

            {loading && revealedHints.length > 0 && (
              <div className="sub-card mt-3 flex items-center gap-2 border-dashed p-3">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Loading hint {nextHintNumber}…
                </span>
              </div>
            )}
          </div>

          {(showNextButton || !canRevealMore) && (
            <div className="border-t border-border/50 bg-muted/15 px-4 py-3">
              {showNextButton ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={handleRevealNext}
                >
                  <Lightbulb className="mr-1.5 size-3.5" />
                  Next hint ({nextHintNumber}/{MAX_HINTS})
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  All hints revealed
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
