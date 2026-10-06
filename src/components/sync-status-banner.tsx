"use client";

import { useEffect, useState } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { isDemoMode } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n/messages";
import { getSupabaseConfigProblem } from "@/lib/supabase/config";
import {
  getArmsSyncStatus,
  setArmsSyncStatus,
  subscribeArmsSyncStatus,
  type ArmsSyncStatus,
} from "@/lib/supabase/sync-status";

function messageFor(status: ArmsSyncStatus, t: (key: MessageKey) => string): string | null {
  if (status.state === "config_error") {
    if (status.code === "invalid_key") return t("sync.invalidKey");
    if (status.code === "missing_key") return t("sync.missingKey");
    return t("sync.missingUrl");
  }
  if (status.state === "auth_error") return t("sync.authError");
  if (status.state === "error") return t("sync.genericError");
  return null;
}

export function SyncStatusBanner() {
  const { t } = usePreferences();
  const [status, setStatus] = useState<ArmsSyncStatus>(() => getArmsSyncStatus());

  useEffect(() => {
    if (isDemoMode()) return;

    const problem = getSupabaseConfigProblem();
    if (problem) {
      setArmsSyncStatus({ state: "config_error", code: problem });
    }

    setStatus(getArmsSyncStatus());
    return subscribeArmsSyncStatus(setStatus);
  }, []);

  if (isDemoMode()) return null;

  const text = messageFor(status, t);
  if (!text) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-700/30 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-300/20 dark:bg-amber-950/50 dark:text-amber-50"
    >
      {text}
    </div>
  );
}
