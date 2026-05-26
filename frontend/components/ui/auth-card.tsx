import Link from "next/link";
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass-panel space-y-6 rounded-2xl p-8 shadow-2xl", className)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="aura-gradient flex size-11 items-center justify-center rounded-xl shadow-lg">
          <Code2 className="size-5 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
      {footer}
    </div>
  );
}

export function AuthFooterLink({
  prompt,
  href,
  linkLabel,
}: {
  prompt: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{" "}
      <Link href={href} className="font-medium text-secondary hover:underline">
        {linkLabel}
      </Link>
    </p>
  );
}
