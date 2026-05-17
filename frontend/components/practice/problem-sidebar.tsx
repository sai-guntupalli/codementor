"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

type ProblemItem = {
  id: string;
  title: string;
  language: string;
  difficulty: string;
};

type ProblemSidebarProps = {
  problems: ProblemItem[];
  currentId: string;
  collapsed: boolean;
  onToggle: () => void;
};

export function ProblemSidebar({
  problems,
  currentId,
  collapsed,
  onToggle,
}: ProblemSidebarProps) {
  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center border-r border-border/80 bg-sidebar py-3">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          title="Expand problems"
        >
          <ChevronRight className="size-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border/80 bg-sidebar">
      <div className="flex items-center justify-between border-b border-border/80 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ListTodo className="size-3.5" />
          Problems
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          title="Collapse"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/practice/${p.id}`}
                className={cn(
                  "block rounded-lg px-2.5 py-2 text-sm transition-all",
                  p.id === currentId
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <span className="line-clamp-2 font-medium leading-snug">{p.title}</span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    p.id === currentId
                      ? "text-primary-foreground/75"
                      : "text-muted-foreground"
                  )}
                >
                  {p.language} · {p.difficulty}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/problems"
          className="mt-3 block rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          Browse all problems →
        </Link>
      </nav>
    </aside>
  );
}
