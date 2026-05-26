"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Settings, Sun, User } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContent, PageHero, PageSection, PageSkeleton } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UserOut } from "@/lib/api";
import { cn } from "@/lib/utils";

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
        <PageSkeleton rows={2} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContent width="sm">
        <PageHero
          eyebrow="Preferences"
          icon={<Settings className="size-5" />}
          title="Settings"
          description="Manage your profile and preferences."
        />

        <PageSection
          title="Profile"
          description="Your public display name and experience level."
          icon={<User className="size-4 text-primary" />}
        >
          <form onSubmit={handleSave} className="space-y-4 p-4 md:p-5">
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
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      profileLevel === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {saved && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Saved
                </span>
              )}
            </div>
          </form>
        </PageSection>

        <PageSection title="Account" description="Your account details.">
          <div className="p-4 md:p-5">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="mt-0.5 text-sm font-medium">{profile?.email}</p>
          </div>
        </PageSection>

        <PageSection title="Appearance" description="Choose your preferred theme.">
          <div className="flex gap-2 p-4 md:p-5">
            <ThemeButton
              active={theme === "light"}
              onClick={() => setTheme("light")}
              icon={<Sun className="size-3.5" />}
              label="Light"
            />
            <ThemeButton
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
              icon={<Moon className="size-3.5" />}
              label="Dark"
            />
          </div>
        </PageSection>
      </PageContent>
    </AppShell>
  );
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
