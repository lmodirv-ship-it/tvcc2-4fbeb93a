import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isManager(sb: any, userId: string) {
  const [{ data: a }, { data: o }] = await Promise.all([
    sb.rpc("has_role", { _user_id: userId, _role: "admin" }),
    sb.rpc("has_role", { _user_id: userId, _role: "system_owner" }),
  ]);
  return Boolean(a || o);
}

function parseUrl(url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return { host: u.hostname, port: u.port ? Number(u.port) : (u.protocol === "https:" ? 443 : 80) };
  } catch {
    return { host: url.replace(/^https?:\/\//, "").split(":")[0], port: 443 };
  }
}

function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function keyBy<T>(arr: T[], key: keyof T): Record<string, T> {
  return arr.reduce((acc, item) => {
    acc[String(item[key])] = item;
    return acc;
  }, {} as Record<string, T>);
}

export const listManara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const manager = await isManager(sb, context.userId);
    const base = manager ? sb.from("manara_projects") : sb.from("manara_projects").eq("owner_id", context.userId);
    const { data: projects, error } = await base
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);

    const projectIds = (projects ?? []).map((p: any) => p.id);
    let updates: any[] = [];
    let events: any[] = [];
    let addresses: any[] = [];
    let endpoints: any[] = [];
    if (projectIds.length) {
      [{ data: updates }, { data: events }, { data: addresses }, { data: endpoints }] = await Promise.all([
        sb.from("manara_updates").select("*").in("project_id", projectIds).order("created_at", { ascending: false }).limit(200),
        sb.from("manara_events").select("*").in("project_id", projectIds).order("created_at", { ascending: false }).limit(100),
        sb.from("manara_addresses").select("*").in("project_id", projectIds),
        sb.from("manara_endpoints").select("*").in("project_id", projectIds),
      ]);
    }

    const addrByProject = groupBy(addresses ?? [], "project_id");
    const epByProject = groupBy(endpoints ?? [], "project_id");
    const addrById = keyBy(addresses ?? [], "id");

    const enriched = (projects ?? []).map((p: any) => ({
      ...p,
      current_address: p.current_address_id ? addrById[p.current_address_id] ?? null : null,
      addresses: addrByProject[p.id] ?? [],
      endpoints: epByProject[p.id] ?? [],
    }));

    if (error) throw new Error(error.message);
    return clean({ projects: enriched, updates: updates ?? [], events: events ?? [], manager });
  });

export const getManaraProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const manager = await isManager(sb, context.userId);
    const { data: project } = await sb
      .from("manara_projects")
      .select("*, current_address:current_address_id(*), addresses:manara_addresses(*), endpoints:manara_endpoints(*)")
      .eq("project_key", data.key)
      .maybeSingle();
    if (!project) throw new Error("المشروع غير موجود");
    if (!manager && project.owner_id !== context.userId) throw new Error("غير مصرح");
    const [{ data: updates }, { data: events }] = await Promise.all([
      sb.from("manara_updates").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(100),
      sb.from("manara_events").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(100),
    ]);
    return { project, updates: updates ?? [], events: events ?? [] };
  });

export const changeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; url: string; kind?: string; serverId?: string | null; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const manager = await isManager(sb, context.userId);
    const { data: project } = await sb.from("manara_projects").select("*").eq("project_key", data.key).single();
    if (!project) throw new Error("المشروع غير موجود");
    if (!manager && project.owner_id !== context.userId) throw new Error("غير مصرح");

    const url = String(data.url || "").trim();
    if (!url) throw new Error("العنوان مطلوب");
    const { host, port } = parseUrl(url);
    const kind = data.kind || "web";

    // إنشاء عنوان جديد كـ pending
    const { data: newAddr } = await sb
      .from("manara_addresses")
      .insert({
        project_id: project.id,
        url: url.startsWith("http") ? url : `https://${url}`,
        host,
        port,
        server_id: data.serverId || null,
        kind,
        is_current: false,
        is_verified: false,
      })
      .select("*")
      .single();
    if (!newAddr) throw new Error("فشل إنشاء العنوان");

    const { data: update } = await sb
      .from("manara_updates")
      .insert({
        project_id: project.id,
        from_address_id: project.current_address_id,
        to_address_id: newAddr.id,
        status: "pending",
        reason: data.reason || "تغيير يدوي",
      })
      .select("*")
      .single();

    await sb.from("manara_events").insert({
      project_id: project.id,
      address_id: newAddr.id,
      kind: "change_started",
      message: `بدء تغيير العنوان إلى ${newAddr.url}`,
    });

    return { address: newAddr, update };
  });

export const verifyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { addressId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: address } = await sb.from("manara_addresses").select("*, project:project_id(*)").eq("id", data.addressId).single();
    if (!address) throw new Error("العنوان غير موجود");
    const manager = await isManager(sb, context.userId);
    if (!manager && address.project.owner_id !== context.userId) throw new Error("غير مصرح");

    let ok = false;
    let fingerprint: string | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(address.url, { method: "GET", redirect: "follow" });
      ok = res.ok;
      const text = await res.text();
      fingerprint = text.includes(address.project.project_key) ? `key:${address.project.project_key}` : null;
      if (!fingerprint) error = "لم تُعثر بصمة المشروع في الرد";
    } catch (e) {
      ok = false;
      error = e instanceof Error ? e.message : "فشل الاتصال";
    }

    await sb
      .from("manara_addresses")
      .update({ is_verified: ok, verified_at: ok ? new Date().toISOString() : null, fingerprint: fingerprint || null })
      .eq("id", address.id);

    await sb.from("manara_events").insert({
      project_id: address.project_id,
      address_id: address.id,
      kind: ok ? "verify_ok" : "verify_fail",
      message: ok ? `تم التحقق من ${address.url}` : `فشل التحقق: ${error}`,
      metadata: { ok, error },
    });

    return { ok, error };
  });

export const publishAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { updateId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: update } = await sb.from("manara_updates").select("*, project:project_id(*), to:to_address_id(*), from:from_address_id(*)").eq("id", data.updateId).single();
    if (!update) throw new Error("عملية التحديث غير موجودة");
    const manager = await isManager(sb, context.userId);
    if (!manager && update.project.owner_id !== context.userId) throw new Error("غير مصرح");

    if (!update.to.is_verified) {
      await sb.from("manara_updates").update({ status: "failed", error: "العنوان غير متحقق" }).eq("id", update.id);
      throw new Error("العنوان الجديد غير متحقق");
    }

    await sb.from("manara_addresses").update({ is_current: false, retired_at: new Date().toISOString() }).eq("project_id", update.project_id);
    await sb.from("manara_addresses").update({ is_current: true, retired_at: null }).eq("id", update.to.id);
    await sb.from("manara_projects").update({ current_address_id: update.to.id }).eq("id", update.project_id);
    await sb
      .from("manara_updates")
      .update({ status: "completed", published_at: new Date().toISOString() })
      .eq("id", update.id);

    await sb.from("manara_events").insert({
      project_id: update.project_id,
      address_id: update.to.id,
      kind: "publish_completed",
      message: `تم نشر العنوان الجديد ${update.to.url}`,
    });

    return { ok: true };
  });

export const rollbackAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { updateId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: update } = await sb.from("manara_updates").select("*, project:project_id(*), from:from_address_id(*)").eq("id", data.updateId).single();
    if (!update || !update.from) throw new Error("لا يوجد عنوان سابق");
    const manager = await isManager(sb, context.userId);
    if (!manager && update.project.owner_id !== context.userId) throw new Error("غير مصرح");

    await sb.from("manara_addresses").update({ is_current: false, retired_at: new Date().toISOString() }).eq("project_id", update.project_id);
    await sb.from("manara_addresses").update({ is_current: true, retired_at: null }).eq("id", update.from.id);
    await sb.from("manara_projects").update({ current_address_id: update.from.id }).eq("id", update.project_id);
    await sb.from("manara_updates").update({ status: "failed", error: "تراجع يدوي" }).eq("id", update.id);

    await sb.from("manara_events").insert({
      project_id: update.project_id,
      address_id: update.from.id,
      kind: "rollback",
      message: `تم التراجع إلى ${update.from.url}`,
    });

    return { ok: true };
  });

export const healRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const manager = await isManager(sb, context.userId);
    const { data: project } = await sb.from("manara_projects").select("*, current_address:current_address_id(*)").eq("project_key", data.key).single();
    if (!project) throw new Error("المشروع غير موجود");
    if (!manager && project.owner_id !== context.userId) throw new Error("غير مصرح");

    const servers = (await sb.from("servers").select("id,name").eq("owner_id", context.userId)).data ?? [];
    const jobs = [];
    for (const server of servers.slice(0, 3)) {
      const { data: cmd } = await sb.from("server_commands").insert({
        owner_id: context.userId,
        server_id: server.id,
        action: "nginx_rewrite",
        args: { domain: project.current_address?.host, target: project.current_address?.url },
        status: "pending",
        requested_by: context.userId,
      }).select("id").single();
      if (cmd) jobs.push(cmd.id);
    }

    await sb.from("manara_events").insert({
      project_id: project.id,
      kind: "heal",
      message: `تم إرسال ${jobs.length} أمر تصحيح توجيه`,
      metadata: { jobs },
    });

    return { jobs };
  });
