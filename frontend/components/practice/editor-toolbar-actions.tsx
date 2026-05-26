"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EditorToolbarActionsProps = {
  canRun: boolean;
  running: boolean;
  streaming: boolean;
  onRun: () => void;
  onSubmit: () => void;
  isReviewing: boolean;
  submitDisabled: boolean;
  reviewComplete: boolean;
  submissionPassed: boolean;
  aiSubmitReview: boolean;
  submitTitle: string;
};

export function EditorToolbarActions({
  canRun,
  running,
  streaming,
  onRun,
  onSubmit,
  isReviewing,
  submitDisabled,
  reviewComplete,
  submissionPassed,
  aiSubmitReview,
  submitTitle,
}: EditorToolbarActionsProps) {
  const submitLabel = isReviewing
    ? aiSubmitReview
      ? "Reviewing…"
      : "Checking…"
    : reviewComplete
      ? submissionPassed
        ? "Submit again"
        : "Resubmit"
      : aiSubmitReview
        ? "Submit"
        : "Submit";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2.5 text-xs"
        disabled={running || streaming || !canRun}
        onClick={onRun}
        title={canRun ? "Run tests (⌘/Ctrl+Enter)" : "Run is only available for Python"}
      >
        {running ? (
          <>
            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Running…
          </>
        ) : (
          <>
            <Play className="size-3" />
            Run
          </>
        )}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={reviewComplete ? "outline" : "default"}
        className={cn("h-7 gap-1 px-2.5 text-xs", !reviewComplete && "shadow-sm")}
        disabled={submitDisabled}
        onClick={onSubmit}
        title={submitTitle}
      >
        {submitLabel}
      </Button>
    </>
  );
}
