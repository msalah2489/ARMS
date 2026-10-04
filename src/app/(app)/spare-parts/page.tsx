"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { getSpareParts } from "@/lib/data";
import type { SparePart } from "@/types/domain";

export default function SparePartsPage() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getSpareParts().then((rows) => {
      setParts(rows);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Spare parts"
        description="Stock on hand, minimum levels, and parts consumed against devices and service requests."
      />
      {loading ? (
        <p className="text-sm text-ink-700/70">Loading spare parts…</p>
      ) : (
        <DataTable
          columns={["Code", "Name", "Brand", "On hand", "Minimum", "Unit"]}
          rows={parts.map((part) => [
            part.partCode,
            part.name,
            part.brand,
            <span
              key="q"
              className={part.stockQuantity < part.minimumStock ? "font-medium text-rose-700" : ""}
            >
              {part.stockQuantity}
            </span>,
            String(part.minimumStock),
            part.unit,
          ])}
        />
      )}
    </div>
  );
}
