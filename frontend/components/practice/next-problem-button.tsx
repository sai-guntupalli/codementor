import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NextProblem = { id: string; title: string };

type NextProblemButtonProps = {
  next: NextProblem | null | undefined;
  /** When set, next links preserve learning-path context */
  pathId?: string | null;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  /** Button text when not using showTitle (e.g. "Skip") */
  label?: string;
  /** Show truncated next problem title instead of generic label */
  showTitle?: boolean;
  className?: string;
  fullWidth?: boolean;
  title?: string;
};

export function NextProblemButton({
  next,
  pathId,
  variant = "default",
  size = "sm",
  label,
  showTitle = false,
  className,
  fullWidth = false,
  title,
}: NextProblemButtonProps) {
  if (!next) return null;

  const prefix = label ?? "Next";
  const compactLabel = label ?? "Next problem";
  const href = pathId
    ? `/practice/${next.id}?path=${encodeURIComponent(pathId)}`
    : `/practice/${next.id}`;

  return (
    <Link
      href={href}
      title={title}
      className={cn(
        buttonVariants({ variant, size }),
        "gap-1.5 shadow-sm",
        fullWidth && "block w-full",
        className
      )}
    >
      {showTitle ? (
        <>
          <span className="max-w-[min(200px,50vw)] truncate">
            {prefix}: {next.title}
          </span>
          <ArrowRight className="size-3.5 shrink-0" />
        </>
      ) : (
        <>
          {compactLabel}
          <ArrowRight className="size-3.5" />
        </>
      )}
    </Link>
  );
}
