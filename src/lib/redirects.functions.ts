import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Redirects hub used by the domains page: domain→domain, domain→port, port→port. */

async function queue(
  sb: any,
  ownerId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  dryRun?: boolean,
) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      action,
      args,
      dry_run: dryRun ?? false,
      requested_by: ownerId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

async function logOp(
  sb: any,
  ownerId: string,
  operation: string,
  title: string,
  input: Record<string, unknown>,
  serverId?: string | null,
) {
  await sb.from("operation_log").insert({
    owner_id: ownerId,
    scope: "domains",
    server_id: serverId ?? null,
    operation,
    title,
    input,
    result: {},
    status: "queued",
    actor: ownerId,
  });
}

export const listRedirects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: rows }, { data: servers }] = await Promise.all([
      sb.from("domain_redirects").select("*").order("created_at", { ascending: false }),
      sb.from("servers").select("id, name, hostname, public_ip").order("name"),
    ]);
    return { redirects: rows ?? [], servers: servers ?? [] };
  });

/** Preview or apply a redirect. Returns the generated config/command for preview. */
export const saveRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; source: string; target: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { classify, resolveMode, buildRedirectConf } = await import("./redirects.server");
    const { buildProxyConf, proxyConfPath } = await import("./mesh.server");

    const src = classify(data.source);
    const dst = classify(data.target);
    if (!src) throw new Error("قيمة «من» غير صالحة — أدخل نطاقاً أو رقم منفذ");
    if (!dst) throw new Error("قيمة «إلى» غير صالحة — أدخل نطاقاً أو رقم منفذ");

    const mode = resolveMode(src.kind, dst.kind);
    if (!mode) throw new Error("لا يمكن توجيه منفذ إلى نطاق مباشرة — حدّد نطاق مصدر بدل المنفذ");
    if (!data.serverId) throw new Error("اختر السيرفر الذي سيُنفَّذ عليه التوجيه");

    const sb = context.supabase as any;
    let preview = "";
    const commands: string[] = [];

    if (mode === "redirect_301" || mode === "proxy") {
      const content =
        mode === "redirect_301"
          ? buildRedirectConf(src.value, dst.value)
          : buildProxyConf(src.value, Number(dst.value));
      const path = proxyConfPath(src.value);
      preview = `# ${path}\n${content}`;
      commands.push("write_config", "nginx_test", "nginx_reload");
      if (!data.dryRun) {
        await queue(sb, context.userId, data.serverId, "write_config", { path, content });
        await queue(sb, context.userId, data.serverId, "nginx_test", {});
        await queue(sb, context.userId, data.serverId, "nginx_reload", {});
      }
    } else {
      const args = {
        name: `tvcc-redirect-${src.value}`,
        local_port: Number(src.value),
        target_host: "127.0.0.1",
        target_port: Number(dst.value),
        kind: "tcp",
      };
      preview = `socat TCP-LISTEN:${src.value},fork TCP:127.0.0.1:${dst.value}`;
      commands.push("port_forward");
      if (!data.dryRun) await queue(sb, context.userId, data.serverId, "port_forward", args);
    }

    if (data.dryRun) return { ok: true, dryRun: true, mode, preview, commands, id: null as string | null };

    const { data: row, error } = await sb
      .from("domain_redirects")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        source: src.value,
        source_kind: src.kind,
        target: dst.value,
        target_kind: dst.kind,
        mode,
        status: "applying",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await logOp(sb, context.userId, "redirect_create", `توجيه ${src.value} → ${dst.value}`, { source: src.value, target: dst.value, mode }, data.serverId);
    return { ok: true, dryRun: false, mode, preview, commands, id: row?.id as string | null };
  });

export const checkRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row } = await sb.from("domain_redirects").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("السجل غير موجود");
    if (!row.server_id) throw new Error("لا يوجد سيرفر مرتبط");

    if (row.mode === "tcp_bridge") {
      await queue(sb, context.userId, row.server_id, "port_check", { host: "127.0.0.1", port: Number(row.target) });
    } else if (row.mode === "proxy") {
      await queue(sb, context.userId, row.server_id, "port_check", { host: "127.0.0.1", port: Number(row.target) });
    } else {
      await queue(sb, context.userId, row.server_id, "nginx_test", {});
    }
    await sb.from("domain_redirects").update({ last_checked_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

export const deleteRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row } = await sb.from("domain_redirects").select("*").eq("id", data.id).maybeSingle();
    if (row?.server_id && row.source_kind === "domain") {
      const { proxyConfPath } = await import("./mesh.server");
      const { buildDisabledConf } = await import("./redirects.server");
      await queue(sb, context.userId, row.server_id, "write_config", {
        path: proxyConfPath(row.source),
        content: buildDisabledConf(row.source),
      });
      await queue(sb, context.userId, row.server_id, "nginx_reload", {});
    }
    const { error } = await sb.from("domain_redirects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logOp(sb, context.userId, "redirect_delete", `حذف توجيه ${row?.source ?? ""}`, { id: data.id }, row?.server_id ?? null);
    return { ok: true };
  });
