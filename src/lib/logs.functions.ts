import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function safe(promise: any) {
  try {
    const res = await promise;
    return (res?.data ?? []) as Array<Record<string, any>>;
  } catch {
    return [] as Array<Record<string, any>>;
  }
}

export type LogEntry = {
  id: string;
  at: string;
  source: string;
  level: "info" | "success" | "warning" | "error";
  title: string;
  detail: string;
  serverId: string | null;
  websiteId: string | null;
};

function levelFromStatus(status?: string | null): LogEntry["level"] {
  const s = (status ?? "").toLowerCase();
  if (["failed", "error", "offline", "down", "critical"].includes(s)) return "error";
  if (["warning", "degraded", "pending", "queued", "running", "dispatched"].includes(s)) return "warning";
  if (["success", "completed", "done", "online", "up", "sent", "ok"].includes(s)) return "success";
  return "info";
}

/**
 * مركز السجلات الموحّد — قراءة فقط من الجداول القائمة (لا تعديل ولا حذف).
 */
export const getUnifiedLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const lim = 200;

    const [activity, ops, commands, alerts, notifs, storage, health, security, servers, websites] = await Promise.all([
      safe(sb.from("activity_log").select("*").order("created_at", { ascending: false }).limit(lim)),
      safe(sb.from("operation_log").select("*").order("created_at", { ascending: false }).limit(lim)),
      safe(sb.from("server_commands").select("*").order("created_at", { ascending: false }).limit(lim)),
      safe(sb.from("server_alert_history").select("*").order("created_at", { ascending: false }).limit(lim)),
      safe(sb.from("notification_logs").select("*").order("created_at", { ascending: false }).limit(lim)),
      safe(sb.from("storage_events").select("*").order("created_at", { ascending: false }).limit(lim)),
      safe(sb.from("site_health_checks").select("*").order("checked_at", { ascending: false }).limit(lim)),
      safe(sb.from("security_events").select("*").order("created_at", { ascending: false }).limit(lim)),
      safe(sb.from("servers").select("id, name, hostname")),
      safe(sb.from("websites").select("id, name, domain")),
    ]);

    const entries: LogEntry[] = [];

    for (const r of activity) {
      entries.push({
        id: `activity:${r["id"]}`,
        at: r["created_at"],
        source: "activity",
        level: "info",
        title: String(r["action"] ?? "نشاط"),
        detail: [r["entity_type"], r["entity_id"]].filter(Boolean).join(" · "),
        serverId: null,
        websiteId: r["entity_type"] === "website" ? (r["entity_id"] ?? null) : null,
      });
    }

    for (const r of ops) {
      entries.push({
        id: `operation:${r["id"]}`,
        at: r["created_at"],
        source: "operations",
        level: levelFromStatus(r["status"]),
        title: String(r["title"] ?? r["operation"] ?? "عملية"),
        detail: [r["scope"], r["actor"], r["notes"]].filter(Boolean).join(" · "),
        serverId: r["server_id"] ?? null,
        websiteId: r["website_id"] ?? null,
      });
    }

    for (const r of commands) {
      entries.push({
        id: `command:${r["id"]}`,
        at: r["created_at"],
        source: "commands",
        level: levelFromStatus(r["status"]),
        title: `${r["dry_run"] ? "[محاكاة] " : ""}${r["action"]}`,
        detail: [
          r["status"],
          r["exit_code"] != null ? `exit=${r["exit_code"]}` : null,
          r["error_message"],
          typeof r["output"] === "string" ? r["output"].slice(0, 160) : null,
        ]
          .filter(Boolean)
          .join(" · "),
        serverId: r["server_id"] ?? null,
        websiteId: r["website_id"] ?? null,
      });
    }

    for (const r of alerts) {
      entries.push({
        id: `alert:${r["id"]}`,
        at: r["created_at"],
        source: "alerts",
        level: (r["severity"] === "critical" ? "error" : r["severity"] === "warning" ? "warning" : "info") as LogEntry["level"],
        title: String(r["alert_type"] ?? "تنبيه"),
        detail: [r["message"], r["resolved_at"] ? "تمت المعالجة" : null].filter(Boolean).join(" · "),
        serverId: r["server_id"] ?? null,
        websiteId: r["website_id"] ?? null,
      });
    }

    for (const r of notifs) {
      entries.push({
        id: `notify:${r["id"]}`,
        at: r["created_at"],
        source: "notifications",
        level: levelFromStatus(r["status"]),
        title: `إشعار ${r["channel_type"]}`,
        detail: [r["target"], r["error_message"]].filter(Boolean).join(" · "),
        serverId: null,
        websiteId: null,
      });
    }

    for (const r of storage) {
      entries.push({
        id: `storage:${r["id"]}`,
        at: r["created_at"],
        source: "storage",
        level: "info",
        title: String(r["event_kind"] ?? "حدث تخزين"),
        detail: [r["path"], r["size_mb"] != null ? `${r["size_mb"]} MB` : null, r["detail"]].filter(Boolean).join(" · "),
        serverId: r["server_id"] ?? null,
        websiteId: r["website_id"] ?? null,
      });
    }

    for (const r of health) {
      entries.push({
        id: `health:${r["id"]}`,
        at: r["checked_at"],
        source: "health",
        level: levelFromStatus(r["status"]),
        title: `فحص الموقع (${r["status"]})`,
        detail: [
          r["http_status"] != null ? `HTTP ${r["http_status"]}` : null,
          r["response_time_ms"] != null ? `${r["response_time_ms"]}ms` : null,
          r["ssl_valid"] === false ? "SSL غير صالح" : null,
          r["error_message"],
        ]
          .filter(Boolean)
          .join(" · "),
        serverId: null,
        websiteId: r["website_id"] ?? null,
      });
    }

    for (const r of security) {
      entries.push({
        id: `security:${r["id"]}`,
        at: r["created_at"],
        source: "security",
        level: (r["success"] === false
          ? "error"
          : r["severity"] === "critical"
            ? "warning"
            : "info") as LogEntry["level"],
        title: `${r["category"]} · ${r["action"]}`,
        detail: [r["actor_email"], r["resource"], r["resource_id"]].filter(Boolean).join(" · "),
        serverId: r["resource"] === "servers" ? (r["resource_id"] ?? null) : null,
        websiteId: r["resource"] === "websites" ? (r["resource_id"] ?? null) : null,
      });
    }

    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const serverNames: Record<string, string> = {};
    for (const s of servers) serverNames[s["id"]] = s["name"] ?? s["hostname"] ?? "";
    const websiteNames: Record<string, string> = {};
    for (const w of websites) websiteNames[w["id"]] = w["name"] ?? w["domain"] ?? "";

    const counts = entries.reduce(
      (acc, e) => {
        acc.total += 1;
        acc[e.level] += 1;
        return acc;
      },
      { total: 0, info: 0, success: 0, warning: 0, error: 0 } as Record<string, number>,
    );

    return { entries: entries.slice(0, 400), serverNames, websiteNames, counts };
  });
