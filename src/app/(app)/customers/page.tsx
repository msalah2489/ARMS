"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { branchScopeId } from "@/lib/auth";
import { getCustomers, peekCustomers } from "@/lib/data";
import { readSession } from "@/lib/session";
import type { Customer } from "@/types/domain";

export default function CustomersPage() {
  const { t, locale } = usePreferences();
  const [customers, setCustomers] = useState<Customer[]>(() =>
    typeof window !== "undefined" ? peekCustomers(branchScopeId(readSession()), locale) : [],
  );
  const [loading, setLoading] = useState(() =>
    typeof window !== "undefined"
      ? peekCustomers(branchScopeId(readSession()), locale).length === 0
      : true,
  );

  useEffect(() => {
    let cancelled = false;
    const scope = branchScopeId(readSession());
    const cached = peekCustomers(scope, locale);
    if (cached.length > 0) {
      setCustomers(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    void getCustomers(locale, scope).then((rows) => {
      if (cancelled) return;
      setCustomers(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <div>
      <PageHeader title={t("customers.title")} description={t("customers.description")} />
      {loading ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("customers.loading")}</p>
      ) : (
        <DataTable
          columns={[
            t("customers.col.name"),
            t("customers.col.contact"),
            t("customers.col.phone"),
            t("customers.col.branches"),
            t("customers.col.devices"),
            t("customers.col.address"),
          ]}
          rows={customers.map((customer) => [
            <span key="n" className="font-medium">
              {customer.name}
            </span>,
            customer.contactName,
            customer.phone,
            String(customer.branchCount),
            String(customer.deviceCount),
            customer.address,
          ])}
        />
      )}
    </div>
  );
}
