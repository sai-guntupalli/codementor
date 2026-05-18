"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Code2,
  LayoutDashboard,
  ListChecks,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: ListChecks },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border/80 bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border/80 px-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="size-3.5" strokeWidth={2.25} />
          </span>
          <span className="font-semibold tracking-tight text-sidebar-foreground">CodeMentor</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
