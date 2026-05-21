const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type AuthResponse = {
  access_token: string | null;
  refresh_token: string | null;
  user_id: string;
  is_new_user: boolean;
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
};

export type LearningPathProblem = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  topic: string[];
  language: string;
};

export type LearningPathOut = {
  problems: LearningPathProblem[];
  message: string;
  next_problems: LearningPathProblem[];
};

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

export type CurriculumPathOut = {
  id: string;
  title: string;
  language: string;
  target_level: string | null;
  description: string | null;
  is_published: boolean;
};
