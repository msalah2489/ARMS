"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { getBranches } from "@/lib/data";
import type { Branch } from "@/types/domain";

export default function BranchesPage() {
  const { t, locale } = usePreferences();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void getBranches(locale).then((rows) => {
      setBranches(rows);
      setLoading(false);
    });
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
