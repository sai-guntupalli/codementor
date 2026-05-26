"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Brain,
  Eye,
  Lightbulb,
  MessageSquare,
  PlayCircle,
  Route,
  Sparkles,
} from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#", label: "Home", active: true },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
];

const TESTIMONIALS = [
  {
    name: "Alex Rivera",
    role: "L5 Engineer @ Meta",
    quote:
      "The AI mental model visualization was the 'aha' moment for me. It transformed how I think about memory management in C++.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCFaCSbIu0qlZfJZ3Iwjh2-JUN8aD0rdQjUVrMirCvOpucYHTQLi2EYIbgH_vSPsQ54s5JFYSj83iWBIFxKv22uQOySDif0RSCyAgSYacRl4RHKonAlzNbZKWVtqO34vipfLHMh9EApW0HvFPJeas2IGDPhRzifoG2J8Zn6JSbZ7OOQzfmjmucwXk-sUHn_uJBhgbpiLKuK7OUJQGpJJe9YH55KWd7SNC2ZzdvtHNBcFKNmaAxA9MOlOLcjrfjGE8L3oQz0jU2-fmw",
  },
  {
    name: "Sarah Chen",
    role: "Backend Lead @ Stripe",
    quote:
      "I've tried every platform out there. CodeMentor is the only one that feels like having a senior architect sitting right next to you.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBq6okPs-4JeIGLlViZlieh6p2CsrMC2P9IGksmiu3_NzikyG4-tUnunV-DwuyOboEn6o4JOrRbAdXlbGRGv9veK0ZNDVPEN7FR7bvbrKXXBrhyAr4f8No4KzwmUi0VQUxBWypNjtMjdmtAR_kAMPUize-J-GEjRWaM09fARFm9_3_sgSn7w86xI-J1_MNwGXgHgDuFapkP92XGHFgq-Uby9rZLuBmFvqL284DDfSHTywKVBG-A_fha_3sGId_Mm-vn3UyyHNDPvQ0",
  },
  {
    name: "Marcus Jones",
    role: "Staff Architect @ Google",
    quote:
      "The interview prep modules are scarily accurate. It predicted my weak points in system design before I even knew I had them.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAb72kbawfuy8UV9XRGdHlZYKj4K_ZBmdwZVh9LX5EDluzdMz5RcAEGfML-xvCxeSRiMRb1DpovgTAnOvy_49vjTJAROmNvzG69LrrKwcACBRc5DIyLawg491JLquCOdS4vUcb1p2ZXuFri_Dis8-OdczhFMCyQFBEv9xg_wrmIoXLT8QEMAfe21NfnEWcUfVNfy0KU7gW7aWgOeqNv4X-OkCDllOmkIUD1ih5p4C9eyfZ_i2nX-X_WA-lxsAZVaGjZ6M6GmxNjWIw",
  },
];

export function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="living-glow fixed top-[-10%] left-[-10%] z-0 h-[50%] w-[50%]" aria-hidden />
      <div className="living-glow fixed right-[-10%] bottom-[-10%] z-0 h-[50%] w-[50%]" aria-hidden />

      <nav className="fixed top-0 z-50 h-20 w-full border-b border-white/10 bg-background/70 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6 lg:px-10">
          <Link href="/" className="text-xl font-bold tracking-tight text-primary">
            CodeMentor
          </Link>
          <div className="hidden items-center gap-10 md:flex">
            {NAV_LINKS.map(({ href, label, active }) => (
              <a
                key={label}
                href={href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  active
                    ? "border-b-2 border-primary pb-1 font-bold text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-foreground transition-colors hover:text-primary sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="aura-gradient rounded-lg px-6 py-2 text-sm font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              Start Learning
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-20">
        {/* Hero */}
        <section className="mx-auto flex min-h-[min(819px,90vh)] max-w-[1440px] flex-col items-center justify-between gap-10 px-6 py-16 lg:flex-row lg:gap-16 lg:px-10 lg:py-24">
          <div className="flex-1 text-center lg:text-left">
            <div className="glass-panel mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 px-3 py-1">
              <Sparkles className="size-4 text-secondary" />
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-secondary uppercase">
                The AI Revolution in Learning
              </span>
            </div>
            <h1 className="mb-4 text-4xl leading-tight font-bold tracking-tight md:text-5xl lg:text-[64px] lg:leading-[72px]">
              Master the Art of <span className="aura-gradient-text">Code</span> with Sensei AI.
            </h1>
            <p className="mx-auto mb-10 max-w-[600px] text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-xl lg:leading-[30px]">
              Your hyper-intelligent digital tutor that adapts to your mental models, prepares you
              for elite technical interviews, and ensures you never just copy-paste again.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
              <Link
                href="/signup"
                className="aura-gradient w-full rounded-lg px-8 py-4 text-center text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 sm:w-auto"
              >
                Start Learning Now
              </Link>
              <a
                href="#features"
                className="glass-panel flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-8 py-4 text-lg font-bold transition-colors hover:bg-white/5 active:scale-95 sm:w-auto"
              >
                <PlayCircle className="size-5" />
                Watch Demo
              </a>
            </div>
          </div>

          <div className="relative w-full flex-1">
            <div className="ai-mentor-aura relative rounded-xl p-2 shadow-2xl lg:rotate-[2deg]">
              <div className="mb-2 flex items-center gap-2 border-b border-white/10 px-4 py-2">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-[#FF5F56]" />
                  <div className="size-3 rounded-full bg-[#FFBD2E]" />
                  <div className="size-3 rounded-full bg-[#27C93F]" />
                </div>
                <div className="flex-1 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground opacity-60">
                  Solution.ts — CodeMentor IDE
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-[#060e20] p-4">
                <pre className="font-[family-name:var(--font-jetbrains-mono)] text-sm leading-relaxed text-secondary/90">
                  <span className="text-primary">async function</span>{" "}
                  <span className="text-secondary">findPath</span>(graph:{" "}
                  <span className="text-[#ffafd3]">Graph</span>) {"{"}
                  {"\n"}
                  {"  "}
                  <span className="text-muted-foreground">
                    {"// AI Suggestion: Consider BFS for unweighted"}
                  </span>
                  {"\n"}
                  {"  "}
                  <span className="text-primary">const</span> queue = [graph.root];
                  {"\n"}
                  {"  "}
                  <span className="border-l-2 border-primary bg-primary/20 px-1">
                    while (queue.length &gt; 0) {"{"}
                  </span>
                  {"\n"}
                  {"    "}
                  <span className="text-primary">const</span> node = queue.shift();
                  {"\n"}
                  {"    ..."}
                  {"\n"}
                  {"  }"}
                  {"\n"}
                  {"}"}
                </pre>
                <div className="absolute right-4 bottom-4 max-w-[280px] animate-pulse rounded-lg border border-primary/30 glass-panel p-4 shadow-2xl">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="aura-gradient flex size-8 items-center justify-center rounded-full">
                      <Brain className="size-4 text-primary-foreground" />
                    </div>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-primary uppercase">
                      Sensei AI
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
                    &quot;How might using a <b>Set</b> here improve your time complexity for
                    cycles?&quot;
                  </p>
                </div>
              </div>
            </div>
            <div
              className="absolute -z-10 top-1/2 left-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[100px]"
              aria-hidden
            />
          </div>
        </section>

        {/* Features bento */}
        <ScrollReveal>
          <section id="features" className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10">
            <div className="mb-16 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-5xl">
                Built for Every Stage of the Journey
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground">
                From your first line of code to senior engineering interviews, we&apos;ve built the
                ultimate environment for mastery.
              </p>
            </div>
            <div className="grid h-auto grid-cols-1 gap-6 md:h-[600px] md:grid-cols-4 md:grid-rows-2">
              <div className="glass-panel group flex flex-col justify-between rounded-xl p-8 transition-all hover:border-primary/50 md:col-span-2">
                <div>
                  <Route className="mb-4 size-8 text-primary" />
                  <h3 className="mb-2 text-2xl font-semibold">Adaptive Learning Paths</h3>
                  <p className="text-muted-foreground">
                    Algorithms that detect your knowledge gaps and dynamically re-route your
                    curriculum in real-time.
                  </p>
                </div>
                <Image
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCNcC3SisVOE_hT_t4IN2I4IX5_3MS7WMgQz34xtGYCSxv0HaJlXn6c0aV8GSBy2cZiEi-utCA9Fmna1oYt42bketrfm3oNrwqXaCkFke-ZkJqjwbMDVZzgCr17OwrbA3trorSGMh7FkE0rhxjrvzwOWiQiX8vh_0VuV2wAssbezFCmih1xxVKw0reWJg3BlPJC6MyM9SIbYU0q2L29nVnY88O2BnXltBlhWk_8_nqYYx-yzrzMquaLyyJKC3bEncBETxZqX_beRvo"
                  alt="Adaptive learning pathways visualization"
                  width={600}
                  height={128}
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="mt-6 h-32 w-full rounded-lg object-cover opacity-60 transition-opacity group-hover:opacity-100"
                />
              </div>
              <div className="glass-panel group flex flex-col items-center justify-center rounded-xl p-8 text-center transition-all hover:border-secondary/50">
                <MessageSquare className="mb-4 size-12 text-secondary" />
                <h3 className="mb-2 text-2xl font-semibold">Real-time AI Tutoring</h3>
                <p className="text-sm text-muted-foreground">
                  A 24/7 mentor that talks through logic instead of giving answers.
                </p>
              </div>
              <div className="glass-panel group flex flex-col items-center justify-center rounded-xl p-8 text-center transition-all hover:border-[#ffafd3]/50">
                <BarChart3 className="mb-4 size-12 text-[#ffafd3]" />
                <h3 className="mb-2 text-2xl font-semibold">Career Readiness</h3>
                <p className="text-sm text-muted-foreground">
                  Visualize your growth with metrics that top recruiters actually care about.
                </p>
              </div>
              <div className="glass-panel flex flex-col items-center gap-8 rounded-xl p-8 transition-all hover:border-white/20 md:col-span-4 md:flex-row">
                <div className="flex-1">
                  <div className="mb-2 inline-block rounded-lg bg-secondary/10 px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-secondary uppercase">
                    Industry Grade
                  </div>
                  <h3 className="mb-2 text-3xl font-bold">Professional IDE Workspace</h3>
                  <p className="text-muted-foreground">
                    Cloud-based, VS Code powered environment pre-configured with everything you need
                    to build production-scale apps.
                  </p>
                </div>
                <div className="w-full flex-1 rounded-lg border border-white/5 bg-muted p-4">
                  <div className="mb-2 flex gap-1">
                    <div className="size-2 rounded-full bg-white/10" />
                    <div className="size-2 rounded-full bg-white/10" />
                    <div className="size-2 rounded-full bg-white/10" />
                  </div>
                  <div className="h-20 w-full animate-pulse rounded bg-background/50" />
                  <div className="mt-2 h-4 w-[60%] rounded bg-white/5" />
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Sensei advantage */}
        <ScrollReveal>
          <section id="about" className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10">
            <div className="flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-surface lg:flex-row">
              <div className="flex-1 p-8 lg:p-16">
                <h2 className="mb-8 text-3xl font-bold md:text-5xl">The Sensei AI Advantage</h2>
                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="glass-panel flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/40">
                      <Lightbulb className="size-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="mb-1 text-xl font-semibold text-muted-foreground">
                        Nudges, Not Spoilers
                      </h4>
                      <p className="text-muted-foreground">
                        Sensei detects when you&apos;re stuck and provides socratic hints that force
                        your brain to make the connection, ensuring deep neural retention.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="glass-panel flex size-12 shrink-0 items-center justify-center rounded-full border border-secondary/40">
                      <Eye className="size-5 text-secondary" />
                    </div>
                    <div>
                      <h4 className="mb-1 text-xl font-semibold text-muted-foreground">
                        Mental Model Visualization
                      </h4>
                      <p className="text-muted-foreground">
                        See the heap, the stack, and the pointers in real-time. We turn abstract
                        code into interactive 3D visualizations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative h-[400px] w-full flex-1 overflow-hidden lg:h-[500px]">
                <Image
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsDV3zV559a-6oqI47l6gSgUTUYKlv69sRuRQW4T4gz70l_HZQQrqfl5C2_mmjRR_m8TYZg1ZXS7GKM0VsJWTbr5-evg1zK8pNOWg2TB5U1YWKW0azu6LgLYRChFANk20jh_ZJivkn5dIysjYx9-YH9TNdcHhoJ4RB9y8sW7MrtUqcmD3oVDRIzHtntJjEa4rAif3FHMqme4yBqGA7ytxEfBfV_wW5szE9C8AL1Eu0Sy0tqXlczkVjY-JgLoY4lLaUFf-ZHn2UsrE"
                  alt="Mental model visualization"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 hidden bg-gradient-to-r from-surface to-transparent lg:block" />
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Testimonials */}
        <ScrollReveal>
          <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10">
            <div className="mb-16 text-center">
              <h2 className="mb-3 text-3xl font-bold md:text-5xl">Joined by 50,000+ Engineers</h2>
              <p className="text-muted-foreground">
                Empowering developers at the world&apos;s leading technology companies.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="glass-panel rounded-xl p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Image
                      src={t.image}
                      alt={t.name}
                      width={48}
                      height={48}
                      sizes="48px"
                      className="size-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-bold">{t.name}</p>
                      <p className="text-sm text-secondary">{t.role}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground italic">&quot;{t.quote}&quot;</p>
                </div>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* Pricing anchor + CTA */}
        <ScrollReveal>
          <section id="pricing" className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10">
            <div className="aura-gradient relative overflow-hidden rounded-3xl p-10 text-center shadow-2xl md:p-16">
              <div
                className="absolute top-0 right-0 size-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[60px]"
                aria-hidden
              />
              <div
                className="absolute bottom-0 left-0 size-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-black/10 blur-[60px]"
                aria-hidden
              />
              <div className="relative z-10">
                <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-5xl">
                  Your Elite Coding Journey Starts Today.
                </h2>
                <p className="mx-auto mb-10 max-w-[600px] text-lg text-primary-foreground/80">
                  Join the next generation of engineers who learn smarter, build faster, and lead
                  the industry.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    href="/signup"
                    className="rounded-lg bg-[#23005c] px-12 py-4 text-lg font-bold text-primary shadow-xl transition-transform hover:scale-105 active:scale-95"
                  >
                    Get Early Access
                  </Link>
                  <Link
                    href="/learn"
                    className="rounded-lg border-2 border-primary-foreground/30 px-12 py-4 text-lg font-bold text-primary-foreground transition-colors hover:bg-white/10"
                  >
                    View Curriculum
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-surface py-16">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-8 px-6 md:flex-row lg:px-10">
          <div className="flex flex-col items-center gap-1 md:items-start">
            <span className="text-xl font-bold text-primary">CodeMentor</span>
            <p className="text-sm text-muted-foreground">
              The world&apos;s first AI-native learning ecosystem.
            </p>
          </div>
          <div className="flex gap-8 text-sm">
            <a href="#features" className="text-muted-foreground transition-colors hover:text-secondary">
              Product
            </a>
            <a href="#about" className="text-muted-foreground transition-colors hover:text-secondary">
              Community
            </a>
            <span className="text-muted-foreground">Terms</span>
            <span className="text-muted-foreground">Privacy</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 CodeMentor AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
