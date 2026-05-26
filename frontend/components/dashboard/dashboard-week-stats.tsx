import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { WeekStatsOut } from "@/lib/api";
import { cn } from "@/lib/utils";

function Delta({
  current,
  previous,
  label,
}: {
  current: number;
  previous: number;
  label: string;
}) {
  const diff = current - previous;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const tone =
    diff > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : diff < 0
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <Icon className={cn("size-3", tone)} />
      <span className={tone}>
        {diff > 0 ? "+" : ""}
        {diff} vs last week
      </span>
      <span className="text-muted-foreground">· {label}</span>
    </div>
  );
}

export function DashboardWeekStats({ stats }: { stats: WeekStatsOut }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="panel-card px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Solved this week
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{stats.solved_this_week}</p>
        <div className="mt-2">
          <Delta
            current={stats.solved_this_week}
            previous={stats.solved_last_week}
            label="problems"
          />
        </div>
      </div>
      <div className="panel-card px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Submissions this week
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{stats.submissions_this_week}</p>
        <div className="mt-2">
          <Delta
            current={stats.submissions_this_week}
            previous={stats.submissions_last_week}
            label="attempts"
          />
        </div>
      </div>
    </div>
  );
}
