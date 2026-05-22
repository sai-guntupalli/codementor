import Link from "next/link";
import { cn } from "@/lib/utils";

const MAX_WIDTH = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
} as const;

type MaxWidth = keyof typeof MAX_WIDTH;

export function PageContent({
  children,
  width = "md",
  className,
}: {
  children: React.ReactNode;
  width?: MaxWidth;
  className?: string;
}) {
  return (
    <div className="workspace-canvas min-h-full">
      <div
        className={cn(
          "mx-auto space-y-4 p-3 md:space-y-4 md:p-4",
          MAX_WIDTH[width],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Compact title bar — matches Problems library header. */
export function PageHeader({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel-card bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5 md:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children ? <div className="p-3 md:p-4">{children}</div> : null}
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel-card overflow-hidden bg-card">
      <div className="relative bg-gradient-to-br from-primary/15 via-card to-card px-5 py-6 md:px-8 md:py-7">
        {icon && (
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            {icon}
          </div>
        )}
        {eyebrow && (
          <p className="text-sm font-medium text-primary">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageSection({
  title,
  description,
  action,
  icon,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode | { href: string; label: string };
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel-card flex flex-col bg-card", className)}>
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action &&
          (typeof action === "object" && action !== null && "href" in action ? (
            <Link
              href={action.href}
              className="text-xs font-medium text-primary transition-colors hover:underline"
            >
              {action.label}
            </Link>
          ) : (
            action
          ))}
      </div>
      {children}
    </section>
  );
}

export function PageStatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
  );
}

export function PageStat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel-card flex flex-col justify-center bg-card px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/80">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-bold tabular-nums tracking-tight">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <PageContent>
      <div className="panel-card h-32 animate-pulse bg-card/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel-card h-16 animate-pulse bg-card/60" />
        ))}
      </div>
      <div className="panel-card space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    </PageContent>
  );
}
