import { isDemoMode } from "@/lib/auth";
import { pushClientStore } from "@/lib/supabase/client-store";
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

function seedBranches(): OpsBranchRecord[] {
  return [
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      name: "فرع الرياض",
      city: "الرياض",
      code: "BR-0001",
      isServiceCenter: false,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
      name: "فرع جدة",
      city: "جدة",
      code: "BR-0002",
      isServiceCenter: false,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
      name: "مركز الصيانة الرئيسي",
      city: "الرياض",
      code: "SC-0001",
      isServiceCenter: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  ];
}

function schedulePersist(branches: OpsBranchRecord[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushClientStore("ops_branches", branches);
}

/** Raw localStorage read (no seed write). Used by Supabase hydrate. */
export function listOpsBranchRecordsLocal(): OpsBranchRecord[] {
  return readJson<OpsBranchRecord[]>(BRANCHES_KEY, []);
}

export function replaceOpsBranchRecords(branches: OpsBranchRecord[]) {
  if (typeof window === "undefined") return;
  writeJson(BRANCHES_KEY, branches);
}

export function applyRemoteBranches(branches: OpsBranchRecord[]) {
  replaceOpsBranchRecords(
    [...branches].sort((a, b) => a.name.localeCompare(b.name, "ar")),
  );
}

function nextCode(isServiceCenter: boolean) {
  const prefix = isServiceCenter ? "SC" : "BR";
  const existing = listOpsBranchRecords()
    .map((item) => item.code)
    .filter((code) => code.startsWith(`${prefix}-`));
  let max = 0;
  for (const code of existing) {
    const num = Number(code.split("-")[1]);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  let seq = Math.max(max, readJson<number>(BRANCH_SEQ_KEY, 0));
  let code = "";
  const used = new Set(listOpsBranchRecords().map((item) => item.code));
  do {
    seq += 1;
    code = `${prefix}-${String(seq).padStart(4, "0")}`;
  } while (used.has(code));
  writeJson(BRANCH_SEQ_KEY, seq);
  return code;
}

export function listOpsBranchRecords(): OpsBranchRecord[] {
  const stored = readJson<OpsBranchRecord[] | null>(BRANCHES_KEY, null);
  if (!stored || stored.length === 0) {
    const seeded = seedBranches();
    if (typeof window !== "undefined") {
      writeJson(BRANCHES_KEY, seeded);
      // In Supabase mode, hydrate may replace this; still persist seed if remote empty.
      if (isSupabaseConfigured() && !isDemoMode()) {
        schedulePersist(seeded);
      }
    }
    return seeded;
  }
  return [...stored].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function getOpsBranch(id: string) {
  return listOpsBranchRecords().find((item) => item.id === id) ?? null;
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

  const all = listOpsBranchRecords();
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

  const all = listOpsBranchRecords();
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

export function deleteOpsBranch(id: string): { ok: true } | { ok: false; error: string } {
  const all = listOpsBranchRecords();
  if (!all.some((item) => item.id === id)) return { ok: false, error: "الفرع غير موجود." };
  const next = all.filter((item) => item.id !== id);
  writeJson(BRANCHES_KEY, next);
  schedulePersist(next);
  return { ok: true };
}
