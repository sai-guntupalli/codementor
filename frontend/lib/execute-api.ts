const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type RunResult = {
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;
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

function normalizeInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "(none)" || trimmed === "") return "";
  return trimmed;
}

export async function runTestCases(
  language: string,
  code: string,
  token: string,
  examples: { input: string; output: string }[]
): Promise<TestCaseResult[]> {
  const results = await Promise.all(
    examples.map(async (ex, i) => {
      const stdin = normalizeInput(ex.input);
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
