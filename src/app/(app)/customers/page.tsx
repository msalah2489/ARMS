"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { branchScopeId } from "@/lib/auth";
import { getCustomers, peekCustomers } from "@/lib/data";
import { normalizeSearchToken } from "@/lib/global-search";
import { readSession } from "@/lib/session";
import type { Customer } from "@/types/domain";

function CustomersPageContent() {
  const { t, locale } = usePreferences();
  const searchParams = useSearchParams();
  const filterQ = (searchParams?.get("q") || "").trim();
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

  const visible = useMemo(() => {
    if (!filterQ) return customers;
    const needle = normalizeSearchToken(filterQ);
    const needleLower = filterQ.toLowerCase();
    return customers.filter((customer) => {
      const name = (customer.name || "").toLowerCase();
      const contact = (customer.contactName || "").toLowerCase();
      const phone = normalizeSearchToken(customer.phone || "");
      return (
        name.includes(needleLower) ||
        contact.includes(needleLower) ||
        (needle.length > 0 && phone.includes(needle))
      );
    });
  }, [customers, filterQ]);

  return (
    <div>
      <PageHeader title={t("customers.title")} description={t("customers.description")} />
      {filterQ ? (
        <p className="mb-3 text-sm text-ink-700/70 dark:text-sand-100/70">
          {t("search.filterHint").replace("{q}", filterQ)}
        </p>
      ) : null}
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
          rows={visible.map((customer) => [
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

export default function CustomersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-700/70">…</p>}>
      <CustomersPageContent />
    </Suspense>
  );
}
