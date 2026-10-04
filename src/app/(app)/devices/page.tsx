import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getDevices } from "@/lib/data";

export default async function DevicesPage() {
  const devices = await getDevices();

  return (
    <div>
      <PageHeader
        title="Devices"
        description="Individually identifiable aroma units. Serial number, QR, and barcode are first-class identifiers."
      />
      <DataTable
        columns={["Device", "Serial", "Model", "Customer / branch", "Status", "Location"]}
        rows={devices.map((device) => [
          <Link key="c" href={`/devices/${device.id}`} className="font-medium text-aroma-700">
            {device.deviceCode}
          </Link>,
          device.serialNumber,
          `${device.brand} ${device.modelName}`,
          `${device.customerName} · ${device.branchName}`,
          <StatusBadge key="s" value={device.status} />,
          device.currentLocation,
        ])}
      />
    </div>
  );
}
