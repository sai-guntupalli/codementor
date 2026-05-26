import Link from "next/link";
import { ArrowLeft, Code2, Home, ListChecks, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotFoundVariant = "page" | "problem" | "path";

const COPY: Record<
  NotFoundVariant,
  { title: string; description: string; primaryHref: string; primaryLabel: string }
> = {
  page: {
    title: "This page doesn't exist",
    description:
      "The link may be outdated, or the page was moved. Head back to your workspace and pick up where you left off.",
    primaryHref: "/dashboard",
    primaryLabel: "Go to dashboard",
  },
  problem: {
    title: "Problem not found",
    description:
      "This practice problem isn't available anymore. It may have been removed or the link is incorrect.",
    primaryHref: "/problems",
    primaryLabel: "Browse problems",
  },
  path: {
    title: "Learning path not found",
    description:
      "We couldn't find this path. It may have been deleted or you don't have access to it.",
    primaryHref: "/learn",
    primaryLabel: "Browse paths",
  },
};

type NotFoundViewProps = {
  variant?: NotFoundVariant;
  className?: string;
};

export function NotFoundView({ variant = "page", className }: NotFoundViewProps) {
  const copy = COPY[variant];
  const secondaryHref = variant === "page" ? "/problems" : "/dashboard";
  const secondaryLabel = variant === "page" ? "Browse problems" : "Dashboard";

  return (
    <div
      className={cn(
        "flex min-h-[min(100vh,720px)] flex-1 items-center justify-center p-6 md:p-10",
        className
      )}
    >
      <div className="sub-card w-full max-w-lg p-8 text-center shadow-card md:p-10">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <SearchX className="size-7 text-primary" strokeWidth={1.75} />
        </div>

        <p className="text-6xl font-bold tracking-tight text-primary/20">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {copy.description}
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href={copy.primaryHref}
            className={cn(buttonVariants(), "gap-1.5 shadow-sm")}
          >
            {variant === "page" ? (
              <Home className="size-4" />
            ) : (
              <ListChecks className="size-4" />
            )}
            {copy.primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <Code2 className="size-4" />
            {secondaryLabel}
          </Link>
        </div>

        <Link
          href={variant === "problem" ? "/learn" : copy.primaryHref}
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5" />
          {variant === "problem" ? "Learning paths" : "Back"}
        </Link>
      </div>
    </div>
  );
}
