"use client";

import Link from "next/link";
import { ChevronRight, Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AiUsagePill } from "@/components/practice/ai-usage-pill";
import type { UsageOut } from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";
import { cn } from "@/lib/utils";

type PracticeHeaderProps = {
  title: string;
  language: string;
  difficulty: string;
  draftRestored?: boolean;
  usage?: UsageOut | null;
  showAiUsage?: boolean;
  actions?: React.ReactNode;
  className?: string;
};

export function PracticeHeader({
  title,
  language,
  difficulty,
  draftRestored,
  usage,
  showAiUsage = false,
  actions,
  className,
}: PracticeHeaderProps) {
  return (
    <header
      className={cn(
        "z-10 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 px-3 py-2.5 md:px-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Link
            href="/dashboard"
            className="mt-0.5 flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-80"
            aria-label="CodeMentor home"
          >
            <span className="aura-gradient flex size-8 items-center justify-center rounded-lg shadow-sm">
              <Code2 className="size-4 text-primary-foreground" strokeWidth={2.25} />
            </span>
          </Link>

          <div className="min-w-0 flex-1">
            <nav
              className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground"
              aria-label="Breadcrumb"
            >
              <Link href="/problems" className="shrink-0 transition-colors hover:text-foreground">
                Problems
              </Link>
              <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
              <span className="truncate text-foreground/70">Practice</span>
            </nav>
            <h1 className="truncate text-base font-semibold leading-tight tracking-tight md:text-lg">
              {title}
            </h1>
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{actions}</div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-1.5 md:px-4">
        <Badge variant="secondary" className="h-6 capitalize">
          {language}
        </Badge>
        <Badge variant={difficultyBadgeVariant(difficulty)} className="h-6 capitalize">
          {difficulty}
        </Badge>
        {draftRestored && (
          <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Draft restored
          </span>
        )}
        {showAiUsage && usage && <AiUsagePill usage={usage} className="ml-auto sm:ml-0" />}
      </div>
    </header>
  );
}
