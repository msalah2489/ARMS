"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { getCustomers } from "@/lib/data";
import type { Customer } from "@/types/domain";

export default function CustomersPage() {
  const { t, locale } = usePreferences();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void getCustomers(locale).then((rows) => {
      setCustomers(rows);
      setLoading(false);
    });
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
