"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Mail,
  Moon,
  Settings,
  Sparkles,
  Sun,
  User,
  Wallet,
} from "lucide-react";
import { PlanSelectSection } from "@/components/settings/plan-select-section";
import { UsageMeter } from "@/components/usage/usage-meter";
import { AppShell } from "@/components/layout/app-shell";
import {
  PageContent,
  PageHeader,
  PageSection,
  PageSkeleton,
  PageStat,
  PageStatGrid,
} from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UsageOut, type UserOut } from "@/lib/api";
import { cn } from "@/lib/utils";

const PROFILE_LEVELS = [
  { value: "kid", label: "Kid (ages 8–12)" },
  { value: "student", label: "Student" },
  { value: "engineer", label: "Engineer" },
];

function formatResetsAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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
  const [usage, setUsage] = useState<UsageOut | null>(null);

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
        const [user, usageData] = await Promise.all([
          apiFetch<UserOut>("/users/me", { token: t }),
          apiFetch<UsageOut>("/users/me/usage", { token: t }),
        ]);
        setProfile(user);
        setUsage(usageData);
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
        <PageSkeleton rows={4} />
      </AppShell>
    );
  }

  const usagePct =
    usage && usage.calls_limit > 0
      ? Math.round((usage.calls_used / usage.calls_limit) * 100)
      : 0;
  const atLimit = usage ? usage.calls_used >= usage.calls_limit : false;

  return (
    <AppShell>
      <PageContent width="xl" className="space-y-4">
        <PageHeader
          icon={<Settings className="size-4" />}
          title="Settings"
          subtitle="Profile, AI usage, and appearance"
        />

        {usage && (
          <PageStatGrid>
            <PageStat
              icon={<Sparkles className="size-4 text-primary" />}
              label="AI calls"
              value={`${usage.calls_used} / ${usage.calls_limit}`}
              hint="used this month"
            />
            <PageStat
              icon={<Wallet className="size-4 text-violet-500" />}
              label="Est. cost"
              value={`$${usage.cost_usd_month.toFixed(2)}`}
              hint="this billing period"
            />
            <PageStat
              icon={<Settings className="size-4 text-muted-foreground" />}
              label="Quota used"
              value={`${usagePct}%`}
              hint={atLimit ? "limit reached" : usagePct >= 80 ? "approaching limit" : undefined}
            />
            <PageStat
              icon={<Sun className="size-4 text-amber-500" />}
              label="Resets"
              value={formatResetsAt(usage.resets_at)}
              hint="monthly quota"
            />
          </PageStatGrid>
        )}

        <div className="space-y-4">
          {token && (
            <PlanSelectSection
              token={token}
              onPlanChanged={() => {
                if (token) {
                  void apiFetch<UsageOut>("/users/me/usage", { token })
                    .then(setUsage)
                    .catch(() => {});
                }
              }}
            />
          )}

          <PageSection
            title="Profile"
            description="Display name and experience level for AI tutoring."
            icon={<User className="size-4 text-primary" />}
          >
            <form onSubmit={handleSave} className="space-y-5 p-4 md:p-5">
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
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
                  className="mb-2 block text-xs font-medium text-muted-foreground"
                  htmlFor="profile-level"
                >
                  Experience level
                </label>
                <div className="flex flex-wrap gap-2" id="profile-level">
                  {PROFILE_LEVELS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProfileLevel(value)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        profileLevel === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Shapes hint depth, review tone, and explanations from the AI assistant.
                </p>
              </div>
              <div className="flex items-center gap-3 border-t border-border/50 pt-4">
                <Button type="submit" size="sm" className="shadow-sm" disabled={saving}>
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

          {usage && (
            <PageSection
              title="AI usage"
              description="Monthly quota for reviews, hints, and chat."
              icon={<Sparkles className="size-4 text-primary" />}
            >
              <div className="p-4 md:p-5">
                <UsageMeter usage={usage} />
              </div>
            </PageSection>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <PageSection
              title="Account"
              description="Sign-in email for this workspace."
              icon={<Mail className="size-4 text-primary" />}
            >
              <div className="p-4 md:p-5">
                <div className="sub-card px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Email
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">{profile?.email}</p>
                </div>
              </div>
            </PageSection>

            <PageSection
              title="Appearance"
              description="Light or dark interface theme."
              icon={<Sun className="size-4 text-primary" />}
            >
              <div className="flex flex-wrap gap-2 p-4 md:p-5">
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
          </div>
        </div>
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
        "flex flex-1 min-w-[7rem] items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
