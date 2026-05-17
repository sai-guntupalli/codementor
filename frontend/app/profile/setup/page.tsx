"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch } from "@/lib/api";

const PROFILE_LEVELS = [
  { value: "kid", label: "Kid", description: "Ages 8–14, learning the basics" },
  { value: "student", label: "Student", description: "High school or university" },
  { value: "engineer", label: "Engineer", description: "Working professional" },
] as const;

type ProfileLevel = (typeof PROFILE_LEVELS)[number]["value"];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [profileLevel, setProfileLevel] = useState<ProfileLevel>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const token = await getValidatedAccessToken(supabase);

    if (!token) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      router.push("/login");
      return;
    }

    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          display_name: displayName,
          profile_level: profileLevel,
        }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <UserCircle className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Set up your profile</h1>
          <p className="text-sm text-muted-foreground text-center">
            Tell us a bit about yourself so we can tailor your experience
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="displayName" className="text-sm font-medium">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              required
              minLength={2}
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sai"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">I am a…</p>
            <div className="grid gap-2">
              {PROFILE_LEVELS.map((level) => (
                <label
                  key={level.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    profileLevel === level.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="profileLevel"
                    value={level.value}
                    checked={profileLevel === level.value}
                    onChange={() => setProfileLevel(level.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{level.label}</p>
                    <p className="text-xs text-muted-foreground">{level.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving…" : "Start learning"}
          </Button>
        </form>
      </div>
    </div>
  );
}
