const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type RunResult = {
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;
  /** True when the server wrapped your function and called it with the example input. */
  harnessed?: boolean;
};

export type TestCaseResult = {
  index: number;
  input: string;
  expected: string;
  actual: string;
  stderr: string;
  passed: boolean;
  timed_out: boolean;
  exit_code: number | null;
};

export async function runCode(
  language: string,
  code: string,
  token: string,
  stdin = ""
): Promise<RunResult> {
  const res = await fetch(`${API_URL}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ language, code, stdin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Execution failed"
    );
  }
  return res.json() as Promise<RunResult>;
}

function normalizeOutput(s: string): string {
  return s
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/** Prepare stdin for Python input() — real newlines and trailing line feed. */
export function normalizeStdin(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "(none)" || trimmed === "") return "";
  let s = trimmed.replace(/\\n/g, "\n");
  if (!s.endsWith("\n")) s += "\n";
  return s;
}

/** True when example input is a function call like delete_person([1, 2], "x"). */
export function looksLikeFunctionCallExample(input: string): boolean {
  const t = input.trim();
  const match = /^([a-z_]\w*)\s*\(([\s\S]*)\)\s*$/i.exec(t);
  return Boolean(match);
}

/** LeetCode-style: list1 = [1, 2]\nlist2 = [3, 4] */
export function looksLikeAssignmentFixture(input: string): boolean {
  const lines = input
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return false;
  return lines.every((line) => /^[a-z_]\w*\s*=\s*.+$/i.test(line));
}

/** True when example can be run (stdin script, literal arg, or function-call fixture). */
export function isRunnableExample(input: string): boolean {
  const t = input.trim();
  if (t === "" || t === "(none)" || /see description/i.test(t)) return false;
  if (looksLikeFunctionCallExample(t)) return true;
  if (looksLikeAssignmentFixture(t)) return true;
  // Other parenthesized snippets (assignments, multiline) are not auto-runnable.
  if (/\w\s*\(/.test(t)) return false;
  if (/^[a-z_][\w]*\s*=/i.test(t)) return false;
  if (/^(def|class|import|from)\b/m.test(t)) return false;
  return true;
}

export async function runTestCases(
  language: string,
  code: string,
  token: string,
  examples: { input: string; output: string }[]
): Promise<TestCaseResult[]> {
  const runnable = examples.filter((ex) => isRunnableExample(ex.input));
  const results = await Promise.all(
    runnable.map(async (ex, i) => {
      const stdin = normalizeStdin(ex.input);
      const expected = normalizeOutput(ex.output);
      try {
        const result = await runCode(language, code, token, stdin);
        const actual = normalizeOutput(result.stdout);
        return {
          index: i,
          input: ex.input,
          expected,
          actual,
          stderr: result.stderr,
          passed: !result.timed_out && result.exit_code === 0 && actual === expected,
          timed_out: result.timed_out,
          exit_code: result.exit_code,
        };
      } catch (err) {
        return {
          index: i,
          input: ex.input,
          expected,
          actual: "",
          stderr: err instanceof Error ? err.message : "Execution failed",
          passed: false,
          timed_out: false,
          exit_code: 1,
        };
      }
    })
  );
  return results;
}
