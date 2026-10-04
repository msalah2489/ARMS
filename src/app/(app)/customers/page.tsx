"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { getCustomers } from "@/lib/data";
import type { Customer } from "@/types/domain";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getCustomers().then((rows) => {
      setCustomers(rows);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Organizations that own or use aroma devices. Each customer can have many branches and devices."
      />
      {loading ? (
        <p className="text-sm text-ink-700/70">Loading customers…</p>
      ) : (
        <DataTable
          columns={["Customer", "Contact", "Phone", "Branches", "Devices", "Address"]}
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
