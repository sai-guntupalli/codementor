"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
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

type Problem = {
  id: string;
  title: string;
  description: string;
  language: string;
  difficulty: string;
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
          apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=50", { token }),
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
      <main className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
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
            <div className="max-h-44 shrink-0 overflow-y-auto border-b border-border/80 bg-card/60 px-5 py-4 backdrop-blur-sm">
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
    </main>
  );
}
