"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Play, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStarterCode } from "@/lib/starter-code";
import { difficultyBadgeVariant } from "@/lib/tags";
import { CodeEditor } from "@/components/editor/code-editor";
import { AiPanel, type AiTab } from "@/components/practice/ai-panel";
import { ProblemSidebar } from "@/components/practice/problem-sidebar";
import { MarkdownContent } from "@/components/markdown-content";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import { apiFetch } from "@/lib/api";
import {
  streamChat,
  streamHint,
  streamReview,
  streamSolution,
  streamSurprise,
  streamTeach,
} from "@/lib/practice-api";
import { runCode, type RunResult } from "@/lib/execute-api";

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

export default function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [problemList, setProblemList] = useState<ProblemListItem[]>([]);
  const [code, setCode] = useState("");
  const [descOpen, setDescOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<AiTab>("review");
  const [review, setReview] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [hintCount, setHintCount] = useState(0);
  const [solution, setSolution] = useState("");
  const [teach, setTeach] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [solutionLevel, setSolutionLevel] = useState("beginner");
  const [explainStyle, setExplainStyle] = useState("simple");

  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);

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
        setCode(getStarterCode(p.language));
        setReview("");
        setHints([]);
        setHintCount(0);
        setSolution("");
        setTeach("");
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

  async function handleRun() {
    if (!problem || !code.trim()) return;
    setRunning(true);
    setOutputOpen(true);
    setRunResult(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await runCode(problem.language, code, token);
      setRunResult(result);
    } catch (err) {
      setRunResult({
        stdout: "",
        stderr: err instanceof Error ? err.message : "Execution failed",
        exit_code: 1,
        timed_out: false,
      });
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
    setAiPanelOpen(true);
    setActiveTab("review");

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

  async function handleTeach() {
    if (!problem) return;

    const codeLines = code.split("\n").filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("#") && !t.startsWith("--");
    });
    if (codeLines.length === 0) {
      setError("Write some code first — teach explains your actual implementation.");
      setAiPanelOpen(true);
      setActiveTab("teach");
      return;
    }

    const token = await getToken();
    if (!token) return;

    setStreaming(true);
    setTeach("");
    setAiPanelOpen(true);
    setActiveTab("teach");

    try {
      await streamTeach(problem.id, token, code, explainStyle, {
        onToken: (t) => setTeach((prev) => prev + t),
        onError: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teach failed");
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
          else if (payload.parse_error)
            setError(String(payload.parse_error));
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
          <aside className="flex w-60 shrink-0 flex-col border-r border-border/80 bg-sidebar p-2 gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </aside>
          <section className="flex flex-1 flex-col">
            <div className="h-28 shrink-0 border-b border-border/80 bg-card/60 px-5 py-4 space-y-2">
              <div className="h-3 w-48 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-80 max-w-full animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-64 max-w-full animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex-1 p-5">
              <div className="h-full animate-pulse rounded-xl bg-muted/30" />
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

      <div className="flex min-h-0 flex-1">
        <ProblemSidebar
          problems={problemList}
          currentId={problem.id}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />

        <section className="flex min-w-0 flex-1 flex-col bg-surface/50">
          {descOpen && (
            <div className="max-h-72 shrink-0 overflow-y-auto border-b border-border/80 bg-card/60 px-5 py-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Problem
                </h2>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setDescOpen(false)}
                >
                  Hide
                </button>
              </div>
              <MarkdownContent content={problem.description} />

              {problem.examples && problem.examples.length > 0 && (
                <div className="mt-4 space-y-3">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                      <p className="mb-1.5 font-semibold text-foreground/70">Example {i + 1}</p>
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
                          <p className="mt-1 font-sans text-muted-foreground">
                            <span className="font-medium">Explanation: </span>
                            {ex.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {problem.constraints && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Constraints
                  </p>
                  <MarkdownContent content={problem.constraints} />
                </div>
              )}
            </div>
          )}
          {!descOpen && (
            <button
              type="button"
              className="shrink-0 border-b border-border/80 bg-card/40 px-5 py-2 text-left text-xs font-medium text-primary hover:underline"
              onClick={() => setDescOpen(true)}
            >
              Show problem description
            </button>
          )}

          <div className="min-h-0 flex-1 p-4 md:p-5">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={problem.language}
              className="h-full min-h-[320px]"
            />
          </div>
        </section>

        {aiPanelOpen && (
          <section className="hidden w-[min(400px,36vw)] shrink-0 lg:flex lg:flex-col">
            <AiPanel
              activeTab={activeTab}
              onTabChange={setActiveTab}
              review={review}
              hints={hints}
              hintCount={hintCount}
              solution={solution}
              teach={teach}
              chatMessages={chatMessages}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              solutionLevel={solutionLevel}
              onSolutionLevelChange={setSolutionLevel}
              explainStyle={explainStyle}
              onExplainStyleChange={setExplainStyle}
              loading={streaming}
              xpEarned={xpEarned}
              onRequestHint={handleHint}
              onRequestSolution={handleSolution}
              onRequestTeach={handleTeach}
              onSendChat={handleChat}
              onClose={() => setAiPanelOpen(false)}
            />
          </section>
        )}
      </div>

      {aiPanelOpen && (
        <div className="flex h-[50vh] shrink-0 flex-col border-t border-border/80 lg:hidden">
          <AiPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            review={review}
            hints={hints}
            hintCount={hintCount}
            solution={solution}
            teach={teach}
            chatMessages={chatMessages}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            solutionLevel={solutionLevel}
            onSolutionLevelChange={setSolutionLevel}
            explainStyle={explainStyle}
            onExplainStyleChange={setExplainStyle}
            loading={streaming}
            onRequestHint={handleHint}
            onRequestSolution={handleSolution}
            onRequestTeach={handleTeach}
            onSendChat={handleChat}
            onClose={() => setAiPanelOpen(false)}
          />
        </div>
      )}

      <OutputPanel
        result={runResult}
        open={outputOpen}
        running={running}
        onClose={() => setOutputOpen(false)}
      />
    </main>
  );
}

function OutputPanel({
  result,
  open,
  running,
  onClose,
}: {
  result: RunResult | null;
  open: boolean;
  running: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="shrink-0 border-t border-border/80 bg-[oklch(0.15_0.03_275)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Output
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-white/40 hover:text-white/70"
        >
          ✕
        </button>
      </div>
      <div className="h-40 overflow-y-auto p-4 font-mono text-xs">
        {running && (
          <span className="text-white/40 animate-pulse">Running…</span>
        )}
        {!running && result?.timed_out && (
          <span className="text-amber-400">Execution timed out (10s limit).</span>
        )}
        {!running && result && !result.timed_out && (
          <>
            {result.stdout && (
              <pre className="whitespace-pre-wrap text-emerald-300">{result.stdout}</pre>
            )}
            {result.stderr && (
              <pre className="whitespace-pre-wrap text-rose-400">{result.stderr}</pre>
            )}
            {!result.stdout && !result.stderr && (
              <span className="text-white/40">(no output)</span>
            )}
            {result.exit_code !== null && result.exit_code !== 0 && (
              <p className="mt-2 text-white/40">
                Exit code: {result.exit_code}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
