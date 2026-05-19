"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronLeft,
  Code2,
  GraduationCap,
  Laugh,
  Loader2,
  Rocket,
  Sparkles,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch, type LearningPathOut, type LearningPathProblem } from "@/lib/api";

// ─── Step config ─────────────────────────────────────────────────────────────

const PROFILE_LEVELS = [
  { value: "kid", label: "Kid", description: "Ages 8–14, learning the basics", icon: Laugh },
  { value: "student", label: "Student", description: "High school or university", icon: GraduationCap },
  { value: "engineer", label: "Engineer", description: "Working professional", icon: Briefcase },
] as const;

const EXPERIENCE_LEVELS = [
  { value: "none", label: "Brand new", description: "I've never written code before", icon: Sparkles },
  { value: "some", label: "Some exposure", description: "I've done a tutorial or two", icon: BookOpen },
  { value: "comfortable", label: "Comfortable", description: "I can write programs that work", icon: Code2 },
  { value: "professional", label: "Professional", description: "I code for work or study", icon: Briefcase },
] as const;

const LEARNING_GOALS = [
  { value: "job", label: "Land a job", description: "Prep for technical interviews", icon: Rocket },
  { value: "improve", label: "Improve my skills", description: "Level up as a developer", icon: Zap },
  { value: "fun", label: "Learn for fun", description: "Explore coding out of curiosity", icon: Laugh },
  { value: "course", label: "Pass a course", description: "Get through a class or bootcamp", icon: GraduationCap },
] as const;

const TOPIC_OPTIONS = [
  "strings", "arrays", "math", "loops", "functions", "hash-map",
  "binary-tree", "graph", "dynamic-programming", "recursion",
  "sorting", "binary-search", "linked-list", "stack", "queue",
  "puzzles", "two-pointers", "sliding-window",
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "text-emerald-400 bg-emerald-400/10",
  easy: "text-green-400 bg-green-400/10",
  medium: "text-amber-400 bg-amber-400/10",
  hard: "text-red-400 bg-red-400/10",
};

const TOTAL_STEPS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileLevel = (typeof PROFILE_LEVELS)[number]["value"];
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]["value"];
type LearningGoal = (typeof LEARNING_GOALS)[number]["value"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
        <span className="text-xs text-muted-foreground">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SelectionCard<T extends string>({
  option,
  selected,
  onSelect,
}: {
  option: { value: T; label: string; description: string; icon: React.ElementType };
  selected: boolean;
  onSelect: (v: T) => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={`flex items-center gap-4 w-full rounded-xl border p-4 text-left transition-all duration-150 ${
        selected
          ? "border-primary bg-primary/8 ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{option.label}</p>
        <p className="text-xs text-muted-foreground">{option.description}</p>
      </div>
      {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

function TopicChip({ topic, selected, onToggle }: { topic: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {selected && <span className="mr-1">✓</span>}
      {topic.replace(/-/g, " ")}
    </button>
  );
}

function ProblemCard({ problem }: { problem: LearningPathProblem }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(problem.slug ? `/practice/${problem.id}` : `/practice/${problem.id}`)}
      className="flex items-center gap-3 w-full rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/30 transition-all duration-150"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{problem.title}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {problem.topic.slice(0, 2).map((t) => (
            <span key={t} className="text-xs text-muted-foreground">{t.replace(/-/g, " ")}</span>
          ))}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${DIFFICULTY_COLORS[problem.difficulty] ?? "text-muted-foreground"}`}>
        {problem.difficulty}
      </span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfileSetupPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [profileLevel, setProfileLevel] = useState<ProfileLevel>("student");
  const [experience, setExperience] = useState<ExperienceLevel>("none");
  const [goal, setGoal] = useState<LearningGoal>("fun");
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [learningPath, setLearningPath] = useState<LearningPathOut | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(t: string) {
    setTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  async function saveAndReveal() {
    setError(null);
    setSaving(true);

    const supabase = createClient();
    const token = await getValidatedAccessToken(supabase);
    if (!token) {
      setError("Session expired. Please log in again.");
      setSaving(false);
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
          coding_experience: experience,
          learning_goal: goal,
          interested_topics: Array.from(topics),
        }),
      });

      const path = await apiFetch<LearningPathOut>("/users/me/learning-path", { token });
      setLearningPath(path);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Code2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {step === 5 ? "Your learning path" : "Set up your profile"}
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            {step === 5
              ? "Here are your first problems — hand-picked for you"
              : "A few quick questions to personalize your experience"}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-7 shadow-sm">
          {step < 5 && <ProgressBar step={step} />}

          {/* Step 1: Name + Role */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold mb-1">What should we call you?</h2>
                <p className="text-xs text-muted-foreground mb-3">This is how you'll appear across the platform.</p>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sai"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                />
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">I am a…</p>
                <div className="grid gap-2">
                  {PROFILE_LEVELS.map((l) => (
                    <SelectionCard key={l.value} option={l} selected={profileLevel === l.value} onSelect={setProfileLevel} />
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                disabled={displayName.trim().length < 2}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Coding experience */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold mb-1">How much coding experience do you have?</h2>
                <p className="text-xs text-muted-foreground mb-3">Be honest — we'll match the difficulty to your level.</p>
                <div className="grid gap-2">
                  {EXPERIENCE_LEVELS.map((l) => (
                    <SelectionCard key={l.value} option={l} selected={experience === l.value} onSelect={setExperience} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Learning goal */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold mb-1">What's your main goal?</h2>
                <p className="text-xs text-muted-foreground mb-3">We'll prioritize problems that move you toward this.</p>
                <div className="grid gap-2">
                  {LEARNING_GOALS.map((l) => (
                    <SelectionCard key={l.value} option={l} selected={goal === l.value} onSelect={setGoal} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Topics of interest */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold mb-1">Any topics you're curious about?</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Pick as many as you like — or skip to let us decide.
                </p>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_OPTIONS.map((t) => (
                    <TopicChip key={t} topic={t} selected={topics.has(t)} onToggle={() => toggleTopic(t)} />
                  ))}
                </div>
                {topics.size > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">{topics.size} selected</p>
                )}
              </div>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1" disabled={saving}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button onClick={saveAndReveal} className="flex-1" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Building path…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-4 w-4" /> Show my path
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Learning path reveal */}
          {step === 5 && learningPath && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 rounded-lg bg-primary/8 border border-primary/20 px-4 py-3">
                <Trophy className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm text-foreground">{learningPath.message}</p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {learningPath.problems.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <ProblemCard problem={p} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {learningPath.problems[0] && (
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/practice/${learningPath.problems[0].id}`)}
                  >
                    <Rocket className="mr-1.5 h-4 w-4" /> Start with problem 1
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { router.push("/dashboard"); router.refresh(); }}
                >
                  Go to dashboard
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Step dots */}
        {step < 5 && (
          <div className="flex justify-center gap-1.5 mt-5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-6 bg-primary" : s < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
