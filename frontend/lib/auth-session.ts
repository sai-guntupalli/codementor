import type { SupabaseClient } from "@supabase/supabase-js";

/** Validated session — prefer over getSession() alone (may be stale). */
export async function getValidatedAccessToken(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}
