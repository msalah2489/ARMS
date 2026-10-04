import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { getCustomers } from "@/lib/data";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Organizations that own or use aroma devices. Each customer can have many branches and devices."
      />
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
    </div>
  );
}
