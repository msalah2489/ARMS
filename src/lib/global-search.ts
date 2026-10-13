import { branchScopeId, isDemoMode } from "@/lib/auth";
import { listMaintenanceRequests } from "@/lib/branch-store";
import { peekCustomers, peekDevices, peekServiceRequests } from "@/lib/data";
import { parseDeviceQrPayload } from "@/lib/device-qr";
import { listOpsCustomers } from "@/lib/ops-data";
import type { Profile } from "@/types/domain";

export type GlobalSearchKind = "request" | "device" | "customer";

export type GlobalSearchResult = {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  subtitle: string;
  href: string;
  /** Lower is better (exact match = 0). */
  rank: number;
};

const MAX_RESULTS = 10;

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** Lowercase + strip spaces/dashes for phone / loose matching. */
export function normalizeSearchToken(raw: string): string {
  return normalizeDigits(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.]/g, "");
}

function matchRank(haystack: string, needle: string): number | null {
  if (!haystack || !needle) return null;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 0;
  if (h.startsWith(n)) return 1;
  if (h.includes(n)) return 2;
  const hLoose = normalizeSearchToken(haystack);
  const nLoose = normalizeSearchToken(needle);
  if (hLoose && nLoose) {
    if (hLoose === nLoose) return 0;
    if (hLoose.startsWith(nLoose)) return 1;
    if (hLoose.includes(nLoose)) return 2;
  }
  return null;
}

function bestRank(...ranks: Array<number | null>): number | null {
  let best: number | null = null;
  for (const rank of ranks) {
    if (rank == null) continue;
    if (best == null || rank < best) best = rank;
  }
  return best;
}

function pushUnique(
  bag: Map<string, GlobalSearchResult>,
  item: GlobalSearchResult,
) {
  const existing = bag.get(item.id);
  if (!existing || item.rank < existing.rank) {
    bag.set(item.id, item);
  }
}

function searchOpsRequests(query: string, scope: string | null): GlobalSearchResult[] {
  const bag = new Map<string, GlobalSearchResult>();
  const qrToken = parseDeviceQrPayload(query);
  const raw = query.trim();

  for (const request of listMaintenanceRequests(scope)) {
    const requestRank = matchRank(request.requestNumber, raw);
    const invoice = (request.purchaseInvoice || "").trim();
    const invoiceRank = invoice ? matchRank(invoice, raw) : null;
    const phoneRank = matchRank(request.customerMobile, raw);
    const nameRank = matchRank(request.contactName, raw);

    const topRequestRank = bestRank(requestRank, invoiceRank);
    if (topRequestRank != null) {
      const matchHint =
        requestRank != null
          ? request.requestNumber
          : invoice
            ? `فاتورة ${invoice}`
            : request.requestNumber;
      pushUnique(bag, {
        id: `request:${request.id}`,
        kind: "request",
        title: request.requestNumber,
        subtitle: [request.contactName, request.opsBranchName, matchHint !== request.requestNumber ? matchHint : null]
          .filter(Boolean)
          .join(" · "),
        href: `/service-requests/detail/?id=${encodeURIComponent(request.id)}`,
        rank: topRequestRank,
      });
    }

    if (phoneRank != null || nameRank != null) {
      const phone = request.customerMobile.trim();
      if (phone) {
        pushUnique(bag, {
          id: `customer:${phone}`,
          kind: "customer",
          title: request.contactName.trim() || phone,
          subtitle: phone,
          href: `/customers/?q=${encodeURIComponent(phone)}`,
          rank: bestRank(phoneRank, nameRank) ?? 2,
        });
      }
      // Also surface the request when name/phone hit (useful for ops)
      pushUnique(bag, {
        id: `request:${request.id}`,
        kind: "request",
        title: request.requestNumber,
        subtitle: [request.contactName, request.customerMobile, request.opsBranchName]
          .filter(Boolean)
          .join(" · "),
        href: `/service-requests/detail/?id=${encodeURIComponent(request.id)}`,
        rank: (bestRank(phoneRank, nameRank) ?? 2) + 1,
      });
    }

    for (const device of request.devices) {
      const deviceRank = bestRank(
        matchRank(device.deviceCode, raw),
        matchRank(device.serialNumber, raw),
        matchRank(device.qrToken || "", qrToken || raw),
        matchRank(device.localId, qrToken || raw),
        matchRank(device.deviceCode, qrToken),
      );
      if (deviceRank == null) continue;
      pushUnique(bag, {
        id: `device:${device.localId}`,
        kind: "device",
        title: device.deviceCode || device.serialNumber || device.localId,
        subtitle: [
          device.serialNumber ? `SN ${device.serialNumber}` : null,
          request.requestNumber,
          request.contactName,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/devices/detail/?id=${encodeURIComponent(device.localId)}`,
        rank: deviceRank,
      });
    }
  }

  for (const customer of listOpsCustomers(scope)) {
    const rank = bestRank(matchRank(customer.name, raw), matchRank(customer.phone, raw));
    if (rank == null) continue;
    pushUnique(bag, {
      id: `customer:${customer.phone || customer.id}`,
      kind: "customer",
      title: customer.name,
      subtitle: customer.phone,
      href: `/customers/?q=${encodeURIComponent(customer.phone || customer.name)}`,
      rank,
    });
  }

  return [...bag.values()];
}

function searchDemo(query: string, scope: string | null): GlobalSearchResult[] {
  const bag = new Map<string, GlobalSearchResult>();
  const raw = query.trim();
  const qrToken = parseDeviceQrPayload(query);

  for (const request of peekServiceRequests(scope)) {
    const requestRank = matchRank(request.requestNumber, raw);
    const nameRank = matchRank(request.customerName, raw);
    if (requestRank != null || nameRank != null) {
      pushUnique(bag, {
        id: `request:${request.id}`,
        kind: "request",
        title: request.requestNumber,
        subtitle: [request.customerName, request.branchName].filter(Boolean).join(" · "),
        href: `/service-requests/detail/?id=${encodeURIComponent(request.id)}`,
        rank: bestRank(requestRank, nameRank) ?? 2,
      });
    }
  }

  for (const device of peekDevices(scope)) {
    const deviceRank = bestRank(
      matchRank(device.deviceCode, raw),
      matchRank(device.serialNumber, raw),
      matchRank(device.qrCode, qrToken || raw),
      matchRank(device.id, qrToken || raw),
    );
    if (deviceRank == null) continue;
    pushUnique(bag, {
      id: `device:${device.id}`,
      kind: "device",
      title: device.deviceCode,
      subtitle: [
        device.serialNumber ? `SN ${device.serialNumber}` : null,
        device.requestNumber,
        device.customerName,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/devices/detail/?id=${encodeURIComponent(device.id)}`,
      rank: deviceRank,
    });
  }

  for (const customer of peekCustomers(scope)) {
    const rank = bestRank(
      matchRank(customer.name, raw),
      matchRank(customer.contactName, raw),
      matchRank(customer.phone, raw),
    );
    if (rank == null) continue;
    pushUnique(bag, {
      id: `customer:${customer.phone || customer.id}`,
      kind: "customer",
      title: customer.name || customer.contactName,
      subtitle: customer.phone,
      href: `/customers/?q=${encodeURIComponent(customer.phone || customer.name)}`,
      rank,
    });
  }

  return [...bag.values()];
}

/**
 * Client-side global search over hydrated ops (or demo) data.
 * Branch users are scoped via `branchScopeId`; admins/maintenance see all.
 */
export function runGlobalSearch(
  query: string,
  user: Profile | null,
): GlobalSearchResult[] {
  const raw = query.trim();
  if (raw.length < 2) return [];

  const scope = branchScopeId(user);
  const results = isDemoMode() ? searchDemo(raw, scope) : searchOpsRequests(raw, scope);

  return results
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const kindOrder = { request: 0, device: 1, customer: 2 } as const;
      if (kindOrder[a.kind] !== kindOrder[b.kind]) {
        return kindOrder[a.kind] - kindOrder[b.kind];
      }
      return a.title.localeCompare(b.title, "ar");
    })
    .slice(0, MAX_RESULTS);
}

export function globalSearchKindLabel(kind: GlobalSearchKind, locale: "ar" | "en" = "ar"): string {
  if (locale === "en") {
    if (kind === "request") return "Request";
    if (kind === "device") return "Device";
    return "Customer";
  }
  if (kind === "request") return "طلب";
  if (kind === "device") return "جهاز";
  return "عميل";
}
