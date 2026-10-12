"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { getBranches, peekBranches } from "@/lib/data";
import type { Branch } from "@/types/domain";

export default function BranchesPage() {
  const { t, locale } = usePreferences();
  const [branches, setBranches] = useState<Branch[]>(() =>
    typeof window !== "undefined" ? peekBranches(locale) : [],
  );
  const [loading, setLoading] = useState(() =>
    typeof window !== "undefined" ? peekBranches(locale).length === 0 : true,
  );

  useEffect(() => {
    let cancelled = false;
    const cached = peekBranches(locale);
    if (cached.length > 0) {
      setBranches(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    void getBranches(locale).then((rows) => {
      if (cancelled) return;
      setBranches(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <div>
      <PageHeader title={t("branches.title")} description={t("branches.description")} />
      {loading ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("branches.loading")}</p>
      ) : (
        <DataTable
          columns={[
            t("branches.col.name"),
            t("branches.col.code"),
            t("branches.col.customer"),
            t("branches.col.phone"),
            t("branches.col.address"),
          ]}
          rows={branches.map((branch) => [
            <span key="n" className="font-medium">
              {branch.name}
            </span>,
            branch.code,
            branch.customerName,
            branch.phone,
            branch.address,
          ])}
        />
      )}
    </div>
  );
}
