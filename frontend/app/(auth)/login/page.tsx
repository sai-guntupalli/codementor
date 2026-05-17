"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, type UserOut } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      setError("Sign-in succeeded but no session was returned.");
      return;
    }

    try {
      const profile = await apiFetch<UserOut>("/users/me", {
        token: session.access_token,
      });
      setLoading(false);
      router.push(profile.is_profile_complete ? "/dashboard" : "/profile/setup");
      router.refresh();
    } catch {
      setLoading(false);
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border border-border/80 bg-card p-8 shadow-card">
      <div className="flex flex-col items-center gap-2">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Code2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your CodeMentor account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
