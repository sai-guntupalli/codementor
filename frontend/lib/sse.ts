export type SSEHandlers = {
  onToken?: (token: string) => void;
  onDone?: (payload: Record<string, unknown>) => void;
  onError?: (message: string) => void;
};

/** Consume an SSE response body from the FastAPI LLM/submission review endpoints. */
export async function consumeSSE(
  response: Response,
  handlers: SSEHandlers
): Promise<void> {
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    handlers.onError?.(typeof err.detail === "string" ? err.detail : "Request failed");
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError?.("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (typeof payload.token === "string") {
          handlers.onToken?.(payload.token);
        }
        if (payload.type === "done") {
          handlers.onDone?.(payload);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
