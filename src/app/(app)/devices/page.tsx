"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
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
            t("devices.col.model"),
            t("devices.col.serial"),
            t("devices.col.customer"),
            t("devices.col.location"),
            t("devices.col.status"),
            t("devices.col.image"),
          ]}
          rows={devices.map((device) => [
            <Link
              key="c"
              href={`/devices/detail/?id=${encodeURIComponent(device.id)}`}
              className="font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100"
            >
              {device.deviceCode}
            </Link>,
            `${device.brand} ${device.modelName}`,
            device.serialNumber,
            device.customerName,
            device.currentLocation,
            <StatusBadge key="s" value={device.status} />,
            device.imageDataUrl ? (
              <ClickableImage
                key="img"
                src={device.imageDataUrl}
                alt={device.deviceCode}
                size="sm"
              />
            ) : (
              <ImagePlaceholder key="img" size="sm" />
            ),
          ])}
        />
      )}
    </div>
  );
}
