/** Site-management tools exposed to AI models. Executed with the caller's RLS-scoped client. */
import { COMMAND_WHITELIST } from "./server-commands";

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

  /* ---------- ملفات السيرفر (عبر الوكيل) ---------- */
  {
    name: "fs_list",
    description: "عرض محتويات مجلد على السيرفر (ls). إن لم يُحدَّد المسار يُستخدم مجلد العمل الافتراضي.",
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" } },
    },
  },
  {
    name: "fs_tree",
    description: "شجرة ملفات مجلد على السيرفر حتى عمق محدد (بدون node_modules/.git).",
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" }, depth: { type: "number" } },
    },
  },
  {
    name: "fs_read",
    description: "قراءة محتوى ملف نصي من السيرفر (حتى عدد أسطر محدد).",
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" }, limit: { type: "number" } },
      required: ["path"],
    },
  },
  {
    name: "fs_search",
    description: "بحث نصي داخل ملفات مجلد على السيرفر (grep).",
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" }, query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "fs_write",
    description: "كتابة أو تعديل ملف على السيرفر (تُحفظ نسخة .tvcc.bak قبل الاستبدال). يتطلب السماح بالتعديل.",
    mutating: true,
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "fs_mkdir",
    description: "إنشاء مجلد على السيرفر. يتطلب السماح بالتعديل.",
    mutating: true,
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "fs_move",
    description: "نقل أو إعادة تسمية ملف/مجلد على السيرفر. يتطلب السماح بالتعديل.",
    mutating: true,
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" }, target: { type: "string" } },
      required: ["path", "target"],
    },
  },
  {
    name: "fs_delete",
    description: "حذف ملف أو مجلد (داخل /home أو /var/www أو /opt/tvcc فقط). يتطلب السماح بالتعديل.",
    mutating: true,
    parameters: {
      type: "object",
      properties: { server_id: { type: "string" }, path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "run_server_command",
    description:
      "تنفيذ أمر مُصرّح به على السيرفر عبر الوكيل (مثل build_run، site_restart، nginx_test، git_deploy). يتطلب السماح بالتعديل.",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        server_id: { type: "string" },
        action: { type: "string" },
        args: { type: "object" },
      },
      required: ["action"],
    },
  },

  /* ---------- تنظيم العمل: المهام ---------- */
  {
    name: "list_tasks",
    description: "قائمة مهام التطوير المسجّلة (يمكن التصفية بالحالة).",
    parameters: {
      type: "object",
      properties: { status: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "create_task",
    description: "إنشاء مهمة تطوير جديدة (عنوان، تعليمات، الملفات المستهدفة، السيرفر/الموقع).",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        instructions: { type: "string" },
        file_paths: { type: "array", items: { type: "string" } },
        server_id: { type: "string" },
        website_id: { type: "string" },
        priority: { type: "number" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "تحديث مهمة: الحالة (pending/running/done/failed) أو النتيجة أو التعليمات.",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        result: { type: "string" },
        instructions: { type: "string" },
      },
      required: ["id"],
    },
  },
];

const FS_ACTIONS = new Set(["fs_list", "fs_tree", "fs_read", "fs_search", "fs_write", "fs_mkdir", "fs_move", "fs_delete"]);

/** Queue an agent command and wait (bounded) for the agent to report back. */
async function agentRun(
  sb: any,
  userId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  waitMs = 40000,
): Promise<unknown> {
  if (!(COMMAND_WHITELIST as readonly string[]).includes(action)) return { error: `أمر غير مسموح: ${action}` };
  const { data: row, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: userId,
      server_id: serverId,
      action,
      args,
      dry_run: false,
      requested_by: userId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };

  const id = row?.id;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const { data: c } = await sb
      .from("server_commands")
      .select("status, output, error_message, exit_code")
      .eq("id", id)
      .maybeSingle();
    if (c && ["done", "success", "failed", "error"].includes(String(c.status))) {
      return {
        command_id: id,
        status: c.status,
        exit_code: c.exit_code,
        output: String(c.output ?? c.error_message ?? "").slice(0, 6000),
      };
    }
  }
  return { command_id: id, status: "pending", note: "الوكيل لم يستجب بعد — أعد الاستعلام لاحقاً بمعرّف الأمر." };
}

export async function runTool(
  sb: any,
  userId: string,
  name: string,
  args: Record<string, any>,
  allowWrites: boolean,
  opts?: { serverId?: string | null; websiteId?: string | null },
): Promise<unknown> {
  const def = AI_TOOLS.find((t) => t.name === name);
  if (!def) return { error: `أداة غير معروفة: ${name}` };
  if (def.mutating && !allowWrites) {
    return { error: "هذه العملية تُعدّل البيانات وتحتاج تأكيد المستخدم. فعّل «السماح بالتعديل» أولاً." };
  }

  if (FS_ACTIONS.has(name) || name === "run_server_command") {
    const serverId = args.server_id || opts?.serverId;
    if (!serverId) return { error: "حدّد السيرفر أولاً (server_id) من لوحة ورشة العمل." };
    if (name === "run_server_command") {
      return agentRun(sb, userId, serverId, String(args.action), (args.args as Record<string, unknown>) ?? {});
    }
    const { server_id: _drop, ...rest } = args;
    return agentRun(sb, userId, serverId, name, rest);
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
