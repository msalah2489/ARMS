"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { getBranches } from "@/lib/data";
import type { Branch } from "@/types/domain";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getBranches().then((rows) => {
      setBranches(rows);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Physical locations associated with customers. Devices and service requests sit on a branch."
      />
      {loading ? (
        <p className="text-sm text-ink-700/70">Loading branches…</p>
      ) : (
        <DataTable
          columns={["Branch", "Code", "Customer", "Phone", "Address"]}
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
