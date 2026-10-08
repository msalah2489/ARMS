"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { StatusBadge } from "@/components/status-badge";
import {
  listAllRequestDevices,
  normalizeLifecycleStatus,
  subscribeMaintenanceRequestsChanged,
} from "@/lib/branch-store";
import { getDevices } from "@/lib/data";
import type { Device } from "@/types/domain";

type ListFocus = "pending_supervisor" | "awaiting_customer" | null;

function readFocus(raw: string | null): ListFocus {
  if (raw === "pending_supervisor" || raw === "awaiting_customer") return raw;
  return null;
}

export default function DevicesPage() {
  const { t, locale } = usePreferences();
  const searchParams = useSearchParams();
  const focus = readFocus(searchParams?.get("focus") ?? null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      void getDevices(locale).then((rows) => {
        if (cancelled) return;
        setDevices(rows);
        setLoading(false);
      });
    };
    load();
    const unsubscribe = subscribeMaintenanceRequestsChanged(() => load({ quiet: true }));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [locale]);

  const visible = useMemo(() => {
    if (!focus) return devices;
    const lifecycle =
      focus === "pending_supervisor" ? "awaiting_manager_decision" : "awaiting_customer";
    const ids = new Set(
      listAllRequestDevices()
        .filter(
          (item) => normalizeLifecycleStatus(item.device.lifecycleStatus) === lifecycle,
        )
        .map((item) => item.device.localId),
    );
    return devices.filter((device) => ids.has(device.id));
  }, [devices, focus]);

  const filterLabel =
    focus === "pending_supervisor"
      ? t("dashboard.filter.pendingSupervisor")
      : focus === "awaiting_customer"
        ? t("dashboard.filter.awaitingCustomer")
        : null;

  return (
    <div>
      <PageHeader title={t("devices.title")} description={t("devices.description")} />
      {filterLabel ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-aroma-400/40 bg-aroma-50/70 px-3 py-2 text-sm dark:border-aroma-500/30 dark:bg-aroma-950/30">
          <span className="font-medium text-aroma-800 dark:text-aroma-200">{filterLabel}</span>
          <Link
            href="/devices"
            className="text-aroma-700 underline underline-offset-2 dark:text-aroma-300"
          >
            {t("dashboard.filter.clear")}
          </Link>
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("devices.loading")}</p>
      ) : (
        <DataTable
          mobilePrimaryIndex={0}
          mobileBadgeIndexes={[6]}
          columns={[
            t("devices.col.code"),
            t("devices.col.requestNumber"),
            t("devices.col.model"),
            t("devices.col.serial"),
            t("devices.col.customer"),
            t("devices.col.location"),
            t("devices.col.status"),
            t("devices.col.image"),
          ]}
          rows={visible.map((device) => [
            <Link
              key="c"
              href={`/devices/detail/?id=${encodeURIComponent(device.id)}`}
              className="font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100"
            >
              {device.deviceCode}
            </Link>,
            device.requestId && device.requestNumber ? (
              <Link
                key="sr"
                href={`/service-requests/detail/?id=${encodeURIComponent(device.requestId)}`}
                className="font-medium text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100"
              >
                {device.requestNumber}
              </Link>
            ) : (
              "—"
            ),
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
