import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { getBranches } from "@/lib/data";

export default async function BranchesPage() {
  const branches = await getBranches();

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Physical locations associated with customers. Devices and service requests sit on a branch."
      />
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
    </div>
  );
}
