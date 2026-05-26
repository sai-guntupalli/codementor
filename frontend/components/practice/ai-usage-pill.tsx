"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { UsageOut } from "@/lib/api";
import { cn } from "@/lib/utils";

type AiUsagePillProps = {
  usage: UsageOut;
  className?: string;
};

export function AiUsagePill({ usage, className }: AiUsagePillProps) {
  const atLimit = usage.calls_used >= usage.calls_limit;
  const remaining = Math.max(0, usage.calls_limit - usage.calls_used);
  const pct =
    usage.calls_limit > 0
      ? Math.min(100, Math.round((usage.calls_used / usage.calls_limit) * 100))
      : 0;
  const approaching = !atLimit && pct >= 80;

  const label = atLimit
    ? "AI limit reached"
    : approaching
      ? `${remaining} AI calls left`
      : `${usage.calls_used}/${usage.calls_limit} AI`;

  return (
    <Link
      href="/settings"
      title={`${usage.calls_used} of ${usage.calls_limit} AI calls used this month. Open settings.`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors",
        atLimit
          ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
          : approaching
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
            : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
        className
      )}
    >
      <Sparkles className="size-3 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
