import Link from "next/link";
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

type AppHeaderProps = {
  crumbs?: Crumb[];
  title?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function AppHeader({ crumbs, title, meta, actions, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 py-3 shadow-header backdrop-blur-sm",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-0.5 text-foreground transition-opacity hover:opacity-80"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Code2 className="size-4" strokeWidth={2.25} />
          </span>
          <span className="hidden font-semibold tracking-tight sm:inline">CodeMentor</span>
        </Link>

        {(crumbs?.length || title) && (
          <div className="hidden min-w-0 items-center gap-2 border-l border-border pl-3 sm:flex">
            {crumbs?.map((c, i) => (
              <span key={i} className="flex items-center gap-2 text-sm">
                {i > 0 && <span className="text-muted-foreground/60">/</span>}
                {c.href ? (
                  <Link
                    href={c.href}
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="truncate text-muted-foreground">{c.label}</span>
                )}
              </span>
            ))}
            {title && (
              <>
                {crumbs?.length ? (
                  <span className="text-muted-foreground/60">/</span>
                ) : null}
                <span className="truncate font-medium text-foreground">{title}</span>
              </>
            )}
            {meta}
          </div>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
