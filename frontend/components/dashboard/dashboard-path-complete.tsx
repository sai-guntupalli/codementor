import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PathCompletionOut } from "@/lib/api";
import { cn } from "@/lib/utils";

export function DashboardPathComplete({
  completion,
}: {
  completion: PathCompletionOut;
}) {
  if (!completion.show_celebration) return null;

  return (
    <section className="panel-card overflow-hidden border-emerald-500/30 bg-emerald-500/5">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <PartyPopper className="size-5 text-emerald-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Path complete!
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              You finished all {completion.total_count} problems in{" "}
              <span className="font-medium text-foreground">{completion.path_title}</span>.
            </p>
          </div>
        </div>
        <Link
          href="/learn"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          Pick another path
        </Link>
      </div>
    </section>
  );
}
