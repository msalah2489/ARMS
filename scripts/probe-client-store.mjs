import fs from "fs";

function loadEnv(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function isValidAnonJwt(key) {
  const k = (key || "").trim();
  if (!k.startsWith("eyJ")) return false;
  if (k.split(".").length !== 3) return false;
  if (k.length < 100) return false;
  return true;
}

const env = { ...loadEnv(".env.example"), ...loadEnv(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_KEY ||
  "";
const service = env.SUPABASE_SERVICE_ROLE_KEY || "";
const demo = env.NEXT_PUBLIC_USE_DEMO ?? "(unset)";

let urlHost = null;
try {
  urlHost = url ? new URL(url).host : null;
} catch {
  urlHost = "invalid";
}

console.log(
  JSON.stringify(
    {
      hasUrl: Boolean(url),
      hasAnon: Boolean(anon),
      hasService: Boolean(service),
      anonLooksLikeJwt: isValidAnonJwt(anon),
      serviceLooksLikeJwt: isValidAnonJwt(service),
      demo,
      urlHost,
      keyLens: { anon: anon.length, service: service.length },
    },
    null,
    2,
  ),
);

if (!url) {
  console.log(JSON.stringify({ probe: "skipped", reason: "missing url" }));
  process.exit(0);
}

if (!isValidAnonJwt(anon) && !isValidAnonJwt(service)) {
  console.log(
    JSON.stringify({
      probe: "skipped",
      reason:
        "No valid classic anon/service JWT in .env.local (must start with eyJ, length >= 100). Short sb_publishable_ keys cause 401.",
    }),
  );
  process.exit(2);
}

async function fetchStore(label, key) {
  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/arms_client_store?select=store_key,updated_at,payload`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  const text = await res.text();
  let rows = null;
  try {
    rows = JSON.parse(text);
  } catch {
    rows = null;
  }
  return { label, ok: res.ok, status: res.status, rows, bodyPreview: String(text).slice(0, 200) };
}

const attempts = [];
if (isValidAnonJwt(anon)) attempts.push(await fetchStore("anon", anon));
if ((!attempts[0] || !attempts[0].ok) && isValidAnonJwt(service)) {
  attempts.push(await fetchStore("service", service));
}

const res = attempts.find((a) => a.ok) || attempts[attempts.length - 1];
if (!res?.ok) {
  console.log(
    JSON.stringify({
      probe: "error",
      attempts: attempts.map((a) => ({
        label: a.label,
        status: a.status,
        bodyPreview: a.bodyPreview,
      })),
    }),
  );
  process.exit(1);
}

const summary = (Array.isArray(res.rows) ? res.rows : []).map((row) => {
  const payload = row.payload;
  let kind = typeof payload;
  let count = null;
  let sampleRequestNumbers = [];
  if (Array.isArray(payload)) {
    kind = "array";
    count = payload.length;
    if (row.store_key === "maintenance_requests") {
      sampleRequestNumbers = payload
        .slice(0, 8)
        .map((r) => r?.requestNumber || r?.request_number || r?.id || "?");
    }
  } else if (payload && typeof payload === "object") {
    kind = "object";
    count = Object.keys(payload).length;
  }
  return {
    store_key: row.store_key,
    updated_at: row.updated_at,
    payloadKind: kind,
    count,
    sampleRequestNumbers,
  };
});

const maintenance = summary.find((r) => r.store_key === "maintenance_requests");
console.log(
  JSON.stringify(
    {
      probe: "ok",
      rowCount: summary.length,
      keys: summary.map((r) => r.store_key),
      maintenance_requests: maintenance || null,
      all: summary,
    },
    null,
    2,
  ),
);
