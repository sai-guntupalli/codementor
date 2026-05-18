"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type CurriculumPathOut } from "@/lib/api";

export default function LearnPage() {
  const router = useRouter();
  const [paths, setPaths] = useState<CurriculumPathOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const data = await apiFetch<CurriculumPathOut[]>("/curriculum-paths", { token });
        setPaths(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load curriculum");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="h-8 w-40 animate-pulse rounded-xl bg-muted" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Learning Paths</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured curricula to guide your progress from beginner to advanced.
        </p>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        {!error && paths.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 font-medium">Curriculum paths coming soon</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;re building structured Python and SQL tracks. Check back soon.
            </p>
          </div>
        )}

        {paths.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {paths.map((path, idx) => (
              <PathCard key={path.id} path={path} locked={idx > 0} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PathCard({
  path,
  locked,
}: {
  path: CurriculumPathOut;
  locked: boolean;
}) {
  const langColors: Record<string, string> = {
    python: "text-blue-500",
    sql: "text-emerald-500",
  };
  const color = langColors[path.language] ?? "text-primary";

  return (
    <div
      className={`relative rounded-2xl border border-border/80 bg-card p-6 shadow-card transition-all ${
        locked ? "opacity-60" : "hover:border-primary/30 hover:shadow-md"
      }`}
    >
      {locked && (
        <span className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full bg-muted">
          <Lock className="size-3.5 text-muted-foreground" />
        </span>
      )}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={`capitalize ${color}`}>
          {path.language}
        </Badge>
        {path.target_level && (
          <Badge variant="outline" className="capitalize text-xs">
            {path.target_level}
          </Badge>
        )}
      </div>
      <h3 className="mt-3 font-semibold">{path.title}</h3>
      {path.description && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {path.description}
        </p>
      )}
    </div>
  );
}
