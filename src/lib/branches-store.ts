import { isDemoMode } from "@/lib/auth";
import { pushAppBranches } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { OpsBranchRecord } from "@/types/domain";

const BRANCHES_KEY = "arms_ops_branches_v1";
const BRANCH_SEQ_KEY = "arms_ops_branch_seq_v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeBranch(branch: OpsBranchRecord): OpsBranchRecord {
  return {
    ...branch,
    isActive: branch.isActive !== false,
  };
}

function seedBranches(): OpsBranchRecord[] {
  return [
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      name: "فرع الرياض",
      city: "الرياض",
      code: "BR-0001",
      isServiceCenter: false,
      isActive: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
      name: "فرع جدة",
      city: "جدة",
      code: "BR-0002",
      isServiceCenter: false,
      isActive: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
      name: "مركز الصيانة الرئيسي",
      city: "الرياض",
      code: "SC-0001",
      isServiceCenter: true,
      isActive: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  ];
}

function schedulePersist(branches: OpsBranchRecord[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushAppBranches(branches);
}

/** Raw localStorage read (no seed write). Used by Supabase hydrate. */
export function listOpsBranchRecordsLocal(): OpsBranchRecord[] {
  return readJson<OpsBranchRecord[]>(BRANCHES_KEY, []).map(normalizeBranch);
}

export function replaceOpsBranchRecords(branches: OpsBranchRecord[]) {
  if (typeof window === "undefined") return;
  writeJson(BRANCHES_KEY, branches.map(normalizeBranch));
}

export function applyRemoteBranches(branches: OpsBranchRecord[]) {
  replaceOpsBranchRecords(
    [...branches].sort((a, b) => a.name.localeCompare(b.name, "ar")),
  );
}

function nextCode(isServiceCenter: boolean) {
  const prefix = isServiceCenter ? "SC" : "BR";
  const existing = listOpsBranchRecords({ includeInactive: true })
    .map((item) => item.code)
    .filter((code) => code.startsWith(`${prefix}-`));
  let max = 0;
  for (const code of existing) {
    const num = Number(code.split("-")[1]);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  let seq = Math.max(max, readJson<number>(BRANCH_SEQ_KEY, 0));
  let code = "";
  const used = new Set(
    listOpsBranchRecords({ includeInactive: true }).map((item) => item.code),
  );
  do {
    seq += 1;
    code = `${prefix}-${String(seq).padStart(4, "0")}`;
  } while (used.has(code));
  writeJson(BRANCH_SEQ_KEY, seq);
  return code;
}

export function listOpsBranchRecords(options?: {
  includeInactive?: boolean;
}): OpsBranchRecord[] {
  const stored = readJson<OpsBranchRecord[] | null>(BRANCHES_KEY, null);
  let all: OpsBranchRecord[] = [];
  if (stored && stored.length > 0) {
    all = stored.map(normalizeBranch).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  } else if (isSupabaseConfigured() && !isDemoMode()) {
    // Cloud mode: never invent demo branches; hydrate owns empty/remote truth.
    all = [];
  } else {
    const seeded = seedBranches();
    if (typeof window !== "undefined") {
      writeJson(BRANCHES_KEY, seeded);
    }
    all = seeded;
  }

  if (options?.includeInactive) return all;
  return all.filter((item) => item.isActive !== false);
}

export function getOpsBranch(id: string) {
  return listOpsBranchRecords({ includeInactive: true }).find((item) => item.id === id) ?? null;
}

export function listBranchOptions() {
  return listOpsBranchRecords().map((item) => ({
    id: item.id,
    name: item.isServiceCenter ? `${item.name} (مركز صيانة)` : item.name,
    city: item.city,
    code: item.code,
    isServiceCenter: item.isServiceCenter,
  }));
}

export function listServiceCenters() {
  return listOpsBranchRecords().filter((item) => item.isServiceCenter);
}

export function createOpsBranch(input: {
  name: string;
  city: string;
  isServiceCenter?: boolean;
}): { ok: true; branch: OpsBranchRecord } | { ok: false; error: string } {
  const name = input.name.trim();
  const city = input.city.trim();
  if (!name) return { ok: false, error: "اسم الفرع إلزامي." };
  if (!city) return { ok: false, error: "المدينة إلزامية." };

  const all = listOpsBranchRecords({ includeInactive: true });
  if (all.some((item) => item.name === name && item.city === city)) {
    return { ok: false, error: "يوجد فرع بنفس الاسم والمدينة." };
  }

  const now = new Date().toISOString();
  const isServiceCenter = Boolean(input.isServiceCenter);
  const branch: OpsBranchRecord = {
    id: crypto.randomUUID(),
    name,
    city,
    code: nextCode(isServiceCenter),
    isServiceCenter,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const next = [branch, ...all];
  writeJson(BRANCHES_KEY, next);
  schedulePersist(next);
  return { ok: true, branch };
}

export function updateOpsBranch(
  id: string,
  input: { name: string; city: string; isServiceCenter?: boolean },
): { ok: true; branch: OpsBranchRecord } | { ok: false; error: string } {
  const name = input.name.trim();
  const city = input.city.trim();
  if (!name) return { ok: false, error: "اسم الفرع إلزامي." };
  if (!city) return { ok: false, error: "المدينة إلزامية." };

  const all = listOpsBranchRecords({ includeInactive: true });
  const existing = all.find((item) => item.id === id);
  if (!existing) return { ok: false, error: "الفرع غير موجود." };
  if (all.some((item) => item.id !== id && item.name === name && item.city === city)) {
    return { ok: false, error: "يوجد فرع بنفس الاسم والمدينة." };
  }

  const nextBranch: OpsBranchRecord = {
    ...existing,
    name,
    city,
    isServiceCenter: Boolean(input.isServiceCenter),
    updatedAt: new Date().toISOString(),
  };

  const next = all.map((item) => (item.id === id ? nextBranch : item));
  writeJson(BRANCHES_KEY, next);
  schedulePersist(next);
  return { ok: true, branch: nextBranch };
}

export function setOpsBranchActive(
  id: string,
  isActive: boolean,
): { ok: true; branch: OpsBranchRecord } | { ok: false; error: string } {
  const all = listOpsBranchRecords({ includeInactive: true });
  const existing = all.find((item) => item.id === id);
  if (!existing) return { ok: false, error: "الفرع غير موجود." };

  const nextBranch: OpsBranchRecord = {
    ...existing,
    isActive,
    updatedAt: new Date().toISOString(),
  };
  const next = all.map((item) => (item.id === id ? nextBranch : item));
  writeJson(BRANCHES_KEY, next);
  schedulePersist(next);
  return { ok: true, branch: nextBranch };
}

/** @deprecated Use setOpsBranchActive(false) — hard delete removed to preserve history. */
export function deleteOpsBranch(id: string): { ok: true } | { ok: false; error: string } {
  const result = setOpsBranchActive(id, false);
  if (!result.ok) return result;
  return { ok: true };
}

/**
 * Bulk import helper: match by code (preferred) or name+city, then create/update.
 * Optional custom code on create when unique; otherwise auto-generated.
 */
export function upsertOpsBranchFromImport(input: {
  name: string;
  city: string;
  code?: string | null;
  isServiceCenter?: boolean;
  isActive?: boolean;
}):
  | { ok: true; branch: OpsBranchRecord; created: boolean }
  | { ok: false; error: string } {
  const name = input.name.trim();
  const city = input.city.trim();
  const code = (input.code ?? "").trim();
  if (!name) return { ok: false, error: "اسم الفرع إلزامي." };
  if (!city) return { ok: false, error: "المدينة إلزامية." };

  const all = listOpsBranchRecords({ includeInactive: true });
  const isServiceCenter = Boolean(input.isServiceCenter);
  const isActive = input.isActive !== false;

  let existing =
    (code ? all.find((item) => item.code === code) : undefined) ??
    all.find((item) => item.name === name && item.city === city);

  if (existing) {
    if (
      all.some(
        (item) =>
          item.id !== existing!.id && item.name === name && item.city === city,
      )
    ) {
      return { ok: false, error: "يوجد فرع بنفس الاسم والمدينة." };
    }
    const nextBranch: OpsBranchRecord = {
      ...existing,
      name,
      city,
      isServiceCenter,
      isActive,
      updatedAt: new Date().toISOString(),
    };
    const next = all.map((item) => (item.id === existing!.id ? nextBranch : item));
    writeJson(BRANCHES_KEY, next);
    schedulePersist(next);
    return { ok: true, branch: nextBranch, created: false };
  }

  if (code && all.some((item) => item.code === code)) {
    return { ok: false, error: `كود الفرع مستخدم مسبقًا: ${code}` };
  }
  if (all.some((item) => item.name === name && item.city === city)) {
    return { ok: false, error: "يوجد فرع بنفس الاسم والمدينة." };
  }

  const now = new Date().toISOString();
  const branch: OpsBranchRecord = {
    id: crypto.randomUUID(),
    name,
    city,
    code: code || nextCode(isServiceCenter),
    isServiceCenter,
    isActive,
    createdAt: now,
    updatedAt: now,
  };
  const next = [branch, ...all];
  writeJson(BRANCHES_KEY, next);
  schedulePersist(next);
  return { ok: true, branch, created: true };
}
