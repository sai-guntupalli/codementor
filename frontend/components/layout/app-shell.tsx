"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Code2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
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
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <div className="living-glow pointer-events-none absolute top-[-15%] left-[-8%] z-0 h-[45%] w-[45%]" aria-hidden />
      <div className="living-glow pointer-events-none absolute right-[-8%] bottom-[-15%] z-0 h-[45%] w-[45%]" aria-hidden />

      <aside className="relative z-10 hidden w-56 shrink-0 flex-col border-r border-white/10 glass-panel md:flex">
        <Link
          href="/dashboard"
          className="flex h-16 items-center gap-2.5 border-b border-white/10 px-4 transition-colors hover:bg-white/5"
        >
          <span className="aura-gradient flex size-8 items-center justify-center rounded-lg shadow-md">
            <Code2 className="size-4 text-primary-foreground" strokeWidth={2.25} />
          </span>
          <span className="font-semibold tracking-tight text-primary">CodeMentor</span>
        </Link>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "border border-primary/30 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-secondary")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <LogOut className="mr-2 size-4" />
            Log out
          </Button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-background/60 px-4 backdrop-blur-xl md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="aura-gradient flex size-7 items-center justify-center rounded-lg">
              <Code2 className="size-3.5 text-primary-foreground" strokeWidth={2.25} />
            </span>
            <span className="font-semibold text-primary">CodeMentor</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
