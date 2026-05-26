import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WeakTopicOut } from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";

export function DashboardWeakTopics({ topics }: { topics: WeakTopicOut[] }) {
  if (topics.length === 0) return null;

  return (
    <section className="panel-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 md:px-5">
        <AlertCircle className="size-4 text-amber-500" />
        <h2 className="text-sm font-semibold">Practice these topics</h2>
      </div>
      <ul className="divide-y divide-border/50 p-2 md:p-3">
        {topics.map((topic) => (
          <li key={topic.topic} className="rounded-xl px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{topic.topic}</p>
              <span className="text-xs tabular-nums text-muted-foreground">
                skill {Math.round(topic.skill * 100)}%
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {topic.problems.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/practice/${p.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <Badge
                      variant={difficultyBadgeVariant(p.difficulty)}
                      className="shrink-0 text-[10px] capitalize"
                    >
                      {p.difficulty}
                    </Badge>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40" />
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
