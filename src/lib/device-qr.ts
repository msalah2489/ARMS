import {
  listAllRequestDevices,
  normalizeLifecycleStatus,
  updateDeviceLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import {
  homePathForRole,
  isPickupCourierRole,
  isTechnicianRole,
  normalizeRole,
} from "@/lib/auth";
import type { AppRole, DraftRequestDevice, Profile } from "@/types/domain";

/** Public site used when building absolute QR URLs outside the browser. */
export const ARMS_PUBLIC_ORIGIN = "https://msalah2489.github.io";

/** Stable deep-link path (works with static export + trailingSlash). */
export const DEVICE_SCAN_PATH = "/scan/";

/**
 * Resolves the Next.js basePath for GitHub Pages (`/ARMS`) or local (`""`).
 * Prefer runtime path detection so local `next dev` stays root-relative.
 */
export function getAppBasePath(): string {
  if (typeof window !== "undefined") {
    const path = window.location.pathname || "";
    if (path === "/ARMS" || path.startsWith("/ARMS/")) return "/ARMS";
  }
  if (process.env.NEXT_PUBLIC_BASE_PATH) {
    return process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, "");
  }
  if (process.env.GITHUB_PAGES === "true") return "/ARMS";
  return "";
}

export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return ARMS_PUBLIC_ORIGIN;
}

/** Ensure every device has a stable QR token (reuse localId when present). */
export function ensureDeviceQrFields(device: DraftRequestDevice): DraftRequestDevice {
  const localId = (device.localId || "").trim() || crypto.randomUUID();
  const qrToken = (device.qrToken || "").trim() || localId;
  return {
    ...device,
    localId,
    qrToken,
  };
}

export function isDeviceQrPrinted(device: Pick<DraftRequestDevice, "qrPrintedAt">): boolean {
  return Boolean(device.qrPrintedAt && String(device.qrPrintedAt).trim());
}

/** Absolute URL encoded in the printable QR (identifies device only). */
export function buildDeviceQrUrl(device: Pick<DraftRequestDevice, "localId" | "qrToken" | "deviceCode">): string {
  const token = (device.qrToken || device.localId || device.deviceCode || "").trim();
  const base = `${getAppOrigin()}${getAppBasePath()}${DEVICE_SCAN_PATH}`;
  const url = new URL(base, getAppOrigin());
  url.searchParams.set("d", token);
  return url.toString();
}

/** Extract device token from a scanned URL, raw token, or device code. */
export function parseDeviceQrPayload(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  try {
    const asUrl = new URL(value);
    const fromD = asUrl.searchParams.get("d")?.trim();
    if (fromD) return fromD;
    const fromCode = asUrl.searchParams.get("code")?.trim();
    if (fromCode) return fromCode;
    const hash = asUrl.hash.replace(/^#/, "");
    if (hash) {
      const hashParams = new URLSearchParams(hash.includes("=") ? hash : hash.replace(/^\?/, ""));
      const fromHash = hashParams.get("d")?.trim() || hashParams.get("code")?.trim();
      if (fromHash) return fromHash;
    }
  } catch {
    // not a URL — treat as token / code
  }
  // Path-style: .../scan/?d=TOKEN or .../scan/TOKEN
  const scanMatch = value.match(/\/scan\/?(?:\?d=|\/)?([^&\s/#]+)/i);
  if (scanMatch?.[1]) {
    try {
      return decodeURIComponent(scanMatch[1]);
    } catch {
      return scanMatch[1];
    }
  }
  return value;
}

export function findDeviceByQrQuery(query: string): TechnicianQueueItem[] {
  const token = parseDeviceQrPayload(query).toLowerCase();
  if (!token) return [];

  const matches = listAllRequestDevices().filter(({ device }) => {
    const localId = (device.localId || "").toLowerCase();
    const qrToken = (device.qrToken || "").toLowerCase();
    const code = (device.deviceCode || "").toLowerCase();
    const serial = (device.serialNumber || "").toLowerCase();
    return (
      localId === token ||
      qrToken === token ||
      code === token ||
      serial === token ||
      code.includes(token)
    );
  });

  // Prefer exact identity matches over partial deviceCode includes
  const exact = matches.filter(({ device }) => {
    const localId = (device.localId || "").toLowerCase();
    const qrToken = (device.qrToken || "").toLowerCase();
    const code = (device.deviceCode || "").toLowerCase();
    const serial = (device.serialNumber || "").toLowerCase();
    return localId === token || qrToken === token || code === token || serial === token;
  });
  return exact.length ? exact : matches;
}

export function markDeviceQrPrinted(input: {
  requestId: string;
  deviceLocalId: string;
  printedAt?: string;
}): TechnicianQueueItem | null {
  const printedAt = input.printedAt || new Date().toISOString();
  const all = listAllRequestDevices();
  const match = all.find(
    (item) =>
      item.request.id === input.requestId && item.device.localId === input.deviceLocalId,
  );
  if (!match) return null;

  const ensured = ensureDeviceQrFields(match.device);
  updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
    qrToken: ensured.qrToken,
    qrPrintedAt: printedAt,
  });

  return (
    listAllRequestDevices().find(
      (item) =>
        item.request.id === input.requestId && item.device.localId === input.deviceLocalId,
    ) ?? null
  );
}

export type DeviceScanRoute =
  | { kind: "technician_claim"; href: string; item: TechnicianQueueItem }
  | { kind: "courier_action"; href: string; item: TechnicianQueueItem }
  | { kind: "readonly"; href: string; item: TechnicianQueueItem };

function deviceInCourierCustody(device: DraftRequestDevice): boolean {
  const location = (device.currentLocation || "").toLowerCase();
  if (location === "with_courier") return true;
  const status = normalizeLifecycleStatus(device.lifecycleStatus);
  return status === "in_transit_to_service" || status === "in_return_transit";
}

function technicianCanClaim(item: TechnicianQueueItem, role: AppRole): boolean {
  const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
  const normalized = normalizeRole(role);
  if (normalized === "mobile_technician") {
    return status === "in_maintenance_at_branch" || status === "in_maintenance";
  }
  // Service-center technician
  return status === "awaiting_maintenance" || status === "in_maintenance";
}

/**
 * After login + device resolve: route by role and lifecycle.
 * Authorization is session-based; QR only identifies the device.
 */
export function resolveDeviceScanRoute(
  item: TechnicianQueueItem,
  user: Profile,
): DeviceScanRoute {
  const localId = item.device.localId;
  const detailHref = `/devices/detail/?id=${encodeURIComponent(localId)}`;

  if (isTechnicianRole(user.role)) {
    if (technicianCanClaim(item, user.role)) {
      return {
        kind: "technician_claim",
        href: `/technician/work/?claim=${encodeURIComponent(localId)}`,
        item,
      };
    }
    return { kind: "readonly", href: detailHref, item };
  }

  if (isPickupCourierRole(user.role)) {
    if (deviceInCourierCustody(item.device)) {
      return {
        kind: "courier_action",
        href: `/courier/receipts/?d=${encodeURIComponent(localId)}`,
        item,
      };
    }
    return { kind: "readonly", href: detailHref, item };
  }

  return { kind: "readonly", href: detailHref, item };
}

/** Safe internal redirect after login (blocks open redirects). */
export function safeNextPath(raw: string | null | undefined, role: AppRole): string {
  const value = (raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return homePathForRole(role);
  }
  // Strip origin if someone encoded a full path under basePath
  const withoutBase = value.startsWith("/ARMS/")
    ? value.slice("/ARMS".length)
    : value === "/ARMS"
      ? "/"
      : value;
  if (!withoutBase.startsWith("/") || withoutBase.startsWith("//")) {
    return homePathForRole(role);
  }
  return withoutBase;
}
