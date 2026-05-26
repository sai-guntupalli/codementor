import type { LearningPathListItem } from "@/lib/api";

const TYPE_PRIORITY: Record<LearningPathListItem["type"], number> = {
  personalized: 0,
  curated: 1,
  custom: 2,
};

export function pickActiveLearningPath(
  paths: LearningPathListItem[],
  preferredPathId?: string | null
): LearningPathListItem | null {
  if (preferredPathId) {
    const preferred = paths.find((p) => p.id === preferredPathId);
    if (preferred && preferred.progress.total_count > 0) return preferred;
  }

  const withProblems = paths.filter((p) => p.progress.total_count > 0);
  if (withProblems.length === 0) return null;

  const inProgress = withProblems.filter(
    (p) => p.progress.progress_pct > 0 && p.progress.progress_pct < 100
  );
  if (inProgress.length > 0) {
    return [...inProgress].sort((a, b) => {
      const typeDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
      if (typeDiff !== 0) return typeDiff;
      return b.progress.progress_pct - a.progress.progress_pct;
    })[0];
  }

  const personalized = withProblems.find((p) => p.type === "personalized");
  if (personalized) return personalized;

  const curated = withProblems.find((p) => p.type === "curated");
  if (curated) return curated;

  return withProblems[0];
}

export function otherLearningPaths(
  paths: LearningPathListItem[],
  activeId: string | null,
  limit = 2
): LearningPathListItem[] {
  return paths
    .filter((p) => p.id !== activeId && p.progress.total_count > 0)
    .sort((a, b) => {
      const aActive =
        a.progress.progress_pct > 0 && a.progress.progress_pct < 100 ? 1 : 0;
      const bActive =
        b.progress.progress_pct > 0 && b.progress.progress_pct < 100 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.progress.progress_pct - a.progress.progress_pct;
    })
    .slice(0, limit);
}

// Mirrored in backend/core/learning_path.py — keep both in sync.
// TODO: serve from API to eliminate duplication.
export const EXPERIENCE_MESSAGES: Record<string, string> = {
  none: "Beginner-friendly problems — no prior experience needed.",
  some: "Build on what you already know.",
  comfortable: "Easy and medium problems to sharpen your skills.",
  professional: "Challenging problems for interview readiness.",
};

export const PATH_TYPE_LABELS: Record<LearningPathListItem["type"], string> = {
  curated: "Curated",
  personalized: "Personalized",
  custom: "Custom",
};
