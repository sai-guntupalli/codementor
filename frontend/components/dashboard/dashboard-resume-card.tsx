"use client";

import Link from "next/link";
import { Clock, FileCode2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { LastSessionOut } from "@/lib/api";
import { cn } from "@/lib/utils";

type DashboardResumeCardProps = {
  session: LastSessionOut;
  hasLocalDraft?: boolean;
  onResume?: () => void;
};

function sessionHref(session: LastSessionOut) {
  const base = `/practice/${session.problem_id}`;
  if (session.path_id) {
    return `${base}?path=${encodeURIComponent(session.path_id)}`;
  }
  return base;
}

export function DashboardResumeCard({
  session,
  hasLocalDraft = false,
  onResume,
}: DashboardResumeCardProps) {
  const when = new Date(session.updated_at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="panel-card border-primary/20 bg-primary/5 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <FileCode2 className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
            Resume where you left off
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{session.problem_title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {when}
            {hasLocalDraft && (
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                Draft saved
              </span>
            )}
          </p>
        </div>
      </div>
      <Link
        href={sessionHref(session)}
        onClick={onResume}
        className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full sm:w-auto")}
      >
        Continue editing
      </Link>
    </section>
  );
}
