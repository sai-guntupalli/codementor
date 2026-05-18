"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UserOut } from "@/lib/api";

const PROFILE_LEVELS = [
  { value: "kid", label: "Kid (ages 8–12)" },
  { value: "student", label: "Student (learning the basics)" },
  { value: "engineer", label: "Engineer (working professionally)" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState<UserOut | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [profileLevel, setProfileLevel] = useState("student");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const t = await getValidatedAccessToken(supabase);
      if (!t) {
        router.replace("/login");
        return;
      }
      setToken(t);
      try {
        const user = await apiFetch<UserOut>("/users/me", { token: t });
        setProfile(user);
        setDisplayName(user.display_name ?? "");
        setProfileLevel(user.profile_level ?? "student");
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const updated = await apiFetch<UserOut>("/users/me", {
        method: "PATCH",
        token,
        body: JSON.stringify({ display_name: displayName, profile_level: profileLevel }),
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and preferences.
        </p>

        {/* Profile */}
        <section className="mt-8 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
          <h2 className="font-semibold">Profile</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your public display name and experience level.
          </p>
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label
                className="mb-1.5 block text-xs font-medium text-foreground/80"
                htmlFor="display-name"
              >
                Display name
              </label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={60}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium text-foreground/80"
                htmlFor="profile-level"
              >
                Experience level
              </label>
              <div className="flex flex-wrap gap-2">
                {PROFILE_LEVELS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProfileLevel(value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      profileLevel === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-border/60 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {saved && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Saved
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Account info (read-only) */}
        <section className="mt-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
          <h2 className="font-semibold">Account</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Your account details.</p>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="mt-0.5 text-sm font-medium">{profile?.email}</p>
          </div>
        </section>

        {/* Appearance */}
        <section className="mt-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
          <h2 className="font-semibold">Appearance</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Choose your preferred theme.</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                theme === "light"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="size-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                theme === "dark"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="size-3.5" />
              Dark
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
