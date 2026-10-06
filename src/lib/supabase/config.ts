/**
 * Accept classic anon JWT (eyJ…, 3 segments) OR newer sb_publishable_* keys.
 * Reject obvious placeholders only.
 */
export function isValidSupabaseAnonKey(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  if (k.includes("your-anon") || k.includes("your-publishable")) return false;

  // Classic anon / service JWT
  if (k.startsWith("eyJ") && k.split(".").length === 3 && k.length >= 100) {
    return true;
  }

  // New publishable API keys (verified against this project's REST API)
  if (k.startsWith("sb_publishable_") && k.length >= 40) {
    return true;
  }

  return false;
}

/** True when browser build has a real Supabase project URL + usable anon/publishable key. */
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
