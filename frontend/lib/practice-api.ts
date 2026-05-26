import { apiFetch, type SubmissionVerifyOut } from "@/lib/api";
import { consumeSSE } from "@/lib/sse";

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type StreamHandlers = {
  onToken: (token: string) => void;
  onDone?: (payload: Record<string, unknown>) => void;
  onError?: (message: string) => void;
};

async function postStream(
  path: string,
  token: string,
  body: unknown,
  handlers: StreamHandlers
): Promise<void> {
  const response = await fetch(`${apiUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  await consumeSSE(response, {
    onToken: handlers.onToken,
    onError: handlers.onError,
    onDone: handlers.onDone,
  });
}

export function streamHint(
  problemId: string,
  token: string,
  code: string,
  hintNumber: number,
  handlers: StreamHandlers
) {
  return postStream(
    `/problems/${problemId}/hint`,
    token,
    { code, hint_number: hintNumber },
    handlers
  );
}

export function streamSolution(
  problemId: string,
  token: string,
  solutionLevel: string,
  handlers: StreamHandlers
) {
  return postStream(
    `/problems/${problemId}/solution`,
    token,
    { solution_level: solutionLevel },
    handlers
  );
}

export function streamTeach(
  problemId: string,
  token: string,
  code: string,
  explainStyle: string,
  handlers: StreamHandlers
) {
  return postStream(
    `/problems/${problemId}/teach`,
    token,
    { code, explain_style: explainStyle },
    handlers
  );
}

export function streamCodeReview(
  problemId: string,
  token: string,
  code: string,
  handlers: StreamHandlers
) {
  return postStream(
    `/problems/${problemId}/code-review`,
    token,
    { code },
    handlers
  );
}

export function streamChat(
  problemId: string,
  token: string,
  message: string,
  history: { role: string; content: string }[],
  handlers: StreamHandlers
) {
  return postStream(
    `/problems/${problemId}/chat`,
    token,
    { message, history },
    handlers
  );
}

export function streamSurprise(
  token: string,
  language: string,
  handlers: StreamHandlers
) {
  return postStream(`/problems/surprise-me`, token, { language }, handlers);
}

export function streamReview(
  submissionId: string,
  token: string,
  handlers: StreamHandlers
) {
  return fetch(`${apiUrl()}/submissions/${submissionId}/review`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => consumeSSE(response, handlers));
}

export function verifySubmission(submissionId: string, token: string) {
  return apiFetch<SubmissionVerifyOut>(`/submissions/${submissionId}/verify`, {
    method: "POST",
    token,
  });
}
