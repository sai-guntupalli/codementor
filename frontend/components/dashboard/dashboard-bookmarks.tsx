import Link from "next/link";
import { Bookmark, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BookmarkSummaryOut } from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";

export function DashboardBookmarks({ bookmarks }: { bookmarks: BookmarkSummaryOut[] }) {
  if (bookmarks.length === 0) return null;

  return (
    <section className="panel-card">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <Bookmark className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Saved problems</h2>
        </div>
        <Link href="/problems" className="text-xs font-medium text-primary hover:underline">
          Library →
        </Link>
      </div>
      <ul className="divide-y divide-border/50 p-2 md:p-3">
        {bookmarks.map((b) => (
          <li key={b.problem_id}>
            <Link
              href={`/practice/${b.problem_id}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.title}</span>
              <Badge
                variant={difficultyBadgeVariant(b.difficulty)}
                className="shrink-0 text-[10px] capitalize"
              >
                {b.difficulty}
              </Badge>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
