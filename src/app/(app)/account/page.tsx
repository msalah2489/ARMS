"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";

/** Account merged into Settings — keep old URL working. */
export default function AccountRedirectPage() {
  const router = useRouter();
  const { t } = usePreferences();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("common.loading")}</p>;
}
