import {
  apiFetch,
  focusLearningPath,
  recordPracticeSession,
  type LearningPathProblemItem,
} from "@/lib/api";

export const PRACTICE_PATH_KEY = "practiceLearningPathId";

export function setPracticePathContext(pathId: string) {
  sessionStorage.setItem(PRACTICE_PATH_KEY, pathId);
}

/** Remember path in session + persist for dashboard (fire-and-forget safe). */
export function recordActiveLearningPath(
  pathId: string,
  token?: string | null,
  problemId?: string | null
) {
  setPracticePathContext(pathId);
  if (token) {
    void focusLearningPath(token, pathId, problemId ?? undefined).catch(() => {
      /* offline or stale token — session context still works this visit */
    });
  }
}

/** Track last opened problem (resume card + cross-device). */
export function recordPracticeActivity(
  problemId: string,
  token?: string | null,
  pathId?: string | null
) {
  if (token) {
    void recordPracticeSession(token, problemId, pathId).catch(() => {});
  }
}

export function clearPracticePathContext() {
  sessionStorage.removeItem(PRACTICE_PATH_KEY);
}

export async function resolvePracticePathId(
  token: string,
  problemId: string,
  pathFromUrl: string | null
): Promise<string | null> {
  if (pathFromUrl) {
    setPracticePathContext(pathFromUrl);
    return pathFromUrl;
  }

  const stored = sessionStorage.getItem(PRACTICE_PATH_KEY);
  if (!stored) return null;

  try {
    const items = await apiFetch<LearningPathProblemItem[]>(
      `/learning-paths/${stored}/problems`,
      { token }
    );
    if (items.some((p) => p.id === problemId)) return stored;
  } catch {
    // stored path missing or inaccessible
  }

  clearPracticePathContext();
  return null;
}
