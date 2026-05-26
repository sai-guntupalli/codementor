import type { TestCaseResult } from "@/lib/execute-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type AuthResponse = {
  access_token: string | null;
  refresh_token: string | null;
  user_id: string;
  is_new_user: boolean;
};

export type PlanOut = {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  llm_calls_per_month: number;
  features: Record<string, boolean>;
  is_active: boolean;
};

export type UserPlanOut = {
  plan: PlanOut | null;
  subscription_status: string | null;
  ai_submit_review: boolean;
  dev_switch_enabled: boolean;
};

export type UserOut = {
  id: string;
  email: string;
  display_name: string | null;
  profile_level: string;
  coding_experience: string | null;
  learning_goal: string | null;
  interested_topics: string[] | null;
  skill_level: Record<string, unknown>;
  streak_days: number;
  xp_total: number;
  is_profile_complete: boolean;
  /** True when submit runs AI review (active paid subscription). */
  ai_submit_review: boolean;
};

export type LearningPathProblem = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  topic: string[];
  language: string;
};

/** Legacy personalized path payload from GET /users/me/learning-path */
export type LearningPathOut = {
  problems: LearningPathProblem[];
  message: string;
  next_problems: LearningPathProblem[];
  library_total: number;
  difficulties: string[];
};

export type LearningPathProgress = {
  solved_count: number;
  total_count: number;
  progress_pct: number;
};

export type LearningPathListItem = {
  id: string;
  title: string;
  description: string | null;
  type: "curated" | "personalized" | "custom";
  created_by: string | null;
  is_public: boolean;
  sort_order: number | null;
  created_at: string;
  progress: LearningPathProgress;
};

export type LearningPathProblemItem = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  topic: string[];
  language: string;
  solved: boolean;
};

export type LearningPathCreate = {
  title: string;
  description?: string | null;
};

export type LearningPathUpdate = {
  title?: string;
  description?: string | null;
};

export type ProblemListItem = {
  id: string;
  title: string;
  slug: string | null;
  language: string;
  difficulty: string;
  topic: string[];
  source: string;
  external_id: number | null;
  created_at: string;
};

export type ProblemList = {
  items: ProblemListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type TagCount = {
  tag: string;
  count: number;
};

export type ProblemFacets = {
  total: number;
  by_difficulty: Record<string, number>;
  by_language: Record<string, number>;
  solved_count: number;
  unsolved_count: number;
  popular_tags: TagCount[];
};

export type ProblemTagsOut = {
  tags: TagCount[];
  suggested: string[];
};

export type ProblemSort = "default" | "title" | "newest" | "recommended";

function formatApiError(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item))).join(", ");
  }
  return "Request failed";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatApiError(error.detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Persist which learning path the user is working on (dashboard active path). */
export async function focusLearningPath(
  token: string,
  pathId: string,
  problemId?: string
): Promise<void> {
  const qs = problemId ? `?problem_id=${encodeURIComponent(problemId)}` : "";
  await apiFetch<void>(`/learning-paths/${pathId}/focus${qs}`, {
    method: "POST",
    token,
  });
}

export async function recordPracticeSession(
  token: string,
  problemId: string,
  pathId?: string | null
): Promise<void> {
  await apiFetch<void>("/users/me/practice-session", {
    method: "POST",
    token,
    body: JSON.stringify({ problem_id: problemId, path_id: pathId ?? null }),
  });
}

export type SubmissionOut = {
  id: string;
  user_id: string;
  problem_id: string;
  code: string;
  language: string;
  llm_review: string | null;
  improved_code: string | null;
  hints_used: number;
  solution_viewed: boolean;
  score: number | null;
  created_at: string;
};

export type SubmissionVerifyOut = {
  submission_id: string;
  passed_count: number;
  total_count: number;
  all_passed: boolean;
  score: number;
  xp_earned: number;
  results: TestCaseResult[];
  summary: string;
};

export type SubmissionHistoryItem = {
  id: string;
  problem_id: string;
  problem_title: string;
  language: string;
  score: number | null;
  hints_used: number;
  solution_viewed: boolean;
  created_at: string;
};

export type SolvedProblemIdsOut = {
  solved_ids: string[];
};

export type DailyChallengeOut = {
  problem_id: string;
  problem_title: string;
  difficulty: string;
  language: string;
  path_id: string | null;
  completed_today: boolean;
};

export type DailyGoalOut = {
  target: number;
  solved_today: number;
  met: boolean;
};

export type WeakTopicOut = {
  topic: string;
  skill: number;
  problems: { id: string; title: string; difficulty: string }[];
};

export type BookmarkSummaryOut = {
  problem_id: string;
  title: string;
  difficulty: string;
  language: string;
};

export type WeekStatsOut = {
  solved_this_week: number;
  solved_last_week: number;
  submissions_this_week: number;
  submissions_last_week: number;
  xp_total: number;
};

export type LastSessionOut = {
  problem_id: string;
  problem_title: string;
  path_id: string | null;
  updated_at: string;
};

export type PathCompletionOut = {
  path_id: string;
  path_title: string;
  total_count: number;
  show_celebration: boolean;
};

export type SuggestedPathOut = {
  path_id: string;
  title: string;
  description: string | null;
  reason: string;
};

export type DashboardOut = {
  user: UserOut;
  recent_submissions: SubmissionHistoryItem[];
  learning_paths: LearningPathListItem[];
  active_path_id: string | null;
  active_path_problems: LearningPathProblemItem[];
  solved_count: number;
  library_total: number;
  usage: UsageOut;
  daily_challenge: DailyChallengeOut | null;
  daily_goal: DailyGoalOut;
  weak_topics: WeakTopicOut[];
  bookmarks: BookmarkSummaryOut[];
  week_stats: WeekStatsOut;
  last_session: LastSessionOut | null;
  path_completion: PathCompletionOut | null;
  suggested_path: SuggestedPathOut | null;
  paths_started_count: number;
  has_any_submission: boolean;
};

export type UsageOut = {
  calls_used: number;
  calls_limit: number;
  cost_usd_month: number;
  resets_at: string;
  breakdown: Record<string, number>;
};

export type CurriculumPathOut = {
  id: string;
  title: string;
  language: string;
  target_level: string | null;
  description: string | null;
  is_published: boolean;
};
