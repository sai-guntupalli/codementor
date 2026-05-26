import Link from "next/link";
import { CalendarCheck, CheckCircle2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DailyChallengeOut, DailyGoalOut } from "@/lib/api";
import { cn } from "@/lib/utils";

type DashboardDailySectionProps = {
  dailyGoal: DailyGoalOut;
  dailyChallenge: DailyChallengeOut | null;
  onPracticeClick?: () => void;
};

function challengeHref(challenge: DailyChallengeOut) {
  const base = `/practice/${challenge.problem_id}`;
  if (challenge.path_id) {
    return `${base}?path=${encodeURIComponent(challenge.path_id)}`;
  }
  return base;
}

export function DashboardDailySection({
  dailyGoal,
  dailyChallenge,
  onPracticeClick,
}: DashboardDailySectionProps) {
  return (
    <section className="panel-card overflow-hidden">
      <div className="border-b border-border/50 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Today&apos;s goal</h2>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              dailyGoal.met ? "bg-emerald-500/15" : "bg-primary/10"
            )}
          >
            {dailyGoal.met ? (
              <CheckCircle2 className="size-5 text-emerald-500" />
            ) : (
              <span className="text-sm font-bold tabular-nums text-primary">
                {dailyGoal.solved_today}/{dailyGoal.target}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {dailyGoal.met
              ? "Goal met — nice work. Keep your streak alive tomorrow."
              : `Solve ${dailyGoal.target} problem${dailyGoal.target > 1 ? "s" : ""} today to hit your daily goal.`}
          </p>
        </div>
      </div>

      {dailyChallenge && (
        <div className="px-4 py-3 md:px-5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarCheck className="size-3.5" />
            Daily challenge
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{dailyChallenge.problem_title}</p>
              <div className="mt-1 flex gap-1.5">
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {dailyChallenge.difficulty}
                </Badge>
                {dailyChallenge.completed_today && (
                  <Badge className="bg-emerald-500/15 text-[10px] text-emerald-600">
                    Done today
                  </Badge>
                )}
              </div>
            </div>
            {!dailyChallenge.completed_today && (
              <Link
                href={challengeHref(dailyChallenge)}
                onClick={onPracticeClick}
                className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
              >
                Start challenge
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
