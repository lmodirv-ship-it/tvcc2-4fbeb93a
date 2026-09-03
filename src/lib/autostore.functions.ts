import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * التخزين التلقائي للمواقع على السيرفر:
 * لكل موقع مرتبط بالسيرفر يتم التأكد من وجود مجلده، أخذ لقطة احتياطية،
 * ومزامنتها إلى مسار التخزين المحدد — ثم مزامنة شاملة لحالة الوكيل.
 */

const AUTOSTORE_ACTIONS = ["site_autostore", "autostore_scan", "agent_sync_all"] as const;

export const runAutostore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; storagePath?: string; targetHost?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;

    const { data: server } = await sb
      .from("servers")
      .select("id, name, owner_id")
      .eq("id", data.serverId)
      .maybeSingle();
    if (!server) throw new Error("السيرفر غير موجود أو لا تملك صلاحية الوصول إليه");

    const { data: sites } = await sb
      .from("server_sites")
      .select("website_id, domain, name")
      .eq("server_id", data.serverId);

    const domains = Array.from(
      new Set(
        ((sites ?? []) as Array<{ domain: string | null; name: string | null }>)
          .map((s) => (s.domain || s.name || "").trim())
          .filter(Boolean),
      ),
    );

    const rows: Record<string, unknown>[] = domains.map((domain) => ({
      owner_id: context.userId,
      server_id: data.serverId,
      action: "site_autostore",
      args: {
        domain,
        ...(data.storagePath ? { storage_path: `${data.storagePath.replace(/\/$/, "")}/${domain}` } : {}),
        ...(data.targetHost ? { target_host: data.targetHost } : {}),
      },
      dry_run: false,
      requested_by: context.userId,
      status: "pending",
    }));

    rows.push(
      {
        owner_id: context.userId,
        server_id: data.serverId,
        action: "autostore_scan",
        args: {},
        dry_run: false,
        requested_by: context.userId,
        status: "pending",
      },
      {
        owner_id: context.userId,
        server_id: data.serverId,
        action: "agent_sync_all",
        args: {},
        dry_run: false,
        requested_by: context.userId,
        status: "pending",
      },
    );

    const { error } = await sb.from("server_commands").insert(rows);
    if (error) throw new Error(error.message);

    return { queued: rows.length, domains };
  });

export const getAutostoreStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows } = await (context.supabase as any)
      .from("server_commands")
      .select("id, action, args, status, output, error_message, duration_ms, created_at, completed_at")
      .eq("server_id", data.serverId)
      .in("action", AUTOSTORE_ACTIONS as unknown as string[])
      .order("created_at", { ascending: false })
      .limit(40);
    return rows ?? [];
  });
