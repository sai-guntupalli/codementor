"use client";

import { useState, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("json", json);
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { Maximize2, X } from "lucide-react";

const codeTheme = {
  'code[class*="language-"]': {
    color: "oklch(0.92 0.02 275)",
    background: "none",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "0.8125rem",
    lineHeight: "1.6",
  },
  'pre[class*="language-"]': {
    background: "oklch(0.22 0.04 275)",
    padding: "1rem",
    borderRadius: "0.5rem",
    overflow: "auto",
    margin: "0",
  },
  comment: { color: "oklch(0.6 0.03 275)" },
  prolog: { color: "oklch(0.6 0.03 275)" },
  doctype: { color: "oklch(0.6 0.03 275)" },
  cdata: { color: "oklch(0.6 0.03 275)" },
  punctuation: { color: "oklch(0.75 0.03 275)" },
  property: { color: "oklch(0.78 0.12 220)" },
  tag: { color: "oklch(0.78 0.12 220)" },
  boolean: { color: "oklch(0.78 0.14 30)" },
  number: { color: "oklch(0.78 0.14 30)" },
  constant: { color: "oklch(0.78 0.14 30)" },
  symbol: { color: "oklch(0.78 0.14 30)" },
  deleted: { color: "oklch(0.65 0.15 20)" },
  selector: { color: "oklch(0.82 0.12 150)" },
  "attr-name": { color: "oklch(0.82 0.12 150)" },
  string: { color: "oklch(0.82 0.12 150)" },
  char: { color: "oklch(0.82 0.12 150)" },
  builtin: { color: "oklch(0.82 0.12 150)" },
  inserted: { color: "oklch(0.82 0.12 150)" },
  operator: { color: "oklch(0.88 0.05 275)" },
  entity: { color: "oklch(0.88 0.05 275)", cursor: "help" },
  url: { color: "oklch(0.88 0.05 275)" },
  variable: { color: "oklch(0.88 0.05 275)" },
  atrule: { color: "oklch(0.75 0.15 280)" },
  "attr-value": { color: "oklch(0.75 0.15 280)" },
  function: { color: "oklch(0.75 0.15 280)" },
  "class-name": { color: "oklch(0.75 0.15 280)" },
  keyword: { color: "oklch(0.72 0.18 290)" },
  regex: { color: "oklch(0.8 0.14 60)" },
  important: { color: "oklch(0.8 0.14 60)", fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
};

const codeTagProps = {
  style: {
    fontFamily: "inherit",
    display: "block",
    background: "none",
    color: "oklch(0.92 0.02 275)",
  },
};

const blockCodeStyle = {
  margin: 0,
  padding: "0.875rem 1rem",
  borderRadius: "0.5rem",
  border: "1px solid oklch(0.35 0.04 275 / 0.4)",
  background: "oklch(0.22 0.04 275)",
  overflowX: "auto" as const,
  display: "block",
  maxWidth: "100%",
  fontSize: "0.8125rem",
  lineHeight: "1.6",
  whiteSpace: "pre" as const,
};

const fullscreenCodeStyle = {
  margin: 0,
  padding: "1.25rem 1.5rem",
  background: "oklch(0.2 0.04 275)",
  borderRadius: "0.75rem",
  fontSize: "0.9375rem",
  lineHeight: "1.6",
  minHeight: "100%",
  whiteSpace: "pre" as const,
};

type MaximizedCode = { code: string; language: string };

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const [maximized, setMaximized] = useState<MaximizedCode | null>(null);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximized(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  const mdComponents = useMemo<Components>(
    () => ({
      pre({ children }) {
        return <>{children}</>;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code({ className: cls, children, ...props }: any) {
        const match = /language-(\w+)/.exec(cls ?? "");
        if (match) {
          const code = String(children).replace(/\n$/, "");
          return (
            <div className="group relative">
              <button
                type="button"
                onClick={() => setMaximized({ code, language: match[1] })}
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                title="Expand"
              >
                <Maximize2 className="size-3.5" />
              </button>
              <SyntaxHighlighter
                language={match[1]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                style={codeTheme as any}
                PreTag="pre"
                customStyle={blockCodeStyle}
                codeTagProps={codeTagProps}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          );
        }

        return (
          <code
            className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] font-normal text-primary before:content-none after:content-none"
            {...props}
          >
            {children}
          </code>
        );
      },
    }),
    []
  );

  return (
    <>
      <div
        className={cn(
          "prose prose-sm prose-slate max-w-none font-sans",
          "prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
          "prose-p:font-sans prose-p:text-[0.9375rem] prose-p:leading-relaxed prose-p:text-foreground/85",
          "prose-strong:font-sans prose-strong:font-semibold prose-strong:text-foreground",
          "prose-li:font-sans prose-li:text-foreground/85",
          "prose-code:rounded-md prose-code:border prose-code:border-border/60 prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-code:font-mono prose-code:text-[0.8125rem] prose-code:font-normal prose-code:text-primary",
          "prose-pre:rounded-lg prose-pre:border-0 prose-pre:bg-transparent prose-pre:p-0 prose-pre:shadow-none",
          "prose-ol:text-foreground/85 prose-ul:text-foreground/85",
          "prose-li:marker:text-primary/60",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          className
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {content}
        </ReactMarkdown>
      </div>

      {maximized && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[oklch(0.13_0.04_275)]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
            <span className="font-mono text-sm font-medium text-white/50">
              {maximized.language}
            </span>
            <button
              type="button"
              onClick={() => setMaximized(null)}
              className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="Close (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <SyntaxHighlighter
              language={maximized.language}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              style={codeTheme as any}
              PreTag="pre"
              customStyle={fullscreenCodeStyle}
              codeTagProps={codeTagProps}
            >
              {maximized.code}
            </SyntaxHighlighter>
          </div>
        </div>
      )}
    </>
  );
}
