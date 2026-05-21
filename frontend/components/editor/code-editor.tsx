"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: string;
  className?: string;
};

function monacoLanguage(lang: string): string {
  if (lang === "sql") return "sql";
  return "python";
}

export function CodeEditor({ value, onChange, language, className }: CodeEditorProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[200px] flex-col overflow-hidden rounded-xl border border-border/60 shadow-card",
        className
      )}
    >
      <Monaco
        height="100%"
        language={monacoLanguage(language)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        loading={
          <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]">
            <span className="text-xs text-neutral-500">Loading editor…</span>
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: "gutter",
          bracketPairColorization: { enabled: true },
          cursorBlinking: "smooth",
          smoothScrolling: true,
        }}
      />
    </div>
  );
}
