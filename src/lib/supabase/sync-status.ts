export type ArmsSyncStatus =
  | { state: "idle" }
  | { state: "ok" }
  | { state: "config_error"; code: "missing_url" | "missing_key" | "invalid_key" }
  | { state: "auth_error"; message: string }
  | { state: "error"; message: string };

const EVENT = "arms-sync-status";

let current: ArmsSyncStatus = { state: "idle" };

export function getArmsSyncStatus(): ArmsSyncStatus {
  return current;
}

export function setArmsSyncStatus(next: ArmsSyncStatus) {
  current = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function subscribeArmsSyncStatus(listener: (status: ArmsSyncStatus) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ArmsSyncStatus>).detail;
    listener(detail ?? getArmsSyncStatus());
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function isAuthLikeSupabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : NaN;
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  return (
    status === 401 ||
    status === 403 ||
    /invalid api key/i.test(message) ||
    /jwt/i.test(message) ||
    code === "PGRST301" ||
    /unauthorized/i.test(message)
  );
}
