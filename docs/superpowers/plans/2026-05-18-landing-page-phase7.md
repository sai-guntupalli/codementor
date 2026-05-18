# Landing Page + Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a SaaS-grade public landing page and all Phase 7 authenticated screens (Dashboard enhancement, Learn, Progress, Settings) plus a shared sidebar navigation shell.

**Architecture:** A shared `AppShell` component provides a collapsible left sidebar used by authenticated screens (dashboard, problems, learn, progress, settings). The practice IDE remains full-screen and unaffected. A new `GET /submissions/me` backend endpoint powers the Progress screen's submission history. Theme switching uses `next-themes` with the existing CSS variables (both `:root` and `.dark` are already defined). The landing page auto-redirects logged-in users to `/dashboard`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn (Button/Badge + new Input), lucide-react, next-themes, FastAPI + SQLAlchemy

---

## File Map

### New files
- `frontend/app/learn/page.tsx` — Learn screen (SCR-02): curriculum paths list with progress
- `frontend/app/progress/page.tsx` — Progress screen (SCR-03): stats, skill breakdown, submission history
- `frontend/app/settings/page.tsx` — Settings screen (SCR-04): profile form + theme toggle
- `frontend/components/layout/app-shell.tsx` — Shared sidebar nav for authenticated screens
- `frontend/components/ui/input.tsx` — shadcn Input component for settings form

### Modified files
- `frontend/app/page.tsx` — Complete rewrite as public landing page
- `frontend/app/layout.tsx` — Add ThemeProvider from next-themes
- `frontend/app/dashboard/page.tsx` — Wrap with AppShell, add recent activity + recommended problems, remove placeholder card
- `frontend/app/problems/page.tsx` — Wrap with AppShell for nav consistency
- `frontend/lib/api.ts` — Add `SubmissionHistoryItem`, `CurriculumPathOut`, `CurriculumPathDetailOut` types
- `backend/api/submissions.py` — Add `GET /submissions/me` endpoint
- `backend/schemas/submission.py` — Add `SubmissionHistoryItem` schema
- `backend/tests/test_submissions.py` — Tests for `GET /submissions/me`
- `PROGRESS.md` — Update status after completion

---

## Task 1: Backend — `GET /submissions/me` endpoint

**Files:**
- Modify: `backend/schemas/submission.py`
- Modify: `backend/api/submissions.py`
- Modify: `backend/tests/test_submissions.py`

- [ ] **Step 1: Add `SubmissionHistoryItem` to submission schemas**

In `backend/schemas/submission.py`, append after the existing `SubmissionOut` class:

```python
class SubmissionHistoryItem(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    problem_title: str
    language: str
    score: float | None
    hints_used: int
    solution_viewed: bool
    created_at: datetime
```

The full file after the change:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class SubmissionCreate(BaseModel):
    problem_id: uuid.UUID
    code: str
    language: str


class SubmissionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    problem_id: uuid.UUID
    code: str
    language: str
    llm_review: str | None
    improved_code: str | None
    hints_used: int
    solution_viewed: bool
    score: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmissionHistoryItem(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    problem_title: str
    language: str
    score: float | None
    hints_used: int
    solution_viewed: bool
    created_at: datetime
```

- [ ] **Step 2: Write the failing tests**

Add to `backend/tests/test_submissions.py`:

```python
def test_list_my_submissions_empty(auth_client: TestClient):
    """GET /submissions/me returns empty list for user with no submissions."""
    res = auth_client.get("/submissions/me")
    assert res.status_code == 200
    assert res.json() == []


def test_list_my_submissions_requires_auth(client: TestClient):
    """GET /submissions/me without token returns 401."""
    res = client.get("/submissions/me")
    assert res.status_code == 401
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/sai/WS/help_me_code/backend
source .venv/bin/activate
pytest tests/test_submissions.py::test_list_my_submissions_empty tests/test_submissions.py::test_list_my_submissions_requires_auth -v
```

Expected: FAIL with `404 Not Found` (route doesn't exist yet).

- [ ] **Step 4: Implement the endpoint**

In `backend/api/submissions.py`, add the following import at the top (if not already present):
```python
from fastapi import Query
```

Add the new route **before** the existing `POST ""` route (so `/me` is matched before `/{submission_id}`):

```python
from schemas.submission import SubmissionCreate, SubmissionHistoryItem, SubmissionOut

@router.get("/me", response_model=list[SubmissionHistoryItem])
def list_my_submissions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
) -> list[SubmissionHistoryItem]:
    rows = (
        db.query(Submission, Problem.title)
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(Submission.user_id == current_user.id)
        .order_by(Submission.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        SubmissionHistoryItem(
            id=sub.id,
            problem_id=sub.problem_id,
            problem_title=title,
            language=sub.language,
            score=sub.score,
            hints_used=sub.hints_used,
            solution_viewed=sub.solution_viewed,
            created_at=sub.created_at,
        )
        for sub, title in rows
    ]
```

Make sure `Problem` is imported — it should already be at the top of the file from `from models.learning import Problem, Submission`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_submissions.py -v
```

Expected: all submission tests pass (existing 2 + new 2).

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/submission.py backend/api/submissions.py backend/tests/test_submissions.py
git commit -m "feat(api): add GET /submissions/me for submission history"
```

---

## Task 2: Frontend infrastructure — next-themes + Input component

**Files:**
- Modify: `frontend/app/layout.tsx`
- Create: `frontend/components/ui/input.tsx`

- [ ] **Step 1: Install next-themes**

```bash
cd /Users/sai/WS/help_me_code/frontend
npm install next-themes
```

Expected: `next-themes` added to `node_modules` and `package-lock.json`.

- [ ] **Step 2: Update `layout.tsx` to wrap with ThemeProvider**

Replace the entire contents of `frontend/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeMentor",
  description: "Adaptive coding learning platform for Python and SQL",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create the Input component**

Create `frontend/components/ui/input.tsx`:

```tsx
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
```

- [ ] **Step 4: Verify the dev server starts without errors**

```bash
cd /Users/sai/WS/help_me_code/frontend
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -5
```

Expected: HTML response starts with `<!DOCTYPE html>` (no crash).

Kill the server: `pkill -f "next dev"`

- [ ] **Step 5: Commit**

```bash
cd /Users/sai/WS/help_me_code
git add frontend/app/layout.tsx frontend/components/ui/input.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add next-themes ThemeProvider and Input component"
```

---

## Task 3: AppShell — shared sidebar navigation

**Files:**
- Create: `frontend/components/layout/app-shell.tsx`

- [ ] **Step 1: Create the AppShell component**

Create `frontend/components/layout/app-shell.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/layout/app-shell.tsx
git commit -m "feat(frontend): add AppShell sidebar navigation component"
```

---

## Task 4: Landing page

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/page.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Code2,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Code2 className="size-4" strokeWidth={2.25} />
            </span>
            <span className="font-semibold tracking-tight">CodeMentor</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center md:pb-28 md:pt-32">
        <Badge variant="secondary" className="mb-6">
          AI-powered coding practice
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
          Master Python & SQL
          <br />
          <span className="text-primary">with instant AI feedback</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Write code, get a detailed AI review, level up with progressive hints — all inside an
          interactive IDE. Your skill level adapts after every submission.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              Start for free
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No credit card required · 100 AI reviews / month free
        </p>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need to level up
            </h2>
            <p className="mt-3 text-muted-foreground">
              AI tools built for serious coding practice
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Sparkles className="size-5 text-primary" />}
              title="AI Code Review"
              description="Submit your solution and get instant feedback — what's wrong, a better version, and exactly why it's better."
            />
            <FeatureCard
              icon={<Zap className="size-5 text-amber-500" />}
              title="Progressive Hints"
              description="Three levels of hints that guide you toward the solution without giving it away. Understand the 'why', not just the 'what'."
            />
            <FeatureCard
              icon={<BarChart3 className="size-5 text-emerald-500" />}
              title="Adaptive Skill Tracking"
              description="Your skill level updates after every submission. Problems and hints adapt to your actual level, not a self-reported one."
            />
            <FeatureCard
              icon={<BookOpen className="size-5 text-violet-500" />}
              title="Teach Me Mode"
              description="Line-by-line explanation of your code or the model solution. Build deep understanding that sticks."
            />
            <FeatureCard
              icon={<MessageSquare className="size-5 text-blue-500" />}
              title="AI Chat"
              description="Ask anything about the problem, your approach, or a concept. A patient tutor available 24/7, anchored to the current problem."
            />
            <FeatureCard
              icon={<Code2 className="size-5 text-rose-500" />}
              title="Monaco Editor"
              description="The same editor as VS Code — syntax highlighting, auto-indent, and the keyboard shortcuts you already know."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
          </div>
          <div className="grid gap-10 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Pick a problem",
                desc: "Browse Python and SQL challenges filtered by topic, difficulty, and your current skill level.",
              },
              {
                step: "2",
                title: "Write your solution",
                desc: "Use the Monaco editor with full syntax highlighting. No timer, no pressure — just you and the problem.",
              },
              {
                step: "3",
                title: "Learn from AI feedback",
                desc: "Get a full review, ask for hints, see the solution with explanations, or chat with the AI about anything.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {step}
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-muted/30 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Simple pricing</h2>
            <p className="mt-3 text-muted-foreground">
              Start free. Upgrade when you&apos;re ready.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <PricingCard
              title="Free"
              price="$0"
              period="/month"
              description="Perfect for getting started"
              features={[
                "100 AI reviews per month",
                "All Python & SQL problems",
                "Progressive hints",
                "XP & streak tracking",
                "Adaptive skill levels",
              ]}
              cta="Get started free"
              href="/signup"
              featured={false}
            />
            <PricingCard
              title="Pro"
              price="$9"
              period="/month"
              description="For serious learners"
              features={[
                "Unlimited AI reviews",
                "GPT-4 & Claude models",
                "Priority support",
                "All Free features",
                "Early access to new features",
              ]}
              cta="Upgrade to Pro"
              href="/signup"
              featured={true}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <Code2 className="size-3" strokeWidth={2.25} />
            </span>
            <span className="text-sm font-medium">CodeMentor</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 CodeMentor. Built for developers who want to improve.
          </p>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-card">
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
        {icon}
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingCard({
  title,
  price,
  period,
  description,
  features,
  cta,
  href,
  featured,
}: {
  title: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  featured: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-8 ${
        featured
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border/80 bg-card"
      }`}
    >
      {featured && (
        <Badge className="mb-4" variant="default">
          Most popular
        </Badge>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-muted-foreground">{period}</span>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <Check className="size-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-8 block">
        <Button className="w-full" variant={featured ? "default" : "outline"}>
          {cta}
        </Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Start the dev server and navigate to `http://localhost:3000`. Verify:
- Public header with CodeMentor logo, Features/Pricing links, Sign in/Get started buttons
- Hero with headline and CTA buttons
- Feature cards section
- How it works steps
- Pricing cards (Free + Pro)
- Footer

- [ ] **Step 3: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(frontend): add SaaS landing page with hero, features, pricing"
```

---

## Task 5: Add types to `lib/api.ts`

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Append new types**

Add to the end of `frontend/lib/api.ts`:

```ts
export type SubmissionHistoryItem = {
  id: string;
  problem_id: string;
  problem_title: string;
  language: string;
  score: number | null;
  hints_used: number;
  solution_viewed: boolean;
  created_at: string;
};

export type CurriculumPathOut = {
  id: string;
  title: string;
  language: string;
  target_level: string | null;
  description: string | null;
  is_published: boolean;
};

export type CurriculumProblem = {
  id: string;
  title: string;
  language: string;
  difficulty: string;
  topic: string[];
};

export type CurriculumPathDetailOut = CurriculumPathOut & {
  ordered_problem_ids: string[];
  problems: CurriculumProblem[];
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(frontend): add SubmissionHistoryItem and CurriculumPath types to api.ts"
```

---

## Task 6: Dashboard enhancement (SCR-01)

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

Replace the entire file with the enhanced version that:
- Wraps in `AppShell`
- Loads recent submissions (3 most recent from `/submissions/me?limit=3`)
- Loads recommended problems (3 problems from `/problems?page_size=3`)
- Removes the "More coming soon" placeholder card
- Keeps existing XP/streak/skill stats

- [ ] **Step 1: Replace `frontend/app/dashboard/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, LogOut, Sparkles, Star, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UserOut, type SubmissionHistoryItem } from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";

type ProblemItem = {
  id: string;
  title: string;
  language: string;
  difficulty: string;
  topic: string[];
};

type ProblemList = { items: ProblemItem[]; total: number };

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [recommendedProblems, setRecommendedProblems] = useState<ProblemItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const [user, submissions, problems] = await Promise.all([
          apiFetch<UserOut>("/users/me", { token }),
          apiFetch<SubmissionHistoryItem[]>("/submissions/me?limit=3", { token }),
          apiFetch<ProblemList>("/problems?page_size=3", { token }),
        ]);
        if (!user.is_profile_complete) {
          router.replace("/profile/setup");
          return;
        }
        setProfile(user);
        setRecentSubmissions(submissions);
        setRecommendedProblems(problems.items);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="h-3.5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded-xl bg-muted" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-border/50 bg-muted/40" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  const skillEntries = Object.entries(
    (profile?.skill_level as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a);

  return (
    <AppShell>
      <div className="flex items-center justify-end border-b border-border/80 px-6 py-3">
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 size-4" />
          Log out
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm font-medium text-primary">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
          {profile?.display_name ? `Hi, ${profile.display_name}` : "Your coding journey"}
        </h1>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
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
            <h2 className="mb-3 text-sm font-semibold">Skill progress</h2>
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

        {/* Recommended problems */}
        {recommendedProblems.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Practice now</h2>
              <Link href="/problems" className="text-xs font-medium text-primary hover:underline">
                Browse all →
              </Link>
            </div>
            <ul className="space-y-2">
              {recommendedProblems.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/practice/${p.id}`}
                    className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                        {p.topic.slice(0, 2).join(", ")}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {p.language}
                      </Badge>
                      <Badge
                        variant={difficultyBadgeVariant(p.difficulty)}
                        className="capitalize text-xs"
                      >
                        {p.difficulty}
                      </Badge>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent activity */}
        {recentSubmissions.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <Link href="/progress" className="text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </div>
            <ul className="space-y-2">
              {recentSubmissions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.problem_title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {s.language}
                    </Badge>
                    {s.score !== null && (
                      <span className="text-xs font-medium tabular-nums text-primary">
                        {Math.round(s.score * 100)}%
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty state: no activity yet */}
        {recentSubmissions.length === 0 && recommendedProblems.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 font-medium">Start your first problem</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse Python and SQL challenges and get instant AI feedback.
            </p>
            <Link href="/problems" className="mt-4 inline-block">
              <Button>Browse problems</Button>
            </Link>
          </div>
        )}
      </div>
    </AppShell>
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
```

- [ ] **Step 2: Verify dashboard renders with AppShell**

Open `http://localhost:3000/dashboard`. Verify:
- Sidebar shows on the left with nav items
- Stats, skill progress bars still visible
- Recommended problems section appears (or empty state if no problems seeded)
- Recent activity shows (or is absent if no submissions)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat(frontend): enhance dashboard with AppShell, recommended problems, recent activity"
```

---

## Task 7: Problems page — add AppShell

**Files:**
- Modify: `frontend/app/problems/page.tsx`

- [ ] **Step 1: Wrap ProblemsPage with AppShell**

In `frontend/app/problems/page.tsx`, add the import at the top:

```tsx
import { AppShell } from "@/components/layout/app-shell";
```

Find the `return (` in `ProblemsPage` and wrap the outermost `<main>` element with `<AppShell>`:

```tsx
return (
  <AppShell>
    <main className="flex min-h-0 flex-col bg-background">
      {/* existing content unchanged */}
    </main>
  </AppShell>
);
```

Do the same for the loading state return.

- [ ] **Step 2: Verify problems page renders with sidebar**

Open `http://localhost:3000/problems`. Sidebar should be visible on the left.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/problems/page.tsx
git commit -m "feat(frontend): add AppShell sidebar to problems page"
```

---

## Task 8: Learn screen (SCR-02)

**Files:**
- Create: `frontend/app/learn/page.tsx`

- [ ] **Step 1: Create `frontend/app/learn/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify the page renders**

Open `http://localhost:3000/learn`. Should show the empty state ("Curriculum paths coming soon") if no paths are seeded, or path cards if they exist.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/learn/page.tsx
git commit -m "feat(frontend): add Learn screen with curriculum paths (SCR-02)"
```

---

## Task 9: Progress screen (SCR-03)

**Files:**
- Create: `frontend/app/progress/page.tsx`

- [ ] **Step 1: Create `frontend/app/progress/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CheckCircle, Eye, Lightbulb } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type UserOut, type SubmissionHistoryItem } from "@/lib/api";

export default function ProgressPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserOut | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const [user, subs] = await Promise.all([
          apiFetch<UserOut>("/users/me", { token }),
          apiFetch<SubmissionHistoryItem[]>("/submissions/me?limit=50", { token }),
        ]);
        setProfile(user);
        setSubmissions(subs);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
          ))}
        </div>
      </AppShell>
    );
  }

  const skillEntries = Object.entries(
    (profile?.skill_level as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a);

  const langCounts = submissions.reduce<Record<string, number>>((acc, s) => {
    acc[s.language] = (acc[s.language] ?? 0) + 1;
    return acc;
  }, {});

  const avgScore =
    submissions.filter((s) => s.score !== null).length > 0
      ? submissions
          .filter((s) => s.score !== null)
          .reduce((sum, s) => sum + (s.score ?? 0), 0) /
        submissions.filter((s) => s.score !== null).length
      : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your coding journey — submissions, skill levels, and consistency.
        </p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Problems solved" value={String(submissions.length)} />
          <MiniStat label="XP earned" value={(profile?.xp_total ?? 0).toLocaleString()} />
          <MiniStat label="Streak" value={`${profile?.streak_days ?? 0}d`} />
          <MiniStat
            label="Avg score"
            value={avgScore !== null ? `${Math.round(avgScore * 100)}%` : "—"}
          />
        </div>

        {/* Language breakdown */}
        {Object.keys(langCounts).length > 0 && (
          <div className="mt-6 rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">By language</h2>
            <div className="flex gap-3">
              {Object.entries(langCounts).map(([lang, count]) => (
                <div key={lang} className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {lang}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill breakdown */}
        {skillEntries.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Skill levels</h2>
            <ul className="space-y-2.5">
              {skillEntries.map(([topic, level]) => (
                <li key={topic} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs font-medium capitalize text-foreground/80">
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

        {/* Submission history */}
        <div className="mt-4">
          <h2 className="mb-3 text-sm font-semibold">Submission history</h2>
          {submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
              <BarChart3 className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No submissions yet. Solve a problem to get started.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Problem</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Lang</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Hints</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border/50 last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="truncate font-medium">{s.problem_title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {s.language}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.score !== null ? (
                          <span className="font-medium text-primary">
                            {Math.round(s.score * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="flex items-center justify-end gap-1 text-muted-foreground">
                          {s.hints_used > 0 && (
                            <>
                              <Lightbulb className="size-3" />
                              {s.hints_used}
                            </>
                          )}
                          {s.solution_viewed && <Eye className="size-3 ml-1" />}
                          {s.hints_used === 0 && !s.solution_viewed && (
                            <CheckCircle className="size-3 text-emerald-500" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Open `http://localhost:3000/progress`. Verify stats row, skill breakdown, and submission table (empty state if no submissions).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/progress/page.tsx
git commit -m "feat(frontend): add Progress screen with submission history and skill breakdown (SCR-03)"
```

---

## Task 10: Settings screen (SCR-04)

**Files:**
- Create: `frontend/app/settings/page.tsx`

- [ ] **Step 1: Create `frontend/app/settings/page.tsx`**

```tsx
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
              <label className="mb-1.5 block text-xs font-medium text-foreground/80" htmlFor="display-name">
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
              <label className="mb-1.5 block text-xs font-medium text-foreground/80" htmlFor="profile-level">
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
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-0.5 text-sm font-medium">{profile?.email}</p>
            </div>
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
```

- [ ] **Step 2: Verify the settings page**

Open `http://localhost:3000/settings`. Verify:
- Profile form with display name input and level selector
- Account section shows email
- Theme buttons switch the app between light and dark mode

- [ ] **Step 3: Commit**

```bash
git add frontend/app/settings/page.tsx
git commit -m "feat(frontend): add Settings screen with profile editing and theme toggle (SCR-04)"
```

---

## Task 11: Update PROGRESS.md and final commit

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Update PROGRESS.md**

Update `PROGRESS.md` to reflect all completed work:

- Move Phase 7 items to Completed with today's date (2026-05-18)
- Add landing page as a completed item
- Update Current Status
- Clear "In Progress"
- Set Next Steps to: Stripe billing integration, problem set expansion, deploy to production

- [ ] **Step 2: Run all backend tests to confirm nothing is broken**

```bash
cd /Users/sai/WS/help_me_code/backend
source .venv/bin/activate
pytest -v
```

Expected: all tests pass (34 existing + 2 new = 36).

- [ ] **Step 3: Final commit**

```bash
cd /Users/sai/WS/help_me_code
git add PROGRESS.md
git commit -m "chore: update PROGRESS.md — landing page + Phase 7 complete"
```

---

## Self-review

**Spec coverage check:**
- SCR-01 Dashboard: ✓ Task 6 — XP, streak, recommended problems, recent activity
- SCR-02 Learn: ✓ Task 8 — curriculum paths with empty state
- SCR-03 Progress: ✓ Task 9 — stats, skill breakdown, submission history
- SCR-04 Settings: ✓ Task 10 — profile form + theme toggle
- Landing page: ✓ Task 4 — hero, features, pricing, footer
- `GET /submissions/me`: ✓ Task 1 — endpoint + schema + tests

**Gaps intentionally deferred (YAGNI):**
- LLM model selector in settings: requires plan-gating logic beyond current scope
- Default language persistence: stored client-side only for now, backend field not yet added
- Streak calendar visualization: charting library not yet installed
- Skill history time-series chart: needs skill_snapshots endpoint, deferred

**Placeholder scan:** None found.

**Type consistency check:**
- `SubmissionHistoryItem` defined in Task 1 backend schema, used in Task 5 frontend type, consumed by Tasks 6 (dashboard) and 9 (progress) — consistent.
- `CurriculumPathOut` defined in Task 5 frontend type, consumed by Task 8 — consistent.
- `AppShell` created in Task 3, imported by Tasks 6, 7, 8, 9, 10 — consistent.
