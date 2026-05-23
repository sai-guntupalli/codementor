import { apiFetch, type LearningPathProblemItem } from "@/lib/api";

export const PRACTICE_PATH_KEY = "practiceLearningPathId";

export function setPracticePathContext(pathId: string) {
  sessionStorage.setItem(PRACTICE_PATH_KEY, pathId);
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
