"use client";

import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { cn } from "@/lib/utils";
import { Loader2, PanelRightClose, Sparkles, Zap } from "lucide-react";

export type AiTab = "review" | "hints" | "solution" | "teach" | "chat";

const TABS: { id: AiTab; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "hints", label: "Hints" },
  { id: "solution", label: "Solution" },
  { id: "teach", label: "Teach" },
  { id: "chat", label: "Chat" },
];

const SOLUTION_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "learner", label: "Learner" },
  { value: "industry_standard", label: "Industry" },
  { value: "interview_ready", label: "Interview" },
] as const;

type ChatMessage = { role: "user" | "assistant"; content: string };

type AiPanelProps = {
  activeTab: AiTab;
  onTabChange: (tab: AiTab) => void;
  review: string;
  hints: string[];
  hintCount: number;
  solution: string;
  teach: string;
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  solutionLevel: string;
  onSolutionLevelChange: (v: string) => void;
  explainStyle: string;
  onExplainStyleChange: (v: string) => void;
  loading: boolean;
  xpEarned?: number | null;
  onRequestHint: (n: number) => void;
  onRequestSolution: () => void;
  onRequestTeach: () => void;
  onSendChat: () => void;
  onClose?: () => void;
};

const selectClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

export function AiPanel({
  activeTab,
  onTabChange,
  review,
  hints,
  hintCount,
  solution,
  teach,
  chatMessages,
  chatInput,
  onChatInputChange,
  solutionLevel,
  onSolutionLevelChange,
  explainStyle,
  onExplainStyleChange,
  loading,
  xpEarned,
  onRequestHint,
  onRequestSolution,
  onRequestTeach,
  onSendChat,
  onClose,
}: AiPanelProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border/80 bg-card shadow-[-4px_0_24px_oklch(0.35_0.05_275/0.04)]">
      <div className="shrink-0 border-b border-border/80 bg-muted/40 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            AI Assistant
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Hide panel"
            >
              <PanelRightClose className="size-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                activeTab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "review" && (
          <div className="space-y-3">
            {xpEarned != null && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/8 px-3 py-2">
                <Zap className="size-3.5 shrink-0 text-primary" />
                <span className="text-sm font-medium text-primary">
                  +{xpEarned} XP earned
                </span>
              </div>
            )}
            {loading && !review && (
              <LoadingState text="Reviewing your code…" />
            )}
            {review ? (
              <MarkdownContent content={review} />
            ) : (
              !loading && <EmptyState text="Submit code to see a short verdict and fixes (if needed)." />
            )}
          </div>
        )}

        {activeTab === "hints" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={hintCount >= n ? "secondary" : "outline"}
                  disabled={loading || hintCount >= n || (n > 1 && hintCount < n - 1)}
                  onClick={() => onRequestHint(n)}
                >
                  Hint {n}
                </Button>
              ))}
            </div>
            {hints.length === 0 && (
              <EmptyState text="Get progressive hints without seeing the full solution." />
            )}
            {hints.map((h, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/80 bg-muted/30 p-3 shadow-sm"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  Hint {i + 1}
                </p>
                <MarkdownContent content={h} />
              </div>
            ))}
          </div>
        )}

        {activeTab === "solution" && (
          <div className="space-y-3">
            <select
              value={solutionLevel}
              onChange={(e) => onSolutionLevelChange(e.target.value)}
              className={selectClass}
            >
              {SOLUTION_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={loading} onClick={onRequestSolution}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                "Show solution"
              )}
            </Button>
            {loading && !solution && <LoadingState text="Generating solution…" />}
            {solution ? (
              <MarkdownContent content={solution} />
            ) : (
              !loading && <EmptyState text="Choose a depth level, then request a solution." />
            )}
          </div>
        )}

        {activeTab === "teach" && (
          <div className="space-y-3">
            <select
              value={explainStyle}
              onChange={(e) => onExplainStyleChange(e.target.value)}
              className={selectClass}
            >
              <option value="simple">Simple</option>
              <option value="technical">Technical</option>
              <option value="eli5">Explain like I&apos;m 10</option>
            </select>
            <Button size="sm" disabled={loading} onClick={onRequestTeach}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Explaining…
                </>
              ) : (
                "Teach me this code"
              )}
            </Button>
            {loading && !teach && <LoadingState text="Generating explanation…" />}
            {teach ? (
              <MarkdownContent content={teach} />
            ) : (
              !loading && <EmptyState text="Write some code then click 'Teach me this code' for a line-by-line explanation." />
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="flex min-h-[320px] flex-col gap-3">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {chatMessages.length === 0 && (
                <EmptyState text="Ask anything about this problem — concepts, syntax, or approach." />
              )}
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm shadow-sm",
                    m.role === "user"
                      ? "ml-3 border border-primary/15 bg-primary/10"
                      : "mr-3 border border-border/80 bg-muted/50"
                  )}
                >
                  {m.role === "assistant" ? (
                    <MarkdownContent content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex shrink-0 gap-2">
              <input
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSendChat()}
                placeholder="Ask a question…"
                className={cn(selectClass, "min-w-0 flex-1")}
              />
              <Button size="sm" disabled={loading || !chatInput.trim()} onClick={onSendChat}>
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm leading-relaxed text-muted-foreground">
      {text}
    </p>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6">
      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
