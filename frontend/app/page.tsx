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
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
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
            <p className="mt-3 text-muted-foreground">AI tools built for serious coding practice</p>
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
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted">{icon}</span>
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
