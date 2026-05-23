"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import { difficultyBadgeVariant } from "@/lib/tags";
import { cn } from "@/lib/utils";

export type ProblemExample = {
  input: string;
  output: string;
  explanation?: string;
};

export type ProblemDescriptionData = {
  title: string;
  description: string;
  language: string;
  difficulty: string;
  examples: ProblemExample[];
  constraints: string | null;
};

function isPlaceholder(s: string) {
  return /see description/i.test(s) || s.trim() === "" || s.trim().toLowerCase() === "n/a";
}

export function getValidExamples(examples: ProblemExample[] | undefined) {
  return (examples ?? []).filter(
    (ex) => !isPlaceholder(ex.input) && !isPlaceholder(ex.output)
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
    </button>
  );
}

type ProblemDescriptionProps = {
  problem: ProblemDescriptionData;
  showTitle?: boolean;
  compact?: boolean;
  className?: string;
};

export function ProblemDescription({
  problem,
  showTitle = true,
  compact = false,
  className,
}: ProblemDescriptionProps) {
  const validExamples = getValidExamples(problem.examples);

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-4", className)}>
      {showTitle && (
        <>
          <h1
            className={cn(
              "font-semibold leading-tight",
              compact ? "text-base" : "text-lg"
            )}
          >
            {problem.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {problem.language}
            </Badge>
            <Badge
              variant={difficultyBadgeVariant(problem.difficulty)}
              className="capitalize"
            >
              {problem.difficulty}
            </Badge>
          </div>
        </>
      )}

      <MarkdownContent content={problem.description} />

      {validExamples.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Examples
          </p>
          {validExamples.map((ex, i) => (
            <div key={i} className="sub-card p-3 text-xs">
              <p className="mb-2 font-semibold text-foreground/70">Example {i + 1}</p>
              <div className="space-y-1.5 font-mono">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1">
                    <span className="text-muted-foreground">Input: </span>
                    <span className="whitespace-pre-wrap text-foreground">{ex.input}</span>
                  </p>
                  <CopyButton text={ex.input} />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1">
                    <span className="text-muted-foreground">Output: </span>
                    <span className="whitespace-pre-wrap text-foreground">{ex.output}</span>
                  </p>
                  <CopyButton text={ex.output} />
                </div>
                {ex.explanation && (
                  <p className="mt-1.5 font-sans text-muted-foreground">
                    <span className="font-medium">Explanation: </span>
                    {ex.explanation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {problem.constraints && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Constraints
          </p>
          <div className="sub-card px-3 py-2.5 text-sm">
            <MarkdownContent content={problem.constraints} />
          </div>
        </div>
      )}
    </div>
  );
}
