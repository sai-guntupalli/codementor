"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  RotateCcw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppShell } from "@/components/layout/app-shell";
import { NotFoundView } from "@/components/layout/not-found-view";
import { PracticeHeader } from "@/components/practice/practice-header";
import { NextProblemButton } from "@/components/practice/next-problem-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStarterCode } from "@/lib/starter-code";
import { CodeEditor } from "@/components/editor/code-editor";
import { AiPanel, type AiTab } from "@/components/practice/ai-panel";
import { EditorToolbarActions } from "@/components/practice/editor-toolbar-actions";
import { SolvedBanner } from "@/components/practice/solved-banner";
import { HintPopover } from "@/components/practice/hint-popover";
import { PracticePanel } from "@/components/practice/practice-panel";
import { ProblemDescription } from "@/components/practice/problem-description";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type LearningPathListItem,
  type LearningPathProblem,
  type LearningPathProblemItem,
  type SolvedProblemIdsOut,
  type SubmissionOut,
  type UsageOut,
  type UserOut,
} from "@/lib/api";
import { pickActiveLearningPath } from "@/lib/learning-path-utils";
import {
  streamChat,
  streamCodeReview,
  streamHint,
  streamReview,
  streamSolution,
  verifySubmission,
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
import {
  recordActiveLearningPath,
  recordPracticeActivity,
  resolvePracticePathId,
} from "@/lib/learning-path-context";
import { getCached, setCached } from "@/lib/api-cache";

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
  starter_code?: string | null;
  entry_function?: string | null;
  test_call?: string | null;
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
  const [usage, setUsage] = useState<UsageOut | null>(null);
  const [quotaToast, setQuotaToast] = useState<string | null>(null);
  const [aiSubmitReview, setAiSubmitReview] = useState(false);

  const tokenRef = useRef<string | null>(null);

  const quotaExhausted =
    usage !== null && usage.calls_limit > 0 && usage.calls_used >= usage.calls_limit;

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const token = await getValidatedAccessToken(supabase);
    if (!token) {
      router.replace("/login");
      return null;
    }
    return token;
  }, [router]);

  const refreshUsage = useCallback(async () => {
    const token = tokenRef.current ?? (await getToken());
    if (!token) return;
    try {
      const data = await apiFetch<UsageOut>("/users/me/usage", { token });
      setUsage(data);
    } catch {
      // non-fatal
    }
  }, [getToken]);

  const handleStreamDone = useCallback(
    (payload: Record<string, unknown>) => {
      if (payload.quota_warning === true) {
        const key = "cm_quota_warn_shown";
        if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          setQuotaToast("You've used 80% of your monthly AI calls.");
        }
      }
      void refreshUsage();
    },
    [refreshUsage]
  );

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token || !id) return;
      tokenRef.current = token;
      try {
        const pathId = await resolvePracticePathId(token, id, pathFromUrl);
        setResolvedPathId(pathId);
        if (pathId) recordActiveLearningPath(pathId, token, id);
        else recordPracticeActivity(id, token);

        const fetchPathProblems = async (pid: string): Promise<LearningPathProblemItem[]> => {
          const k = `learning-paths/${pid}/problems`;
          const cached = getCached<LearningPathProblemItem[]>(k, token);
          if (cached) return cached;
          const items = await apiFetch<LearningPathProblemItem[]>(
            `/learning-paths/${pid}/problems`,
            { token }
          );
          setCached(k, token, items);
          return items;
        };

        const fetchLearningPaths = async (): Promise<LearningPathListItem[]> => {
          const k = "learning-paths";
          const cached = getCached<LearningPathListItem[]>(k, token);
          if (cached) return cached;
          const data = await apiFetch<LearningPathListItem[]>("/learning-paths", { token });
          setCached(k, token, data);
          return data;
        };

        const pathFetch: Promise<{ problems: LearningPathProblem[]; resolvedId?: string }> = pathId
          ? fetchPathProblems(pathId)
              .then((items) => ({ problems: items as LearningPathProblem[], resolvedId: pathId }))
              .catch(() => ({ problems: [] as LearningPathProblem[] }))
          : fetchLearningPaths()
              .then(async (paths) => {
                const active = pickActiveLearningPath(paths);
                if (!active) return { problems: [] as LearningPathProblem[] };
                const items = await fetchPathProblems(active.id).catch(
                  () => [] as LearningPathProblemItem[]
                );
                return { problems: items as LearningPathProblem[], resolvedId: active.id };
              })
              .catch(() => ({ problems: [] as LearningPathProblem[] }));

        const listFetch = pathId
          ? Promise.resolve({ items: [] as ProblemListItem[] })
          : apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token }).catch(
              () => ({ items: [] as ProblemListItem[] })
            );

        const [p, list, solved, path, usageData, me] = await Promise.all([
          apiFetch<Problem>(`/problems/${id}`, { token }),
          listFetch,
          apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }).catch(
            () => ({ solved_ids: [] as string[] })
          ),
          pathFetch,
          apiFetch<UsageOut>("/users/me/usage", { token }).catch(() => null),
          apiFetch<UserOut>("/users/me", { token }).catch(() => null),
        ]);
        if (usageData) setUsage(usageData);
        setAiSubmitReview(me?.ai_submit_review ?? false);
        setProblem(p);
        setProblemList(list.items);
        setSolvedIds(new Set(solved.solved_ids));
        setLearningPath(path.problems);
        if (path.resolvedId && !pathId) {
          setResolvedPathId(path.resolvedId);
        }
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
          setCode(
            draft ??
              p.starter_code ??
              getStarterCode(p.language, {
                examples: p.examples,
                description: p.description,
                constraints: p.constraints,
              })
          );
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
    const starter =
      problem.starter_code ??
      getStarterCode(problem.language, {
        examples: problem.examples,
        description: problem.description,
        constraints: problem.constraints,
      });
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
      const token = tokenRef.current ?? await getToken();
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
      const token = tokenRef.current ?? await getToken();
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

  useEffect(() => {
    if (!quotaToast) return;
    const t = setTimeout(() => setQuotaToast(null), 8000);
    return () => clearTimeout(t);
  }, [quotaToast]);

  async function handleSubmit() {
    if (!problem || isReviewing) return;
    if (aiSubmitReview && quotaExhausted) {
      setError("Monthly AI call limit reached. See Settings for usage.");
      return;
    }
    setError(null);
    setStreaming(true);
    setReview("");
    setXpEarned(null);
    setReviewComplete(false);
    setSubmissionScore(null);
    openAiPanel();
    setActiveTab("review");
    setOutputOpen(true);

    const token = tokenRef.current ?? await getToken();
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

      if (aiSubmitReview) {
        let reviewText = "";
        await streamReview(submission.id, token, {
          onToken: (t) => {
            reviewText += t;
            setReview((prev) => prev + t);
          },
          onDone: (payload) => {
            handleStreamDone(payload);
            const xp = payload.xp_earned;
            if (typeof xp === "number" && xp > 0) setXpEarned(xp);
            const score = payload.score;
            if (typeof score === "number") setSubmissionScore(score);
            setReviewComplete(true);
            if (typeof score === "number" && score >= 0.9) {
              setSolvedIds((prev) => new Set([...prev, problem.id]));
            }
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
      } else {
        const verified = await verifySubmission(submission.id, token);
        setReview(verified.summary);
        setTestResults(verified.results);
        setSubmissionScore(verified.score);
        if (verified.xp_earned > 0) setXpEarned(verified.xp_earned);
        setReviewComplete(verified.all_passed || verified.score >= 0.9);
        if (verified.all_passed || verified.score >= 0.9) {
          setSolvedIds((prev) => new Set([...prev, problem.id]));
        }
        setPreviousSubmission({
          ...submission,
          code,
          llm_review: verified.summary,
          score: verified.score,
        });
        if (id) localStorage.removeItem(`cm_code_${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setStreaming(false);
    }
  }

  async function handleHint(n: number) {
    if (!problem || hintCount >= n) return;
    if (quotaExhausted) {
      setError("Monthly AI call limit reached. See Settings for usage.");
      return;
    }
    const token = tokenRef.current ?? await getToken();
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
        onDone: handleStreamDone,
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
    if (quotaExhausted) {
      setError("Monthly AI call limit reached. See Settings for usage.");
      return;
    }
    const token = tokenRef.current ?? await getToken();
    if (!token) return;

    setStreaming(true);
    setSolution("");
    openAiPanel();
    setActiveTab("solution");

    try {
      await streamSolution(problem.id, token, solutionLevel, {
        onToken: (t) => setSolution((prev) => prev + t),
        onDone: handleStreamDone,
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
    if (quotaExhausted) {
      setError("Monthly AI call limit reached. See Settings for usage.");
      return;
    }
    const token = tokenRef.current ?? await getToken();
    if (!token) return;

    setStreaming(true);
    setCodeReview("");
    openAiPanel();
    setActiveTab("code-review");

    try {
      await streamCodeReview(problem.id, token, code, {
        onToken: (t) => setCodeReview((prev) => prev + t),
        onDone: handleStreamDone,
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
    if (quotaExhausted) {
      setError("Monthly AI call limit reached. See Settings for usage.");
      return;
    }
    const token = tokenRef.current ?? await getToken();
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
        onDone: handleStreamDone,
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
        <AppHeader />
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          <PracticePanel className="hidden w-[min(380px,32vw)] shrink-0 lg:flex">
            <div className="flex border-b border-white/10 p-1">
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
            <div className="border-b border-white/10 px-4 py-3">
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
    const isNotFound = !error || /not found/i.test(error);
    if (isNotFound) {
      return (
        <AppShell>
          <NotFoundView variant="problem" />
        </AppShell>
      );
    }
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Link href="/problems" className="mt-4 inline-block text-sm font-medium text-primary">
            ← Back to problems
          </Link>
        </div>
      </AppShell>
    );
  }

  const canRunPython = problem.language === "python";
  const submitDisabled =
    isReviewing ||
    (aiSubmitReview && quotaExhausted) ||
    (!aiSubmitReview && !canRunPython);
  const submitTitle = aiSubmitReview
    ? reviewComplete
      ? "Submit your updated code for another AI review"
      : "Submit for AI review (⌘/Ctrl+Shift+Enter)"
    : !canRunPython
      ? "Automatic verify is only available for Python"
      : reviewComplete
        ? "Run tests again on your latest code"
        : "Check output against examples (⌘/Ctrl+Shift+Enter)";

  return (
    <main className="workspace-canvas flex h-screen flex-col">
      <PracticeHeader
        title={problem.title}
        language={problem.language}
        difficulty={problem.difficulty}
        draftRestored={draftRestored}
        usage={usage}
        showAiUsage={aiSubmitReview && usage !== null}
        actions={
          <>
            {showSkip && (
              <NextProblemButton
                next={nextProblem}
                pathId={resolvedPathId}
                variant="outline"
                label="Skip"
                className="hidden h-8 md:inline-flex"
                title="Next problem without submitting"
              />
            )}
            {showNextProblem && (
              <NextProblemButton
                next={nextProblem}
                pathId={resolvedPathId}
                className="h-8"
              />
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
              <div className="max-h-[40vh] overflow-y-auto border-t border-white/10 px-4 py-3">
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
              onRun={handleRun}
              onSubmit={handleSubmit}
              canRun={canRunPython}
              running={running}
              streaming={streaming}
              isReviewing={isReviewing}
              submitDisabled={submitDisabled}
              submitTitle={submitTitle}
              reviewComplete={reviewComplete}
              submissionPassed={submissionPassed}
              aiSubmitReview={aiSubmitReview}
              aiPanelOpen={aiPanelOpen}
              onToggleAiPanel={toggleAiPanel}
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
                quotaExhausted={quotaExhausted}
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
              onRun={handleRun}
              onSubmit={handleSubmit}
              canRun={canRunPython}
              running={running}
              streaming={streaming}
              isReviewing={isReviewing}
              submitDisabled={submitDisabled}
              submitTitle={submitTitle}
              reviewComplete={reviewComplete}
              submissionPassed={submissionPassed}
              aiSubmitReview={aiSubmitReview}
              aiPanelOpen={aiPanelOpen}
              onToggleAiPanel={toggleAiPanel}
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
                quotaExhausted={quotaExhausted}
                onClose={() => setAiPanelOpen(false)}
              />
            </PracticePanel>
          )}
        </div>
      </div>

      {quotaToast && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4">
          <div className="pointer-events-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-card px-4 py-3 text-sm shadow-lg">
            <span>{quotaToast}</span>
            <Link href="/settings" className="shrink-0 font-medium text-primary hover:underline">
              Upgrade to Pro →
            </Link>
          </div>
        </div>
      )}

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
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-white/5 p-1.5">
        <div className="flex min-w-0 flex-1 gap-1">
          <button
            type="button"
            onClick={() => onDescTabChange("description")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
              descTab === "description"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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

type EditorColumnProps = {
  problem: { language: string };
  code: string;
  onCodeChange: (v: string) => void;
  onReset: () => void;
  onRun: () => void;
  onSubmit: () => void;
  canRun: boolean;
  running: boolean;
  streaming: boolean;
  isReviewing: boolean;
  submitDisabled: boolean;
  submitTitle: string;
  reviewComplete: boolean;
  submissionPassed: boolean;
  aiSubmitReview: boolean;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
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
  onOutputClose: () => void;
  previousSubmission?: SubmissionOut | null;
  showSolvedBanner?: boolean;
  showRestoreSubmission?: boolean;
  onRestoreSubmission?: () => void;
};

function EditorColumn({
  problem,
  code,
  onCodeChange,
  onReset,
  onRun,
  onSubmit,
  canRun,
  running,
  streaming,
  isReviewing,
  submitDisabled,
  submitTitle,
  reviewComplete,
  submissionPassed,
  aiSubmitReview,
  aiPanelOpen,
  onToggleAiPanel,
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
  onOutputClose,
  previousSubmission,
  showSolvedBanner,
  showRestoreSubmission,
  onRestoreSubmission,
}: EditorColumnProps) {
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
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-2.5">
        <Badge variant="secondary" className="text-xs font-medium capitalize shadow-sm">
          {problem.language}
        </Badge>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <HintPopover
            hints={hints}
            hintCount={hintCount}
            loading={hintLoading}
            onRequestHint={onRequestHint}
          />
          <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
          <Button
            type="button"
            size="sm"
            variant={aiPanelOpen ? "secondary" : "outline"}
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={onToggleAiPanel}
            title={aiPanelOpen ? "Hide AI panel" : "Show AI panel"}
          >
            <Sparkles className="size-3" />
            <span className="hidden sm:inline">{aiPanelOpen ? "Hide AI" : "AI"}</span>
          </Button>
          <EditorToolbarActions
            canRun={canRun}
            running={running}
            streaming={streaming}
            onRun={onRun}
            onSubmit={onSubmit}
            isReviewing={isReviewing}
            submitDisabled={submitDisabled}
            reviewComplete={reviewComplete}
            submissionPassed={submissionPassed}
            aiSubmitReview={aiSubmitReview}
            submitTitle={submitTitle}
          />
          <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onReset}
            title="Reset editor to starter code"
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
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#060e20] shadow-card">
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
          Function: use a literal like <code className="text-white/50">[1, 2, 3]</code>, or paste
          an example call like <code className="text-white/50">fn([1, 2], &quot;x&quot;)</code>.
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
          <div className="px-3 py-3 text-xs text-white/40">
            <p>Use Run in the toolbar for example tests.</p>
            <p className="mt-1">Or use Run with this input for a custom trial.</p>
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
