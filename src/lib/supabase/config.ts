/**
 * Classic Supabase "anon public" JWTs look like eyJ...payload...sig
 * Short sb_publishable_* placeholders return 401 Invalid API key on this project.
 */
export function isValidSupabaseAnonKey(key: string): boolean {
  const k = key.trim();
  if (!k.startsWith("eyJ")) return false;
  if (k.split(".").length !== 3) return false;
  if (k.length < 100) return false;
  if (k.includes("your-anon") || k.includes("your-publishable")) return false;
  return true;
}

/** True when browser build has a real Supabase project URL + classic anon JWT. */
export function isSupabaseConfigured(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  ).trim();

  if (!url || !key) return false;
  if (url.includes("your-project")) return false;
  if (!isValidSupabaseAnonKey(key)) return false;
  return true;
}

export function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  ).trim();
}

export type SupabaseConfigProblem = "missing_url" | "missing_key" | "invalid_key";

/** Human-readable reason when cloud mode was requested but keys are unusable. */
export function getSupabaseConfigProblem(): SupabaseConfigProblem | null {
  if (process.env.NEXT_PUBLIC_USE_DEMO === "true") return null;

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || url.includes("your-project")) {
    return "missing_url";
  }
  if (!key || key.includes("your-anon") || key.includes("your-publishable")) {
    return "missing_key";
  }
  if (!isValidSupabaseAnonKey(key)) {
    return "invalid_key";
  }
  return null;
}
