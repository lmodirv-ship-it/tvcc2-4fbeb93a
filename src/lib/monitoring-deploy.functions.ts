import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminOrOwner } from "./roles.server";

async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdminOrOwner(supabase, userId))) throw new Error("هذه العملية متاحة للمالك والمدير فقط");
}

function platformUrl() {
  return process.env["TVCC_PUBLIC_URL"] || "https://tvcc.hnpay.live";
}

async function queueCommand(sb: any, userId: string, serverId: string, action: string, args: Record<string, unknown>) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({ server_id: serverId, action, args, status: "pending", owner_id: userId, requested_by: userId, dry_run: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function logEvent(
  sb: any,
  userId: string,
  row: { website_id?: string | null; server_id?: string | null; event_type: string; message: string; status?: string; metadata?: any },
) {
  await sb.from("monitoring_events").insert({
    owner_id: userId,
    website_id: row.website_id ?? null,
    server_id: row.server_id ?? null,
    event_type: row.event_type,
    message: row.message,
    status: row.status ?? "info",
    metadata: row.metadata ?? {},
  });
}

/** يرسل برنامج السيرفر الموحّد إلى الوكيل المثبّت: تحديث ذاتي + تهيئة البيئة. */
export const deployServerProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context as any;
    await assertAdmin(sb, userId);

    const { data: server } = await sb.from("servers").select("id,name,hostname").eq("id", data.serverId).maybeSingle();
    if (!server) throw new Error("السيرفر غير موجود");

    const secret = process.env["SERVERS_INGEST_SECRET"];
    if (!secret) throw new Error("مفتاح السيرفرات غير مهيأ");
    const { deriveAgentToken } = await import("./agent-token");
    const token = deriveAgentToken(secret, server.id);
    const origin = platformUrl();

    const updateId = await queueCommand(sb, userId, server.id, "agent_self_update", {
      url: `${origin}/api/public/servers/agent?id=${server.id}&token=${token}`,
      reason: "monitoring_deploy",
    });
    const configId = await queueCommand(sb, userId, server.id, "agent_config_set", {
      platform_url: origin,
      heartbeat_seconds: 60,
      prepare_environment: true,
    });

    await logEvent(sb, userId, {
      server_id: server.id,
      event_type: "server_program_deploy",
      message: `أُرسل برنامج السيرفر إلى الوكيل على ${server.name ?? server.hostname}`,
      status: "queued",
      metadata: { updateId, configId },
    });

    return { ok: true, updateId, configId };
  });

async function buildSitePayload(sb: any, userId: string, websiteId: string) {
  const secret = process.env["SITE_AGENT_SECRET"];
  if (!secret) throw new Error("مفتاح برامج المواقع غير مهيأ");

  const { data: website } = await sb
    .from("websites")
    .select("id,name,domain,site_code,server_id")
    .eq("id", websiteId)
    .maybeSingle();
  if (!website) throw new Error("الموقع غير موجود");
  if (!website.server_id) throw new Error("الموقع غير مرتبط بسيرفر — اربطه بسيرفر أولاً");

  const { deriveSiteKey, hashSiteKey } = await import("./site-agent.server");
  const { buildSiteAgentPhp, buildBadgeSnippet } = await import("./site-agent-script.server");
  const { siteRoot } = await import("./runtime.server");

  const siteKey = deriveSiteKey(secret, website.id);
  const siteCode = website.site_code || website.domain;
  const opts = { platformUrl: platformUrl(), siteCode, siteKey };
  const root = siteRoot(website.domain);

  const { data: existing } = await sb.from("site_agents").select("id").eq("website_id", website.id).maybeSingle();
  if (!existing) {
    await sb.from("site_agents").insert({
      owner_id: userId,
      website_id: website.id,
      server_id: website.server_id,
      key_hash: hashSiteKey(siteKey),
      status: "pending",
    });
  }

  return {
    website,
    root,
    files: [
      { path: `${root}/tvcc-site.php`, content: buildSiteAgentPhp(opts) },
      { path: `${root}/tvcc-badge.html`, content: buildBadgeSnippet(opts) },
    ],
  };
}

/** ينشر برنامج الموقع إلى جذر الموقع على السيرفر المضيف عبر الوكيل. */
export const deploySiteProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context as any;
    await assertAdmin(sb, userId);

    const { website, root, files } = await buildSitePayload(sb, userId, data.websiteId);
    const ids: string[] = [];
    for (const f of files) {
      ids.push(await queueCommand(sb, userId, website.server_id, "fs_write", { path: f.path, content: f.content, mode: "644" }));
    }

    await sb.from("site_agents").update({ status: "deploying" }).eq("website_id", website.id);
    await logEvent(sb, userId, {
      website_id: website.id,
      server_id: website.server_id,
      event_type: "site_program_deploy",
      message: `أُرسل برنامج الموقع إلى ${root}`,
      status: "queued",
      metadata: { commands: ids },
    });

    return { ok: true, commands: ids, root };
  });

/** نشر جماعي لبرنامج الموقع على كل مواقع سيرفر (أو كل المواقع المرتبطة بسيرفر). */
export const deployAllSitePrograms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId?: string | null; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context as any;
    await assertAdmin(sb, userId);

    let q = sb.from("websites").select("id,server_id").not("server_id", "is", null).limit(Math.min(data.limit ?? 200, 500));
    if (data.serverId) q = q.eq("server_id", data.serverId);
    const { data: sites } = await q;

    let sent = 0;
    const failed: string[] = [];
    for (const w of sites ?? []) {
      try {
        const { website, files } = await buildSitePayload(sb, userId, w.id);
        for (const f of files) {
          await queueCommand(sb, userId, website.server_id, "fs_write", { path: f.path, content: f.content, mode: "644" });
        }
        sent++;
      } catch {
        failed.push(w.id);
      }
    }

    await logEvent(sb, userId, {
      server_id: data.serverId ?? null,
      event_type: "site_program_deploy_bulk",
      message: `نشر جماعي لبرنامج الموقع: ${sent} موقع`,
      status: failed.length ? "partial" : "queued",
      metadata: { sent, failed: failed.length },
    });

    return { sent, failed: failed.length, total: (sites ?? []).length };
  });

/** يتحقّق من رمز الربط في DNS لاسم النطاق. */
export const verifySiteLinkRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context as any;
    await assertAdmin(sb, userId);

    const { data: website } = await sb
      .from("websites")
      .select("id,domain,site_code")
      .eq("id", data.websiteId)
      .maybeSingle();
    if (!website) throw new Error("الموقع غير موجود");

    const expected = `tvcc-link=${website.site_code || website.domain}`;
    let verified = false;
    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(website.domain)}&type=TXT`, {
        headers: { accept: "application/json" },
      });
      const json: any = await res.json();
      verified = (json?.Answer ?? []).some((a: any) => String(a.data ?? "").replace(/"/g, "").trim() === expected);
    } catch {
      verified = false;
    }

    await logEvent(sb, userId, {
      website_id: website.id,
      event_type: "dns_link_verify",
      message: verified ? "رمز الربط موجود في DNS" : `رمز الربط غير موجود — أضف سجل TXT بالقيمة ${expected}`,
      status: verified ? "ok" : "warning",
      metadata: { expected },
    });

    return { verified, expected, domain: website.domain };
  });

/** آخر أحداث المراقبة. */
export const listMonitoringEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase: sb, userId } = context as any;
    await assertAdmin(sb, userId);
    const { data } = await sb
      .from("monitoring_events")
      .select("id,website_id,server_id,event_type,message,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

/** يسجّل نسخ TVCC كعُقد ويُنشئ روابط مشفّرة بين كل نسخة والأخرى (إضافة فقط). */
export const registerTvccMesh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase: sb, userId } = context as any;
    await assertAdmin(sb, userId);

    const { fingerprint, deriveEntityKey } = await import("./monitoring-keys.server");
    const { data: shared } = await sb
      .from("monitoring_keys")
      .select("fingerprint")
      .eq("key_type", "shared")
      .order("rotated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!shared?.fingerprint) throw new Error("أنشئ المفتاح المشترك أولاً من تبويب المفاتيح");

    const [{ data: servers }, { data: nodes }] = await Promise.all([
      sb.from("servers").select("id,name,hostname,status,last_seen_at"),
      sb.from("tvcc_nodes").select("id,server_id,node_code"),
    ]);

    const byServer = new Map((nodes ?? []).map((n: any) => [n.server_id, n]));
    const created: any[] = [];
    for (const s of servers ?? []) {
      if (byServer.has(s.id)) continue;
      created.push({
        owner_id: userId,
        server_id: s.id,
        node_code: `N-${String(s.id).slice(0, 8)}`,
        label: s.name ?? s.hostname,
        base_url: s.hostname ? `https://${s.hostname}` : null,
        key_fingerprint: fingerprint(deriveEntityKey(shared.fingerprint, "server", s.id)),
        status: s.status === "online" ? "linked" : "pending",
      });
    }
    if (created.length) await sb.from("tvcc_nodes").insert(created);

    const { data: allNodes } = await sb.from("tvcc_nodes").select("id");
    const { data: links } = await sb.from("tvcc_node_links").select("source_node_id,target_node_id");
    const known = new Set((links ?? []).map((l: any) => `${l.source_node_id}|${l.target_node_id}`));
    const list = allNodes ?? [];
    const newLinks: any[] = [];
    for (const a of list) {
      for (const b of list) {
        if (a.id === b.id || known.has(`${a.id}|${b.id}`)) continue;
        newLinks.push({
          owner_id: userId,
          source_node_id: a.id,
          target_node_id: b.id,
          link_type: "mesh",
          status: "pending",
          key_fingerprint: fingerprint(deriveEntityKey(shared.fingerprint, "server", `${a.id}:${b.id}`)),
        });
      }
    }
    for (let i = 0; i < newLinks.length; i += 200) {
      await sb.from("tvcc_node_links").insert(newLinks.slice(i, i + 200));
    }

    return { nodes: list.length, newNodes: created.length, newLinks: newLinks.length };
  });
