/**
 * CS-FEATURE — Feature flag for Customer Service diagnostic UI.
 * Unset or any value other than "0" / "false" → enabled (default on).
 */

export function isCsDiagnosticEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_CS_DIAGNOSTIC ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}
