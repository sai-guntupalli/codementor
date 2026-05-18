import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the current access token from local session storage.
 * Token refresh is handled automatically by the Supabase client when expired.
 * The backend validates the JWT on every request, so a separate getUser()
 * network call is not needed here.
 */
export async function getValidatedAccessToken(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
