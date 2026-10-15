/**
 * ARMS Web Push sender (Supabase Edge Function).
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT          (e.g. mailto:admin@example.com)
 *
 * Auto-provided by Supabase:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (preferred) or SUPABASE_ANON_KEY
 *
 * Invoke from the static Pages client after creating an in-app notification.
 * Never put VAPID_PRIVATE_KEY in Next.js / GitHub Pages env.
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

/** Broad allow-list so browser preflight from GitHub Pages succeeds. */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type AudienceType = "all" | "role" | "user";

type PushBody = {
  notificationId?: string;
  title?: string;
  body?: string;
  audienceType?: AudienceType;
  audienceRole?: string | null;
  audienceUserId?: string | null;
  url?: string;
};

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    "";
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or service/anon key in function env.");
  }
  return createClient(url, key);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const vapidPublic = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
  const vapidPrivate = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  const vapidSubject = (Deno.env.get("VAPID_SUBJECT") ?? "mailto:arms@local").trim();

  if (!vapidPublic || !vapidPrivate) {
    return jsonResponse(500, {
      ok: false,
      error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets are not set.",
    });
  }

  // Helps confirm Edge secrets match the Pages build public key (first chars only).
  console.log(
    "[send-web-push] vapidPublicPrefix",
    vapidPublic.slice(0, 16),
    "len",
    vapidPublic.length,
  );

  let payload: PushBody;
  try {
    payload = (await req.json()) as PushBody;
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const title = String(payload.title ?? "").trim() || "ARMS";
  const body = String(payload.body ?? "").trim();
  const audienceType: AudienceType =
    payload.audienceType === "role" ||
    payload.audienceType === "user" ||
    payload.audienceType === "all"
      ? payload.audienceType
      : "all";

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const supabase = getAdminClient();

    let userIds: string[] | null = null;

    if (audienceType === "user") {
      const uid = String(payload.audienceUserId ?? "").trim();
      userIds = uid ? [uid] : [];
    } else if (audienceType === "role") {
      const role = String(payload.audienceRole ?? "").trim();
      if (!role) {
        return jsonResponse(400, { ok: false, error: "audienceRole required" });
      }
      // Prefer excluding archived users; fall back if column missing on older DBs.
      let usersQuery = await supabase
        .from("app_users")
        .select("id")
        .eq("role", role)
        .eq("is_active", true)
        .eq("is_archived", false);
      if (usersQuery.error) {
        usersQuery = await supabase
          .from("app_users")
          .select("id")
          .eq("role", role)
          .eq("is_active", true);
        if (usersQuery.error) throw usersQuery.error;
      }
      userIds = (usersQuery.data ?? []).map((u: { id: string }) => String(u.id));
    }

    let query = supabase.from("app_push_subscriptions").select(
      "id, user_id, endpoint, p256dh, auth",
    );
    if (userIds) {
      if (userIds.length === 0) {
        return jsonResponse(200, { ok: true, sent: 0, skipped: "no target users" });
      }
      query = query.in("user_id", userIds);
    }

    const { data: subs, error: subsError } = await query;
    if (subsError) throw subsError;

    const rows = (subs ?? []) as SubRow[];
    if (!rows.length) {
      return jsonResponse(200, { ok: true, sent: 0, skipped: "no subscriptions" });
    }

    const message = JSON.stringify({
      title,
      body,
      url: payload.url ?? "/",
      notificationId: payload.notificationId ?? null,
    });

    let sent = 0;
    const deadIds: string[] = [];
    const failures: Array<{ id: string; status: number; message: string }> = [];

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            message,
            {
              TTL: 60 * 60 * 12,
              urgency: "normal",
            },
          );
          sent += 1;
        } catch (err: unknown) {
          const statusCode =
            err && typeof err === "object" && "statusCode" in err
              ? Number((err as { statusCode?: number }).statusCode)
              : 0;
          const errMessage = err instanceof Error ? err.message : String(err);
          // Gone / expired subscription — clean up.
          if (statusCode === 404 || statusCode === 410) {
            deadIds.push(row.id);
          } else {
            failures.push({ id: row.id, status: statusCode, message: errMessage });
            console.error("[send-web-push] fail", row.id, statusCode, errMessage);
          }
        }
      }),
    );

    if (deadIds.length) {
      await supabase.from("app_push_subscriptions").delete().in("id", deadIds);
    }

    console.log(
      "[send-web-push] done",
      JSON.stringify({
        sent,
        total: rows.length,
        removed: deadIds.length,
        failures: failures.length,
        audienceType,
      }),
    );

    return jsonResponse(200, {
      ok: true,
      sent,
      total: rows.length,
      removed: deadIds.length,
      failures: failures.slice(0, 5),
      vapidPublicPrefix: vapidPublic.slice(0, 16),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-web-push]", message);
    return jsonResponse(500, { ok: false, error: message });
  }
});
