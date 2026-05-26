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
      {/* Desktop sidebar — narrow icon+label nav like Zerodha Coin */}
      <aside className="relative z-10 hidden w-[88px] shrink-0 flex-col border-r border-border bg-card md:flex">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex h-[60px] items-center justify-center border-b border-border transition-opacity hover:opacity-80"
          aria-label="CodeMentor home"
        >
          <span className="aura-gradient flex size-9 items-center justify-center rounded-xl shadow-sm">
            <Code2 className="size-4 text-white" strokeWidth={2.25} />
          </span>
        </Link>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-1 px-2 py-3" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition-all",
                  active
                    ? "border border-primary/25 bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("size-5 shrink-0", active ? "text-primary" : "")}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-border px-2 py-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            aria-label="Log out"
          >
            <LogOut className="size-5" strokeWidth={1.75} />
            <span className="text-[10px] font-medium leading-tight">Log out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="aura-gradient flex size-8 items-center justify-center rounded-lg shadow-sm">
              <Code2 className="size-4 text-white" strokeWidth={2.25} />
            </span>
            <span className="font-semibold tracking-tight text-primary">CodeMentor</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Log out"
          >
            <LogOut className="size-4" />
          </button>
        </header>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card md:hidden" aria-label="Mobile navigation">
          {NAV_ITEMS.slice(0, 4).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">{children}</div>
      </div>
    </div>
  );
}
