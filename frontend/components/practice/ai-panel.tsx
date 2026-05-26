"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Code2,
  Lightbulb,
  Loader2,
  MessageCircle,
  PanelRightClose,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";

export type AiTab = "review" | "hints" | "solution" | "code-review" | "chat";

const TABS: { id: AiTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "review", label: "Review", Icon: Sparkles },
  { id: "hints", label: "Hints", Icon: Lightbulb },
  { id: "solution", label: "Solution", Icon: BookOpen },
  { id: "code-review", label: "Critique", Icon: Code2 },
  { id: "chat", label: "Chat", Icon: MessageCircle },
];

const SOLUTION_LEVELS = [
  { value: "beginner", label: "Beginner", desc: "Step-by-step with explanations" },
  { value: "learner", label: "Learner", desc: "Guided with key concepts" },
  { value: "industry_standard", label: "Industry", desc: "Production-quality code" },
  { value: "interview_ready", label: "Interview", desc: "Optimized for whiteboard" },
] as const;

type ChatMessage = { role: "user" | "assistant"; content: string };

type AiPanelProps = {
  activeTab: AiTab;
  onTabChange: (tab: AiTab) => void;
  review: string;
  hints: string[];
  hintCount: number;
  solution: string;
  codeReview: string;
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  solutionLevel: string;
  onSolutionLevelChange: (v: string) => void;
  loading: boolean;
  xpEarned?: number | null;
  submissionScore?: number | null;
  onRequestHint: (n: number) => void;
  onRequestSolution: () => void;
  onRequestCodeReview: () => void;
  onSendChat: () => void;
  reviewComplete?: boolean;
  onClose?: () => void;
};

export function AiPanel({
  activeTab,
  onTabChange,
  review,
  hints,
  hintCount,
  solution,
  codeReview,
  chatMessages,
  chatInput,
  onChatInputChange,
  solutionLevel,
  onSolutionLevelChange,
  loading,
  xpEarned,
  submissionScore,
  onRequestHint,
  onRequestSolution,
  onRequestCodeReview,
  onSendChat,
  reviewComplete,
  onClose,
}: AiPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary/15">
              <Sparkles className="size-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold tracking-wide text-foreground/80">
              AI Assistant
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Hide panel"
            >
              <PanelRightClose className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-0.5 border-t border-border/40 p-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-lg py-2 transition-all",
                activeTab === id
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground/60 hover:bg-white/5 hover:text-muted-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content (all tabs except chat input) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "review" && (
          <div className="space-y-3">
            {reviewComplete &&
              submissionScore != null &&
              xpEarned != null &&
              xpEarned > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-sm">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    {Math.round(submissionScore * 100)}% — accepted
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-amber-500">
                    <Zap className="size-3.5" />
                    +{xpEarned} XP
                  </span>
                </div>
              )}
            {loading && !review && <LoadingState text="Reviewing your code…" />}
            {review ? (
              <MarkdownContent content={review} />
            ) : !loading ? (
              <EmptyState
                icon={<Sparkles className="size-5" />}
                title="No review yet"
                description="Submit your code to get instant feedback on correctness and style."
              />
            ) : null}
          </div>
        )}

        {activeTab === "hints" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {hintCount}/3 hints revealed. Use the{" "}
              <Lightbulb className="inline size-3 text-amber-500" /> button above the editor for
              quick access.
            </p>

            {hintCount < 3 && (
              <Button
                size="sm"
                className="w-full"
                disabled={loading}
                onClick={() => onRequestHint(hintCount + 1)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <Lightbulb className="mr-1.5 size-3.5" />
                    Reveal hint {hintCount + 1}
                  </>
                )}
              </Button>
            )}

            {hints.filter((h) => h.trim()).length === 0 && !loading && (
              <EmptyState
                icon={<Lightbulb className="size-5" />}
                title="No hints yet"
                description="Reveal hints one at a time without spoiling the solution."
              />
            )}
            {hints.map(
              (h, i) =>
                h.trim() && (
                  <div key={i} className="sub-card p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                      <Lightbulb className="size-3" />
                      Hint {i + 1}
                    </p>
                    <MarkdownContent content={h} />
                  </div>
                )
            )}
          </div>
        )}

        {activeTab === "solution" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {SOLUTION_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => onSolutionLevelChange(l.value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left transition-all",
                    solutionLevel === l.value
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/40 bg-muted/10 text-muted-foreground hover:border-border/60 hover:text-foreground"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      solutionLevel === l.value ? "text-primary" : ""
                    )}
                  >
                    {l.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug opacity-70">{l.desc}</p>
                </button>
              ))}
            </div>
            <Button size="sm" className="w-full" disabled={loading} onClick={onRequestSolution}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <BookOpen className="mr-1.5 size-3.5" />
                  Show solution
                </>
              )}
            </Button>
            {loading && !solution && <LoadingState text="Generating solution…" />}
            {solution ? (
              <MarkdownContent content={solution} />
            ) : !loading ? (
              <EmptyState
                icon={<BookOpen className="size-5" />}
                title="No solution yet"
                description="Choose a depth level, then generate the solution."
              />
            ) : null}
          </div>
        )}

        {activeTab === "code-review" && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={onRequestCodeReview}
              className={cn(
                "group w-full rounded-xl border border-dashed px-4 py-5 text-center transition-all",
                loading
                  ? "cursor-wait border-border/30"
                  : codeReview
                    ? "border-border/40 bg-muted/10 hover:border-primary/30 hover:bg-primary/5"
                    : "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/8"
              )}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Analyzing…</span>
                </div>
              ) : (
                <>
                  <Code2
                    className={cn(
                      "mx-auto mb-2 size-5",
                      codeReview ? "text-muted-foreground" : "text-primary"
                    )}
                  />
                  <p
                    className={cn(
                      "text-sm font-medium",
                      codeReview ? "text-foreground/60" : "text-foreground"
                    )}
                  >
                    {codeReview ? "Re-analyze my code" : "Analyze my code"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {codeReview
                      ? "Get fresh feedback on your latest changes"
                      : "What's good, what's wrong, and how to improve"}
                  </p>
                </>
              )}
            </button>
            {codeReview && <MarkdownContent content={codeReview} />}
            {!codeReview && !loading && (
              <EmptyState
                icon={<Code2 className="size-5" />}
                title="Ready to review"
                description="Write your solution above, then analyze it for quality and improvements."
              />
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="space-y-3">
            {chatMessages.length === 0 && (
              <EmptyState
                icon={<MessageCircle className="size-5" />}
                title="Ask anything"
                description="Ask about this problem — concepts, approaches, or syntax."
              />
            )}
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm shadow-sm",
                  m.role === "user"
                    ? "ml-4 border border-primary/15 bg-primary/10"
                    : "mr-4 border border-border/40 bg-muted/30"
                )}
              >
                {m.role === "assistant" ? (
                  <MarkdownContent content={m.content} />
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Chat input — pinned to bottom when chat is active */}
      {activeTab === "chat" && (
        <div className="shrink-0 border-t border-border/40 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 focus-within:border-primary/40 transition-colors">
            <textarea
              value={chatInput}
              onChange={(e) => {
                onChatInputChange(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendChat();
                }
              }}
              placeholder="Ask a question… (Enter to send)"
              rows={1}
              className="min-h-0 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <button
              type="button"
              disabled={loading || !chatInput.trim()}
              onClick={onSendChat}
              className={cn(
                "mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg transition-all",
                chatInput.trim() && !loading
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-muted/30 text-muted-foreground/40"
              )}
            >
              <Send className="size-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
            Shift+Enter for new line
          </p>
        </div>
      )}
    </aside>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="sub-card flex flex-col items-center border-dashed px-4 py-8 text-center">
      <div className="mb-3 text-muted-foreground/40">{icon}</div>
      <p className="text-sm font-medium text-foreground/60">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground/50">{description}</p>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="sub-card flex items-center gap-3 border-dashed px-4 py-5">
      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
