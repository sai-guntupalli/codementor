"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Sparkles, Star, Zap } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UserOut } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const user = await apiFetch<UserOut>("/users/me", { token });
        if (!user.is_profile_complete) {
          router.replace("/profile/setup");
          return;
        }
        setProfile(user);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
          <div className="h-3.5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded-xl bg-muted" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-full bg-muted" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-border/50 bg-muted/40" />
            ))}
          </div>
          <div className="mt-6 h-36 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="h-32 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
            <div className="h-32 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
          </div>
        </div>
      </main>
    );
  }

  const skillEntries = Object.entries(
    (profile?.skill_level as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a);

  return (
    <main className="min-h-screen bg-background">
      <AppHeader
        actions={
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 size-4" />
            Log out
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <p className="text-sm font-medium text-primary">Welcome back</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {profile?.display_name ? `Hi, ${profile.display_name}` : "Your coding journey"}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          Practice problems, get instant AI feedback, and level up with hints tailored to your
          profile.
        </p>

        {/* Stats row */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Zap className="size-4 text-primary" />}
            label="Total XP"
            value={profile?.xp_total?.toLocaleString() ?? "0"}
          />
          <StatCard
            icon={<Star className="size-4 text-amber-500" />}
            label="Streak"
            value={`${profile?.streak_days ?? 0} days`}
          />
          <StatCard
            icon={<Sparkles className="size-4 text-violet-500" />}
            label="Skills"
            value={`${skillEntries.length} tracked`}
          />
        </div>

        {/* Skill breakdown */}
        {skillEntries.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Skill progress</h2>
            <ul className="space-y-2.5">
              {skillEntries.slice(0, 6).map(([topic, level]) => (
                <li key={topic} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs font-medium capitalize text-foreground/80">
                    {topic.replace(/_/g, " ")}
                  </span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round(level * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(level * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/problems"
            className="group rounded-2xl border border-border/80 bg-card p-6 shadow-card transition-all hover:border-primary/30 hover:shadow-lg"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold">Browse problems</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Curated Python and SQL challenges with AI review.
            </p>
          </Link>
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Sparkles className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold text-muted-foreground">More coming soon</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Personalized learning paths and recommendations.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
