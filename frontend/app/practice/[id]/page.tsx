"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, FileText, ListTodo, Play, Sparkles, Terminal } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStarterCode } from "@/lib/starter-code";
import { difficultyBadgeVariant } from "@/lib/tags";
import { CodeEditor } from "@/components/editor/code-editor";
import { AiPanel, type AiTab } from "@/components/practice/ai-panel";
import { MarkdownContent } from "@/components/markdown-content";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch } from "@/lib/api";
import {
  streamChat,
  streamCodeReview,
  streamHint,
  streamReview,
  streamSolution,
  streamSurprise,
} from "@/lib/practice-api";
import { runTestCases, type TestCaseResult } from "@/lib/execute-api";
import { cn } from "@/lib/utils";

type Example = {
  input: string;
  output: string;
  explanation?: string;
};

type Problem = {
  id: string;
  title: string;
  description: string;
  language: string;
  difficulty: string;
  examples: Example[];
  constraints: string | null;
};

type ProblemListItem = {
  id: string;
  title: string;
  language: string;
  difficulty: string;
};

type SubmissionOut = { id: string };

type DescTab = "description" | "problems";

export default function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [problemList, setProblemList] = useState<ProblemListItem[]>([]);
  const [code, setCode] = useState("");
  const [descTab, setDescTab] = useState<DescTab>("description");
  const [mobileDescOpen, setMobileDescOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<AiTab>("review");
  const [review, setReview] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [hintCount, setHintCount] = useState(0);
  const [solution, setSolution] = useState("");
  const [codeReview, setCodeReview] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [solutionLevel, setSolutionLevel] = useState("beginner");

  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [running, setRunning] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const token = await getValidatedAccessToken(supabase);
    if (!token) {
      router.replace("/login");
      return null;
    }
    return token;
  }, [router]);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token || !id) return;
      try {
        const [p, list] = await Promise.all([
          apiFetch<Problem>(`/problems/${id}`, { token }),
          apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token }),
        ]);
        setProblem(p);
        setProblemList(list.items);
        const draft = localStorage.getItem(`cm_code_${id}`);
        setCode(draft ?? getStarterCode(p.language));
        if (draft) {
          setDraftRestored(true);
          setTimeout(() => setDraftRestored(false), 3000);
        }
        setReview("");
        setHints([]);
        setHintCount(0);
        setSolution("");
        setCodeReview("");
        setChatMessages([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    load();
  }, [id, getToken]);

  useEffect(() => {
    if (!id || !code) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`cm_code_${id}`, code);
    }, 500);
    return () => clearTimeout(timer);
  }, [id, code]);

  async function handleRun() {
    if (!problem || !code.trim()) return;
    setRunning(true);
    setOutputOpen(true);
    setTestResults([]);
    try {
      const token = await getToken();
      if (!token) return;
      const results = await runTestCases(problem.language, code, token, problem.examples);
      setTestResults(results);
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!problem) return;
    setError(null);
    setStreaming(true);
    setReview("");
    setXpEarned(null);
    setReviewComplete(false);
    setAiPanelOpen(true);
    setActiveTab("review");
    if (id) localStorage.removeItem(`cm_code_${id}`);

    const token = await getToken();
    if (!token) {
      setStreaming(false);
      return;
    }

    try {
      const submission = await apiFetch<SubmissionOut>("/submissions", {
        method: "POST",
        token,
        body: JSON.stringify({
          problem_id: problem.id,
          code,
          language: problem.language,
        }),
      });

      await streamReview(submission.id, token, {
        onToken: (t) => setReview((prev) => prev + t),
        onDone: (payload) => {
          const xp = payload.xp_earned;
          if (typeof xp === "number" && xp > 0) setXpEarned(xp);
          setReviewComplete(true);
        },
        onError: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setStreaming(false);
    }
  }

  async function handleHint(n: number) {
    if (!problem || hintCount >= n) return;
    const token = await getToken();
    if (!token) return;

    setStreaming(true);
    setAiPanelOpen(true);
    setActiveTab("hints");
    setHints((prev) => {
      const next = [...prev];
      next[n - 1] = "";
      return next;
    });

    try {
      await streamHint(problem.id, token, code, n, {
        onToken: (t) => {
          setHints((prev) => {
            const next = [...prev];
            next[n - 1] = (next[n - 1] ?? "") + t;
            return next;
          });
        },
        onError: (msg) => setError(msg),
      });
      setHintCount(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hint failed");
    } finally {
      setStreaming(false);
    }
  }

  async function handleSolution() {
    if (!problem) return;
    const token = await getToken();
    if (!token) return;

    setStreaming(true);
    setSolution("");
    setAiPanelOpen(true);
    setActiveTab("solution");

    try {
      await streamSolution(problem.id, token, solutionLevel, {
        onToken: (t) => setSolution((prev) => prev + t),
        onError: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solution failed");
    } finally {
      setStreaming(false);
    }
  }

  async function handleCodeReview() {
    if (!problem) return;
    const token = await getToken();
    if (!token) return;

    setStreaming(true);
    setCodeReview("");
    setAiPanelOpen(true);
    setActiveTab("code-review");

    try {
      await streamCodeReview(problem.id, token, code, {
        onToken: (t) => setCodeReview((prev) => prev + t),
        onError: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code review failed");
    } finally {
      setStreaming(false);
    }
  }

  async function handleChat() {
    if (!problem || !chatInput.trim()) return;
    const token = await getToken();
    if (!token) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);
    setAiPanelOpen(true);
    setActiveTab("chat");

    let assistant = "";
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      await streamChat(problem.id, token, userMsg, history, {
        onToken: (t) => {
          assistant += t;
          setChatMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: assistant };
            return next;
          });
        },
        onError: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setStreaming(false);
    }
  }

  async function handleSurprise() {
    if (!problem) return;
    const token = await getToken();
    if (!token) return;

    setStreaming(true);
    setError(null);

    try {
      await streamSurprise(token, problem.language, {
        onToken: () => {},
        onDone: (payload) => {
          const pid = payload.problem_id as string | undefined;
          if (pid) router.push(`/practice/${pid}`);
          else if (payload.parse_error) setError(String(payload.parse_error));
        },
        onError: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Surprise failed");
    } finally {
      setStreaming(false);
    }
  }

  if (loading) {
    return (
      <main className="flex h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[400px] shrink-0 flex-col border-r border-border/80 lg:flex">
            <div className="flex border-b border-border/80">
              <div className="h-10 w-28 animate-pulse bg-muted/40" />
              <div className="h-10 w-24 animate-pulse bg-muted/20" />
            </div>
            <div className="space-y-3 p-5">
              <div className="h-6 w-48 animate-pulse rounded-md bg-muted/60" />
              <div className="flex gap-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
                <div className="h-5 w-12 animate-pulse rounded-full bg-muted/50" />
              </div>
              <div className="mt-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-3 animate-pulse rounded-full bg-muted/40" style={{ width: `${75 + i * 5}%` }} />
                ))}
              </div>
            </div>
          </aside>
          <section className="flex flex-1 flex-col">
            <div className="flex h-9 shrink-0 items-center border-b border-border/80 bg-card/40 px-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-muted/50" />
            </div>
            <div className="flex-1 p-4">
              <div className="h-full animate-pulse rounded-xl bg-muted/20" />
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!problem) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-destructive">{error ?? "Problem not found"}</p>
        <Link href="/problems" className="mt-4 inline-block text-sm text-primary">
          ← Back to problems
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-background">
      <AppHeader
        crumbs={[{ label: "Problems", href: "/problems" }]}
        title={problem.title}
        meta={
          <span className="ml-1 flex items-center gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {problem.language}
            </Badge>
            <Badge variant={difficultyBadgeVariant(problem.difficulty)} className="capitalize">
              {problem.difficulty}
            </Badge>
            {draftRestored && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Draft restored
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={running || streaming || problem.language !== "python"}
              onClick={handleRun}
              title={problem.language !== "python" ? "Run is only available for Python" : undefined}
            >
              {running ? (
                <>
                  <span className="mr-1.5 size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="mr-1.5 size-3.5" />
                  Run
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant={aiPanelOpen ? "secondary" : "outline"}
              onClick={() => setAiPanelOpen((o) => !o)}
            >
              <Sparkles className="mr-1.5 size-3.5" />
              {aiPanelOpen ? "Hide AI" : "AI Assistant"}
            </Button>
            <Button size="sm" variant="outline" disabled={streaming} onClick={handleSurprise}>
              Surprise me
            </Button>
            <Button size="sm" disabled={streaming} onClick={handleSubmit}>
              {streaming && activeTab === "review" ? "Reviewing…" : "Submit code"}
            </Button>
          </>
        }
      />

      {error && (
        <p className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Description panel — desktop */}
        <aside className="hidden w-[400px] shrink-0 flex-col border-r border-border/80 bg-card/40 lg:flex">
          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-border/80 bg-card/60">
            <button
              type="button"
              onClick={() => setDescTab("description")}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
                descTab === "description"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="size-3.5" />
              Description
            </button>
            <button
              type="button"
              onClick={() => setDescTab("problems")}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
                descTab === "problems"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTodo className="size-3.5" />
              Problems
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {descTab === "description" ? (
              <div className="p-5">
                <h1 className="text-lg font-semibold leading-tight">{problem.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {problem.language}
                  </Badge>
                  <Badge
                    variant={difficultyBadgeVariant(problem.difficulty)}
                    className="capitalize"
                  >
                    {problem.difficulty}
                  </Badge>
                </div>

                <div className="mt-4">
                  <MarkdownContent content={problem.description} />
                </div>

                {(() => {
                  const isPlaceholder = (s: string) =>
                    /see description/i.test(s) || s.trim() === "" || s.trim().toLowerCase() === "n/a";
                  const validExamples = (problem.examples ?? []).filter(
                    (ex) => !isPlaceholder(ex.input) && !isPlaceholder(ex.output)
                  );
                  return validExamples.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Examples
                    </p>
                    {validExamples.map((ex, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs"
                      >
                        <p className="mb-2 font-semibold text-foreground/70">Example {i + 1}</p>
                        <div className="space-y-1 font-mono">
                          <p>
                            <span className="text-muted-foreground">Input: </span>
                            <span className="text-foreground">{ex.input}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Output: </span>
                            <span className="text-foreground">{ex.output}</span>
                          </p>
                          {ex.explanation && (
                            <p className="mt-1.5 font-sans text-muted-foreground">
                              <span className="font-medium">Explanation: </span>
                              {ex.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  ) : null;
                })()}

                {problem.constraints && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Constraints
                    </p>
                    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
                      <MarkdownContent content={problem.constraints} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <nav className="p-2">
                <ul className="space-y-0.5">
                  {problemList.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/practice/${p.id}`}
                        className={cn(
                          "block rounded-lg px-2.5 py-2 text-sm transition-all",
                          p.id === problem.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                        )}
                      >
                        <span className="line-clamp-2 font-medium leading-snug">{p.title}</span>
                        <span
                          className={cn(
                            "mt-0.5 block text-xs",
                            p.id === problem.id
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground"
                          )}
                        >
                          {p.language} · {p.difficulty}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/problems"
                  className="mt-3 block rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  Browse all problems →
                </Link>
              </nav>
            )}
          </div>
        </aside>

        {/* Mobile description toggle */}
        <div className="flex min-w-0 flex-1 flex-col lg:hidden">
          <button
            type="button"
            onClick={() => setMobileDescOpen((o) => !o)}
            className="flex shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-4 py-2.5 text-xs font-medium text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="size-3.5 text-muted-foreground" />
              {problem.title}
            </span>
            {mobileDescOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            )}
          </button>
          {mobileDescOpen && (
            <div className="max-h-64 overflow-y-auto border-b border-border/80 bg-card/40 px-4 py-3">
              <MarkdownContent content={problem.description} />
            </div>
          )}
          <EditorColumn
            problem={problem}
            code={code}
            onCodeChange={setCode}
            outputOpen={outputOpen}
            testResults={testResults}
            running={running}
            onOutputClose={() => setOutputOpen(false)}
          />
        </div>

        {/* Desktop: editor column */}
        <div className="hidden min-w-0 flex-1 flex-col lg:flex">
          <EditorColumn
            problem={problem}
            code={code}
            onCodeChange={setCode}
            outputOpen={outputOpen}
            testResults={testResults}
            running={running}
            onOutputClose={() => setOutputOpen(false)}
          />
        </div>

        {/* AI panel — desktop side panel */}
        {aiPanelOpen && (
          <section className="hidden w-[min(400px,36vw)] shrink-0 lg:flex lg:flex-col">
            <AiPanel
              activeTab={activeTab}
              onTabChange={setActiveTab}
              review={review}
              hints={hints}
              hintCount={hintCount}
              solution={solution}
              codeReview={codeReview}
              chatMessages={chatMessages}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              solutionLevel={solutionLevel}
              onSolutionLevelChange={setSolutionLevel}
              loading={streaming}
              xpEarned={xpEarned}
              onRequestHint={handleHint}
              onRequestSolution={handleSolution}
              onRequestCodeReview={handleCodeReview}
              onSendChat={handleChat}
              reviewComplete={reviewComplete}
              onClose={() => setAiPanelOpen(false)}
            />
          </section>
        )}
      </div>

      {/* AI panel — mobile bottom sheet */}
      {aiPanelOpen && (
        <div className="flex h-[50vh] shrink-0 flex-col border-t border-border/80 lg:hidden">
          <AiPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            review={review}
            hints={hints}
            hintCount={hintCount}
            solution={solution}
            codeReview={codeReview}
            chatMessages={chatMessages}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            solutionLevel={solutionLevel}
            onSolutionLevelChange={setSolutionLevel}
            loading={streaming}
            onRequestHint={handleHint}
            onRequestSolution={handleSolution}
            onRequestCodeReview={handleCodeReview}
            onSendChat={handleChat}
            reviewComplete={reviewComplete}
            onClose={() => setAiPanelOpen(false)}
          />
        </div>
      )}
    </main>
  );
}

function EditorColumn({
  problem,
  code,
  onCodeChange,
  outputOpen,
  testResults,
  running,
  onOutputClose,
}: {
  problem: { language: string };
  code: string;
  onCodeChange: (v: string) => void;
  outputOpen: boolean;
  testResults: TestCaseResult[];
  running: boolean;
  onOutputClose: () => void;
}) {
  return (
    <>
      {/* Editor toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-3 py-1.5">
        <Badge variant="secondary" className="capitalize text-xs font-medium">
          {problem.language}
        </Badge>
      </div>

      {/* Code editor */}
      <div className="min-h-0 flex-1 p-3">
        <CodeEditor
          value={code}
          onChange={onCodeChange}
          language={problem.language}
          className="h-full min-h-[200px]"
        />
      </div>

      {/* Output panel — lives inside editor column */}
      <OutputPanel
        results={testResults}
        open={outputOpen}
        running={running}
        onClose={onOutputClose}
      />
    </>
  );
}

function OutputPanel({
  results,
  open,
  running,
  onClose,
}: {
  results: TestCaseResult[];
  open: boolean;
  running: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const allPassed = total > 0 && passed === total;
  const someFailed = total > 0 && passed < total;

  return (
    <div className="shrink-0 border-t border-border/80 bg-[oklch(0.13_0.025_275)]">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-white/30" />
          <span className="text-xs font-medium uppercase tracking-wider text-white/40">
            Test Results
          </span>
          {!running && total > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                allPassed
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-rose-500/15 text-rose-400"
              )}
            >
              {passed}/{total} passed
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-white/30 transition-colors hover:bg-white/8 hover:text-white/60"
        >
          <span className="text-xs leading-none">✕</span>
        </button>
      </div>

      <div className="max-h-52 overflow-y-auto">
        {running && (
          <div className="px-3 py-3">
            <span className="animate-pulse text-xs text-white/40">Running test cases…</span>
          </div>
        )}

        {!running && results.length === 0 && (
          <div className="px-3 py-3">
            <span className="text-xs text-white/30">(no results)</span>
          </div>
        )}

        {!running &&
          results.map((r) => (
            <div
              key={r.index}
              className={cn(
                "border-b border-white/5 px-3 py-2.5 last:border-0",
                r.passed ? "bg-emerald-500/5" : "bg-rose-500/5"
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
                    r.passed
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/20 text-rose-400"
                  )}
                >
                  {r.passed ? "✓" : "✗"}
                </span>
                <span className="text-xs font-medium text-white/60">
                  Case {r.index + 1}
                </span>
                {r.timed_out && (
                  <span className="text-[10px] text-amber-400">timed out</span>
                )}
              </div>

              <div className="space-y-1 pl-6 font-mono text-xs">
                {r.input.trim() !== "(none)" && r.input.trim() !== "" && (
                  <div className="flex gap-2">
                    <span className="w-16 shrink-0 text-white/30">stdin</span>
                    <span className="text-white/60">{r.input}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="w-16 shrink-0 text-white/30">expected</span>
                  <pre className="whitespace-pre-wrap text-white/70">{r.expected}</pre>
                </div>
                {!r.passed && !r.timed_out && (
                  <div className="flex gap-2">
                    <span className="w-16 shrink-0 text-white/30">got</span>
                    <pre
                      className={cn(
                        "whitespace-pre-wrap",
                        r.actual ? "text-rose-400" : "text-white/30"
                      )}
                    >
                      {r.actual || "(no output)"}
                    </pre>
                  </div>
                )}
                {r.stderr && (
                  <div className="flex gap-2">
                    <span className="w-16 shrink-0 text-white/30">error</span>
                    <pre className="whitespace-pre-wrap text-rose-400">{r.stderr}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}

        {!running && allPassed && (
          <div className="px-3 py-2 text-xs font-medium text-emerald-400/80">
            All test cases passed
          </div>
        )}
        {!running && someFailed && (
          <div className="px-3 py-2 text-xs text-rose-400/70">
            {total - passed} test case{total - passed !== 1 ? "s" : ""} failed
          </div>
        )}
      </div>
    </div>
  );
}
