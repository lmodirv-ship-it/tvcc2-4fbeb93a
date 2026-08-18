/** Site-management tools exposed to AI models. Executed with the caller's RLS-scoped client. */
export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mutating?: boolean;
};

export const AI_TOOLS: ToolDef[] = [
  {
    name: "list_websites",
    description: "قائمة المواقع المملوكة للمستخدم مع الحالة والنطاق. يدعم البحث والحد.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string" },
        status: { type: "string", enum: ["online", "offline", "warning", "pending"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_website",
    description: "تفاصيل موقع واحد عبر المعرّف أو النطاق.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, domain: { type: "string" } },
    },
  },
  {
    name: "update_website",
    description: "تحديث بيانات موقع (الاسم، الوصف، الحالة، التفعيل، السيرفر).",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["online", "offline", "warning", "pending"] },
        is_active: { type: "boolean" },
        server_id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_website",
    description: "إضافة موقع جديد إلى لوحة التحكم.",
    mutating: true,
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, domain: { type: "string" }, description: { type: "string" } },
      required: ["name", "domain"],
    },
  },
  {
    name: "list_servers",
    description: "قائمة السيرفرات مع آخر حالة معروفة وموارد النظام.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_server_status",
    description: "حالة سيرفر محدد مع آخر قراءة موارد والمواقع المستضافة عليه.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "dashboard_stats",
    description: "إحصائيات عامة: عدد المواقع، الحالات، النطاقات القريبة من الانتهاء، السيرفرات.",
    parameters: { type: "object", properties: {} },
  },
];

export async function runTool(
  sb: any,
  userId: string,
  name: string,
  args: Record<string, any>,
  allowWrites: boolean,
): Promise<unknown> {
  const def = AI_TOOLS.find((t) => t.name === name);
  if (!def) return { error: `أداة غير معروفة: ${name}` };
  if (def.mutating && !allowWrites) {
    return { error: "هذه العملية تُعدّل البيانات وتحتاج تأكيد المستخدم. فعّل «السماح بالتعديل» أولاً." };
  }

  switch (name) {
    case "list_websites": {
      let q = sb.from("websites").select("id, name, domain, status, is_active, verified, server_id").limit(
        Math.min(Number(args.limit) || 50, 200),
      );
      if (args.search) q = q.or(`name.ilike.%${args.search}%,domain.ilike.%${args.search}%`);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      return error ? { error: error.message } : { websites: data };
    }
    case "get_website": {
      let q = sb.from("websites").select("*").limit(1);
      q = args.id ? q.eq("id", args.id) : q.eq("domain", args.domain);
      const { data, error } = await q.maybeSingle();
      return error ? { error: error.message } : { website: data };
    }
    case "update_website": {
      const patch: Record<string, unknown> = {};
      for (const k of ["name", "description", "status", "is_active", "server_id"]) {
        if (args[k] !== undefined) patch[k] = args[k];
      }
      const { error } = await sb.from("websites").update(patch).eq("id", args.id);
      return error ? { error: error.message } : { ok: true, updated: patch };
    }
    case "create_website": {
      const { data, error } = await sb
        .from("websites")
        .insert({
          owner_id: userId,
          name: args.name,
          domain: args.domain,
          description: args.description ?? null,
          verify_code: `tvcc-${Math.random().toString(36).slice(2, 12)}`,
        })
        .select("id, name, domain")
        .maybeSingle();
      return error ? { error: error.message } : { website: data };
    }
    case "list_servers": {
      const { data, error } = await sb
        .from("servers")
        .select("id, name, hostname, status, os, last_seen_at, provider, region");
      return error ? { error: error.message } : { servers: data };
    }
    case "get_server_status": {
      const [{ data: server }, { data: metrics }, { data: sites }] = await Promise.all([
        sb.from("servers").select("*").eq("id", args.id).maybeSingle(),
        sb
          .from("server_metrics")
          .select("*")
          .eq("server_id", args.id)
          .order("collected_at", { ascending: false })
          .limit(1),
        sb.from("websites").select("id, name, domain, status").eq("server_id", args.id),
      ]);
      return { server, latest_metrics: metrics?.[0] ?? null, websites: sites ?? [] };
    }
    case "dashboard_stats": {
      const [{ data: sites }, { data: servers }, { data: domains }] = await Promise.all([
        sb.from("websites").select("id, status, is_active"),
        sb.from("servers").select("id, status"),
        sb.from("domains").select("id, domain, expires_at"),
      ]);
      const soon = (domains ?? []).filter(
        (d: any) => d.expires_at && new Date(d.expires_at).getTime() - Date.now() < 30 * 864e5,
      );
      return {
        websites_total: sites?.length ?? 0,
        websites_online: (sites ?? []).filter((s: any) => s.status === "online").length,
        websites_offline: (sites ?? []).filter((s: any) => s.status === "offline").length,
        servers_total: servers?.length ?? 0,
        servers_online: (servers ?? []).filter((s: any) => s.status === "online").length,
        domains_expiring_30d: soon.map((d: any) => ({ domain: d.domain, expires_at: d.expires_at })),
      };
    }
    default:
      return { error: "غير مدعوم" };
  }
}
