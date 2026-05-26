import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { SuggestedPathOut } from "@/lib/api";
import { cn } from "@/lib/utils";

type DashboardSuggestedPathProps = {
  suggested: SuggestedPathOut;
  onSelect?: () => void;
};

export function DashboardSuggestedPath({ suggested, onSelect }: DashboardSuggestedPathProps) {
  return (
    <section className="panel-card border-dashed border-primary/25 bg-primary/5 p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Compass className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Suggested for you</p>
            <p className="mt-0.5 text-sm font-medium text-foreground/90">{suggested.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {suggested.reason}
            </p>
          </div>
        </div>
        <Link
          href={`/learn/${suggested.path_id}`}
          onClick={onSelect}
          className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
        >
          Start path
        </Link>
      </div>
    </section>
  );
}
