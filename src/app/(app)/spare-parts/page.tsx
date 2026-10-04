import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { getSpareParts } from "@/lib/data";

export default async function SparePartsPage() {
  const parts = await getSpareParts();

  return (
    <div>
      <PageHeader
        title="Spare parts"
        description="Stock on hand, minimum levels, and parts consumed against devices and service requests."
      />
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
    </div>
  );
}
