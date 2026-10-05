"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { StatusBadge } from "@/components/status-badge";
import { getDevices } from "@/lib/data";
import type { Device } from "@/types/domain";

export default function DevicesPage() {
  const { t, locale } = usePreferences();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void getDevices(locale).then((rows) => {
      setDevices(rows);
      setLoading(false);
    });
  }, [locale]);

  return (
    <div>
      <PageHeader title={t("devices.title")} description={t("devices.description")} />
      {loading ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("devices.loading")}</p>
      ) : (
        <DataTable
          columns={[
            t("devices.col.code"),
            t("devices.col.serial"),
            t("devices.col.model"),
            t("devices.col.customerBranch"),
            t("devices.col.status"),
            t("devices.col.location"),
          ]}
          rows={devices.map((device) => [
            <Link
              key="c"
              href={`/devices/detail/?id=${encodeURIComponent(device.id)}`}
              className="font-medium text-aroma-700 dark:text-aroma-200"
            >
              {device.deviceCode}
            </Link>,
            device.serialNumber,
            `${device.brand} ${device.modelName}`,
            `${device.customerName} · ${device.branchName}`,
            <StatusBadge key="s" value={device.status} />,
            device.currentLocation,
          ])}
        />
      )}
    </div>
  );
}
