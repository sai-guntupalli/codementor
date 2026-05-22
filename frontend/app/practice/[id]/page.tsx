"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  ListTodo,
  PanelLeftClose,
  Play,
  RotateCcw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStarterCode } from "@/lib/starter-code";
import { difficultyBadgeVariant } from "@/lib/tags";
import { CodeEditor } from "@/components/editor/code-editor";
import { AiPanel, type AiTab } from "@/components/practice/ai-panel";
import { NextProblemButton } from "@/components/practice/next-problem-button";
import { SolvedBanner } from "@/components/practice/solved-banner";
import { HintPopover } from "@/components/practice/hint-popover";
import { PracticePanel } from "@/components/practice/practice-panel";
import { ProblemDescription } from "@/components/practice/problem-description";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type LearningPathOut,
  type LearningPathProblem,
  type LearningPathProblemItem,
  type SolvedProblemIdsOut,
  type SubmissionOut,
} from "@/lib/api";
import {
  streamChat,
  streamCodeReview,
  streamHint,
  streamReview,
  streamSolution,
} from "@/lib/practice-api";
import {
  isRunnableExample,
  normalizeStdin,
  runCode,
  runTestCases,
  type RunResult,
  type TestCaseResult,
} from "@/lib/execute-api";
import { cn } from "@/lib/utils";
import { resolvePracticePathId } from "@/lib/learning-path-context";

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

type DescTab = "description" | "problems";

export default function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathFromUrl = searchParams.get("path");
  const [resolvedPathId, setResolvedPathId] = useState<string | null>(pathFromUrl);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [problemList, setProblemList] = useState<ProblemListItem[]>([]);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");
  const [descTab, setDescTab] = useState<DescTab>("description");
  const [mobileDescOpen, setMobileDescOpen] = useState(false);
  const [descMinimized, setDescMinimized] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const openAiPanel = useCallback(() => {
    setDescMinimized(true);
    setMobileDescOpen(false);
    setAiPanelOpen(true);
  }, []);

  const toggleAiPanel = useCallback(() => {
    setAiPanelOpen((open) => {
      if (!open) {
        setDescMinimized(true);
        setMobileDescOpen(false);
      }
      return !open;
    });
  }, []);

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
  const [runOnceResult, setRunOnceResult] = useState<RunResult | null>(null);
  const [runStdin, setRunStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [submissionScore, setSubmissionScore] = useState<number | null>(null);
  const [learningPath, setLearningPath] = useState<LearningPathProblem[]>([]);
  const [previousSubmission, setPreviousSubmission] = useState<SubmissionOut | null>(null);

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
        const pathId = await resolvePracticePathId(token, id, pathFromUrl);
        setResolvedPathId(pathId);

        const pathFetch = pathId
          ? apiFetch<LearningPathProblemItem[]>(
              `/learning-paths/${pathId}/problems`,
              { token }
            )
              .then((items) => ({ problems: items as LearningPathProblem[] }))
              .catch(() => ({ problems: [] as LearningPathProblem[] }))
          : apiFetch<LearningPathOut>("/users/me/learning-path", { token }).catch(() => ({
              problems: [] as LearningPathProblem[],
              next_problems: [] as LearningPathProblem[],
              message: "",
            }));

        const [p, list, solved, path] = await Promise.all([
          apiFetch<Problem>(`/problems/${id}`, { token }),
          apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token }),
          apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }).catch(
            () => ({ solved_ids: [] as string[] })
          ),
          pathFetch,
        ]);
        setProblem(p);
        setProblemList(list.items);
        setSolvedIds(new Set(solved.solved_ids));
        setLearningPath(path.problems);
        setDescMinimized(false);
        setMobileDescOpen(false);

        let latest: SubmissionOut | null = null;
        try {
          latest = await apiFetch<SubmissionOut>(`/submissions/me/by-problem/${id}`, {
            token,
          });
        } catch {
          // no prior submission for this problem
        }

        const draft = localStorage.getItem(`cm_code_${id}`);
        setPreviousSubmission(latest);

        if (latest) {
          setCode(draft ?? latest.code);
          if (latest.llm_review) {
            setReview(latest.llm_review);
            setReviewComplete(true);
            setSubmissionScore(latest.score);
            setActiveTab("review");
            setAiPanelOpen(true);
          } else {
            setReview("");
            setReviewComplete(false);
            setSubmissionScore(latest.score);
          }
        } else {
          setCode(draft ?? getStarterCode(p.language));
          setReview("");
          setReviewComplete(false);
          setSubmissionScore(null);
        }

        if (draft) {
          setDraftRestored(true);
          setTimeout(() => setDraftRestored(false), 3000);
        }
        setHints([]);
        setHintCount(0);
        setSolution("");
        setCodeReview("");
        setChatMessages([]);
        setXpEarned(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    load();
  }, [id, pathFromUrl, getToken]);

  const sidebarProblems = useMemo(() => {
    if (learningPath.length > 0) {
      return learningPath.map((p) => ({
        id: p.id,
        title: p.title,
        language: p.language,
        difficulty: p.difficulty,
      }));
    }
    return problemList;
  }, [learningPath, problemList]);

  useEffect(() => {
    if (!id || !code) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`cm_code_${id}`, code);
    }, 500);
    return () => clearTimeout(timer);
  }, [id, code]);

  function handleResetCode() {
    if (!problem) return;
    const starter = getStarterCode(problem.language);
    if (code !== starter && !window.confirm("Reset editor to starter code? Your current draft will be lost.")) {
      return;
    }
    setCode(starter);
    if (id) localStorage.removeItem(`cm_code_${id}`);
  }

  function defaultStdinFromExamples(): string {
    if (!problem) return "";
    const first = problem.examples.find((ex) => isRunnableExample(ex.input));
    return first ? first.input : "";
  }

  async function handleRun() {
    if (!problem || !code.trim()) return;
    setRunning(true);
    setOutputOpen(true);
    setTestResults([]);
    setRunOnceResult(null);
    if (!runStdin.trim()) setRunStdin(defaultStdinFromExamples());
    try {
      const token = await getToken();
      if (!token) return;
      const results = await runTestCases(problem.language, code, token, problem.examples);
      setTestResults(results);
    } finally {
      setRunning(false);
    }
  }

  async function handleRunWithStdin() {
    if (!problem || !code.trim()) return;
    setRunning(true);
    setOutputOpen(true);
    setTestResults([]);
    setRunOnceResult(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await runCode(
        problem.language,
        code,
        token,
        normalizeStdin(runStdin)
      );
      setRunOnceResult(result);
    } catch (err) {
      setRunOnceResult({
        stdout: "",
        stderr: err instanceof Error ? err.message : "Execution failed",
        exit_code: 1,
        timed_out: false,
      });
    } finally {
      setRunning(false);
    }
  }

  const isPreviouslySolved =
    previousSubmission !== null || (problem != null && solvedIds.has(problem.id));

  const showRestoreSubmission = useMemo(() => {
    if (!previousSubmission) return false;
    return code.trim() !== previousSubmission.code.trim();
  }, [previousSubmission, code]);

  const submissionPassed = submissionScore !== null && submissionScore >= 0.9;

  const showSolvedBanner =
    previousSubmission != null &&
    (reviewComplete || Boolean(previousSubmission.llm_review));

  function restoreLastSubmission() {
    if (!previousSubmission || !id) return;
    setCode(previousSubmission.code);
    localStorage.removeItem(`cm_code_${id}`);
    setDraftRestored(false);
    if (previousSubmission.llm_review) {
      setReview(previousSubmission.llm_review);
      setReviewComplete(true);
      setSubmissionScore(previousSubmission.score);
      openAiPanel();
      setActiveTab("review");
    }
  }

  const nextProblem = useMemo(() => {
    if (!problem) return null;
    const pathIdx = learningPath.findIndex((p) => p.id === problem.id);
    if (pathIdx >= 0) {
      for (let i = pathIdx + 1; i < learningPath.length; i++) {
        if (!solvedIds.has(learningPath[i].id)) {
          return { id: learningPath[i].id, title: learningPath[i].title };
        }
      }
      if (pathIdx + 1 < learningPath.length) {
        const next = learningPath[pathIdx + 1];
        return { id: next.id, title: next.title };
      }
      return null;
    }
    if (resolvedPathId && learningPath.length > 0) {
      return null;
    }
    const listIdx = problemList.findIndex((p) => p.id === problem.id);
    for (let i = listIdx + 1; i < problemList.length; i++) {
      if (!solvedIds.has(problemList[i].id)) {
        return { id: problemList[i].id, title: problemList[i].title };
      }
    }
    return null;
  }, [problem, learningPath, problemList, solvedIds, resolvedPathId]);

  const showNextProblem = !!nextProblem && (submissionPassed || isPreviouslySolved);

  const showSkip = !!nextProblem && !showNextProblem;

  const isReviewing = streaming && activeTab === "review";

  async function handleSubmit() {
    if (!problem || isReviewing) return;
    setError(null);
    setStreaming(true);
    setReview("");
    setXpEarned(null);
    setReviewComplete(false);
    setSubmissionScore(null);
    openAiPanel();
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
      setPreviousSubmission(submission);

      let reviewText = "";
      await streamReview(submission.id, token, {
        onToken: (t) => {
          reviewText += t;
          setReview((prev) => prev + t);
        },
        onDone: (payload) => {
          const xp = payload.xp_earned;
          if (typeof xp === "number" && xp > 0) setXpEarned(xp);
          const score = payload.score;
          if (typeof score === "number") setSubmissionScore(score);
          setReviewComplete(true);
          setSolvedIds((prev) => new Set([...prev, problem.id]));
          setPreviousSubmission({
            ...submission,
            code,
            llm_review: reviewText,
            score: typeof score === "number" ? score : submission.score,
          });
          if (id) localStorage.removeItem(`cm_code_${id}`);
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
    openAiPanel();
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
    openAiPanel();
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
    openAiPanel();
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.isContentEditable) return;

      e.preventDefault();
      if (e.shiftKey) {
        if (!streaming) void handleSubmit();
      } else if (problem?.language === "python" && !running && !streaming) {
        void handleRun();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers recreated each render
  }, [problem, running, streaming]);

  if (loading) {
    return (
      <main className="workspace-canvas flex h-screen flex-col">
        <AppHeader className="border-border/60 bg-card shadow-header" />
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          <PracticePanel className="hidden w-[min(380px,32vw)] shrink-0 lg:flex">
            <div className="flex border-b border-border/50 p-1">
              <div className="m-1 h-8 w-24 animate-pulse rounded-lg bg-muted/50" />
              <div className="m-1 h-8 w-20 animate-pulse rounded-lg bg-muted/30" />
            </div>
            <div className="space-y-3 p-5">
              <div className="h-6 w-48 animate-pulse rounded-lg bg-muted/50" />
              <div className="flex gap-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted/40" />
                <div className="h-5 w-12 animate-pulse rounded-full bg-muted/40" />
              </div>
              <div className="mt-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-3 animate-pulse rounded-full bg-muted/35"
                    style={{ width: `${75 + i * 5}%` }}
                  />
                ))}
              </div>
            </div>
          </PracticePanel>
          <PracticePanel className="min-w-0 flex-1">
            <div className="border-b border-border/50 px-4 py-3">
              <div className="h-4 w-20 animate-pulse rounded-full bg-muted/40" />
            </div>
            <div className="flex-1 p-4">
              <div className="h-full min-h-[200px] animate-pulse rounded-xl bg-muted/25" />
            </div>
          </PracticePanel>
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
    <main className="workspace-canvas flex h-screen flex-col">
      <AppHeader
        className="z-10 border-border/50 bg-card shadow-header"
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
              title={
                problem.language !== "python"
                  ? "Run is only available for Python"
                  : "Run tests (⌘/Ctrl+Enter)"
              }
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
              variant={reviewComplete ? "outline" : "default"}
              disabled={isReviewing}
              onClick={handleSubmit}
              title={
                reviewComplete
                  ? "Submit your updated code for another AI review"
                  : "Submit for AI review (⌘/Ctrl+Shift+Enter)"
              }
              className={cn(!reviewComplete && "shadow-sm")}
            >
              {isReviewing
                ? "Reviewing…"
                : reviewComplete
                  ? submissionPassed
                    ? "Submit again"
                    : "Resubmit"
                  : "Submit code"}
            </Button>
            <Button
              size="sm"
              variant={aiPanelOpen ? "secondary" : "outline"}
              onClick={toggleAiPanel}
            >
              <Sparkles className="mr-1.5 size-3.5" />
              {aiPanelOpen ? "Hide AI" : "AI"}
            </Button>
            {showSkip && (
              <NextProblemButton
                next={nextProblem}
                pathId={resolvedPathId}
                variant="outline"
                label="Skip"
                title="Next problem without submitting"
              />
            )}
            {showNextProblem && (
              <NextProblemButton next={nextProblem} pathId={resolvedPathId} />
            )}
          </>
        }
      />

      {error && (
        <div className="shrink-0 px-3 pt-2">
          <p className="sub-card rounded-xl border-destructive/25 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-sm">
            {error}
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
        {/* Mobile: stacked cards */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:hidden">
          <PracticePanel className="shrink-0">
            <button
              type="button"
              onClick={() => setMobileDescOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                {problem.title}
              </span>
              {mobileDescOpen ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </button>
            {mobileDescOpen && (
              <div className="max-h-[40vh] overflow-y-auto border-t border-border/50 px-4 py-3">
                <ProblemDescription problem={problem} showTitle={false} compact />
              </div>
            )}
          </PracticePanel>

          <PracticePanel className="min-h-0 flex-1">
            <EditorColumn
              problem={problem}
              code={code}
              onCodeChange={setCode}
              onReset={handleResetCode}
              canRun={problem.language === "python"}
              hints={hints}
              hintCount={hintCount}
              hintLoading={streaming}
              onRequestHint={handleHint}
              outputOpen={outputOpen}
              testResults={testResults}
              runOnceResult={runOnceResult}
              runStdin={runStdin}
              onRunStdinChange={setRunStdin}
              onRunWithStdin={handleRunWithStdin}
              running={running}
              onOutputClose={() => setOutputOpen(false)}
              previousSubmission={previousSubmission}
              showSolvedBanner={showSolvedBanner}
              showRestoreSubmission={showRestoreSubmission}
              onRestoreSubmission={restoreLastSubmission}
            />
          </PracticePanel>

          {aiPanelOpen && (
            <PracticePanel className="h-[min(50vh,420px)] shrink-0">
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
                submissionScore={submissionScore}
                onRequestHint={handleHint}
                onRequestSolution={handleSolution}
                onRequestCodeReview={handleCodeReview}
                onSendChat={handleChat}
                reviewComplete={reviewComplete}
                onClose={() => setAiPanelOpen(false)}
              />
            </PracticePanel>
          )}
        </div>

        {/* Desktop: side-by-side elevated cards */}
        <div className="hidden min-h-0 flex-1 gap-3 lg:flex">
          {descMinimized ? (
            <PracticePanel className="w-11 shrink-0">
              <button
                type="button"
                onClick={() => setDescMinimized(false)}
                className="flex h-full w-full flex-col items-center gap-3 py-4 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                title="Expand problem statement"
              >
                <ChevronRight className="size-4" />
                <FileText className="size-4 shrink-0 text-primary/70" />
                <span
                  className="text-[10px] font-medium leading-none [writing-mode:vertical-rl]"
                  style={{ textOrientation: "mixed" }}
                >
                  Problem
                </span>
              </button>
            </PracticePanel>
          ) : (
            <PracticePanel className="w-[min(380px,32vw)] shrink-0">
              <DescriptionPanel
                problem={problem}
                descTab={descTab}
                onDescTabChange={setDescTab}
                problemList={sidebarProblems}
                currentId={problem.id}
                solvedIds={solvedIds}
                pathId={resolvedPathId}
                onMinimize={() => setDescMinimized(true)}
              />
            </PracticePanel>
          )}

          <PracticePanel className="min-w-0 flex-1">
            <EditorColumn
              problem={problem}
              code={code}
              onCodeChange={setCode}
              onReset={handleResetCode}
              canRun={problem.language === "python"}
              hints={hints}
              hintCount={hintCount}
              hintLoading={streaming}
              onRequestHint={handleHint}
              outputOpen={outputOpen}
              testResults={testResults}
              runOnceResult={runOnceResult}
              runStdin={runStdin}
              onRunStdinChange={setRunStdin}
              onRunWithStdin={handleRunWithStdin}
              running={running}
              onOutputClose={() => setOutputOpen(false)}
              previousSubmission={previousSubmission}
              showSolvedBanner={showSolvedBanner}
              showRestoreSubmission={showRestoreSubmission}
              onRestoreSubmission={restoreLastSubmission}
            />
          </PracticePanel>

          {aiPanelOpen && (
            <PracticePanel className="w-[min(400px,34vw)] shrink-0">
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
                submissionScore={submissionScore}
                onRequestHint={handleHint}
                onRequestSolution={handleSolution}
                onRequestCodeReview={handleCodeReview}
                onSendChat={handleChat}
                reviewComplete={reviewComplete}
                onClose={() => setAiPanelOpen(false)}
              />
            </PracticePanel>
          )}
        </div>
      </div>

    </main>
  );
}

function DescriptionPanel({
  problem,
  descTab,
  onDescTabChange,
  problemList,
  currentId,
  solvedIds,
  pathId,
  onMinimize,
}: {
  problem: Problem;
  descTab: DescTab;
  onDescTabChange: (tab: DescTab) => void;
  problemList: ProblemListItem[];
  currentId: string;
  solvedIds: Set<string>;
  pathId?: string | null;
  onMinimize: () => void;
}) {
  function practiceHref(problemId: string) {
    const base = `/practice/${problemId}`;
    return pathId ? `${base}?path=${encodeURIComponent(pathId)}` : base;
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b border-border/50 bg-muted/30 p-1.5">
        <div className="flex min-w-0 flex-1 gap-1">
          <button
            type="button"
            onClick={() => onDescTabChange("description")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
              descTab === "description"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <FileText className="size-3.5" />
            Description
          </button>
          <button
            type="button"
            onClick={() => onDescTabChange("problems")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
              descTab === "problems"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <ListTodo className="size-3.5" />
            {pathId ? "Path" : "Problems"}
          </button>
        </div>
        <button
          type="button"
          onClick={onMinimize}
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card/80 hover:text-foreground"
          title="Minimize problem statement"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
        {descTab === "description" ? (
          <div className="p-5">
            <ProblemDescription problem={problem} />
          </div>
        ) : (
          <nav className="p-2">
            {problemList.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {pathId ? "No problems in this path yet." : "No problems to show."}
              </p>
            ) : (
            <ul className="space-y-1">
              {problemList.map((p) => (
                <li key={p.id}>
                  <Link
                    href={practiceHref(p.id)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-all",
                      p.id === currentId
                        ? "border-l-primary bg-primary/10 text-foreground shadow-sm"
                        : "border-l-transparent text-foreground/80 hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    {solvedIds.has(p.id) && (
                      <CheckCircle2
                        className="mt-0.5 size-3.5 shrink-0 text-emerald-500"
                        aria-label="Solved"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="line-clamp-2 block font-medium leading-snug">{p.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {p.language} · {p.difficulty}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            )}
            <Link
              href={pathId ? `/learn/${pathId}` : "/problems"}
              className="sub-card mt-3 block rounded-lg px-3 py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-primary/5"
            >
              {pathId ? "Back to learning path →" : "Browse all problems →"}
            </Link>
          </nav>
        )}
        </div>
      </div>
    </>
  );
}

function EditorColumn({
  problem,
  code,
  onCodeChange,
  onReset,
  canRun,
  hints,
  hintCount,
  hintLoading,
  onRequestHint,
  outputOpen,
  testResults,
  runOnceResult,
  runStdin,
  onRunStdinChange,
  onRunWithStdin,
  running,
  onOutputClose,
  previousSubmission,
  showSolvedBanner,
  showRestoreSubmission,
  onRestoreSubmission,
}: {
  problem: { language: string };
  code: string;
  onCodeChange: (v: string) => void;
  onReset: () => void;
  canRun: boolean;
  hints: string[];
  hintCount: number;
  hintLoading: boolean;
  onRequestHint: (n: number) => void;
  outputOpen: boolean;
  testResults: TestCaseResult[];
  runOnceResult: RunResult | null;
  runStdin: string;
  onRunStdinChange: (v: string) => void;
  onRunWithStdin: () => void;
  running: boolean;
  onOutputClose: () => void;
  previousSubmission?: SubmissionOut | null;
  showSolvedBanner?: boolean;
  showRestoreSubmission?: boolean;
  onRestoreSubmission?: () => void;
}) {
  const lineCount = code.split("\n").length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {showSolvedBanner && previousSubmission && (
        <SolvedBanner
          score={previousSubmission.score}
          submittedAt={previousSubmission.created_at}
          hasDraft={showRestoreSubmission}
          onRestoreSubmission={onRestoreSubmission}
        />
      )}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-muted/25 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-medium capitalize shadow-sm">
            {problem.language}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] text-muted-foreground/70 sm:inline">
            {canRun ? "⌘↵ run · ⌘⇧↵ submit" : "⌘⇧↵ submit"}
          </span>
          <HintPopover
            hints={hints}
            hintCount={hintCount}
            loading={hintLoading}
            onRequestHint={onRequestHint}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={onReset}
          >
            <RotateCcw className="size-3" />
            Reset
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <CodeEditor
          value={code}
          onChange={onCodeChange}
          language={problem.language}
          className="h-full"
        />
      </div>

      <OutputPanel
        results={testResults}
        runOnceResult={runOnceResult}
        runStdin={runStdin}
        onRunStdinChange={onRunStdinChange}
        onRunWithStdin={onRunWithStdin}
        open={outputOpen}
        running={running}
        onClose={onOutputClose}
      />
    </div>
  );
}

function OutputPanel({
  results,
  runOnceResult,
  runStdin,
  onRunStdinChange,
  onRunWithStdin,
  open,
  running,
  onClose,
}: {
  results: TestCaseResult[];
  runOnceResult: RunResult | null;
  runStdin: string;
  onRunStdinChange: (v: string) => void;
  onRunWithStdin: () => void;
  open: boolean;
  running: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const allPassed = total > 0 && passed === total;
  const someFailed = total > 0 && passed < total;
  const showRunOnce = runOnceResult && results.length === 0;

  return (
    <div className="shrink-0 px-4 pb-4">
      <div className="overflow-hidden rounded-xl border border-border/50 bg-[oklch(0.13_0.025_275)] shadow-card">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-white/30" />
          <span className="text-xs font-medium uppercase tracking-wider text-white/40">
            Output
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

      <div className="border-b border-white/8 px-3 py-2.5">
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/35">
          Test input
        </label>
        <p className="mb-1.5 text-[10px] leading-snug text-white/30">
          Script: one value per line for <code className="text-white/50">input()</code>.
          Function: a Python literal like <code className="text-white/50">[1, 2, 3]</code> is
          passed to your last <code className="text-white/50">def</code> automatically.
        </p>
        <textarea
          value={runStdin}
          onChange={(e) => onRunStdinChange(e.target.value)}
          rows={3}
          placeholder={"[1, 2, 3] or one line per input(), e.g.\n4\n5"}
          className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 font-mono text-xs text-white/80 placeholder:text-white/25 focus:border-primary/40 focus:outline-none"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 h-7 w-full text-xs"
          disabled={running}
          onClick={onRunWithStdin}
        >
          {running ? "Running…" : "Run with this input"}
        </Button>
      </div>

      <div className="max-h-[min(40vh,280px)] overflow-y-auto">
        {running && (
          <div className="px-3 py-3">
            <span className="animate-pulse text-xs text-white/40">Running…</span>
          </div>
        )}

        {!running && showRunOnce && runOnceResult && (
          <div className="space-y-2 px-3 py-3 font-mono text-xs">
            {runOnceResult.harnessed && (
              <p className="font-sans text-[10px] text-primary/80">
                Called your function with the test input; printed its return value.
              </p>
            )}
            {runOnceResult.timed_out && (
              <p className="text-amber-400">Timed out (check input() or infinite loop)</p>
            )}
            {runOnceResult.stdout && (
              <div>
                <span className="text-white/35">stdout</span>
                <pre className="mt-1 whitespace-pre-wrap text-white/75">{runOnceResult.stdout}</pre>
              </div>
            )}
            {runOnceResult.stderr && (
              <div>
                <span className="text-white/35">stderr</span>
                <pre className="mt-1 whitespace-pre-wrap text-rose-400">{runOnceResult.stderr}</pre>
              </div>
            )}
            {!runOnceResult.stdout && !runOnceResult.stderr && !runOnceResult.timed_out && (
              <span className="text-white/30">(no output)</span>
            )}
          </div>
        )}

        {!running && results.length === 0 && !showRunOnce && (
          <div className="px-3 py-3">
            <span className="text-xs text-white/30">
              Use Run (header) for test cases, or Run with this input above.
            </span>
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
                    <pre className="whitespace-pre-wrap text-white/60">{r.input}</pre>
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
    </div>
  );
}
