/**
 * منطق النسخ الليلي الكامل لكل موقع في المنصة إلى سيرفر التخزين.
 * لكل موقع مجلد باسم نطاقه داخل المسار الأساسي، وبداخله:
 *   first/   النسخة الأولى — تُكتب مرة واحدة ولا تُستبدل أبداً.
 *   current/ النسخة الحالية — تُستبدل كل ليلة بنسخة كاملة جديدة.
 *
 * لا شرط «مُثبت الملكية» ولا شرط «مربوط بسيرفر»: أي موقع في المنصة يُنسخ،
 * والتنفيذ يتم على سيرفر التخزين المخصّص، والمواقع غير المستضافة على سيرفراتك
 * تُنزَّل من مصدرها الحيّ ثم تُحفظ في مجلدها.
 */

export type DestinationRow = {
  id: string;
  owner_id: string;
  name: string;
  host: string;
  username: string;
  port: number;
  base_path: string;
  secret_id: string | null;
  is_enabled: boolean;
  storage_server_id?: string | null;
  scope?: string | null;
};

export type RunSummary = {
  destination_id: string;
  sites: number;
  queued: number;
  skipped: number;
  scope: string;
  storage_server_id: string | null;
  details: Array<{ domain: string; kind?: string; status: string; reason?: string; via?: string }>;
};

const cleanPath = (p: string) => (p || "/srv/tvcc-backups").replace(/\/+$/, "");

/** يحدّد سيرفر التخزين: العمود المخصّص، أو سيرفر يطابق عنوان الوجهة، أو أي سيرفر بوكيل متصل. */
async function resolveStorageServer(admin: any, dest: DestinationRow): Promise<string | null> {
  if (dest.storage_server_id) return dest.storage_server_id;

  const host = String(dest.host ?? "").trim();
  const { data: servers } = await admin
    .from("servers")
    .select("id, hostname, public_ip, private_ip, last_seen_at")
    .eq("owner_id", dest.owner_id)
    .limit(500);

  const list = (servers as any[]) ?? [];
  const match = list.find(
    (s) => s.hostname === host || s.public_ip === host || s.private_ip === host,
  );
  if (match) return match.id;

  const { data: agents } = await admin
    .from("agent_instances")
    .select("server_id, status, last_heartbeat_at")
    .eq("status", "online")
    .order("last_heartbeat_at", { ascending: false })
    .limit(20);
  const ids = new Set(list.map((s) => s.id));
  const online = ((agents as any[]) ?? []).find((a) => ids.has(a.server_id));
  return online?.server_id ?? null;
}

export async function runNightlyBackupForDestination(
  admin: any,
  dest: DestinationRow,
): Promise<RunSummary> {
  const base = cleanPath(dest.base_path);
  const scope = dest.scope === "verified" ? "verified" : "all";
  const storageServerId = await resolveStorageServer(admin, dest);

  const summary: RunSummary = {
    destination_id: dest.id,
    sites: 0,
    queued: 0,
    skipped: 0,
    scope,
    storage_server_id: storageServerId,
    details: [],
  };

  // كل مواقع المالك (أو المُثبتة فقط عندما يكون النطاق verified)
  let q = admin
    .from("websites")
    .select("id, domain, server_id, verified, is_active")
    .eq("owner_id", dest.owner_id)
    .order("domain");
  if (scope === "verified") q = q.eq("verified", true);
  const { data: sites } = await q;

  const list = (sites as any[]) ?? [];
  summary.sites = list.length;

  const { data: existing } = await admin
    .from("site_backup_copies")
    .select("id, website_id, copy_kind, status")
    .eq("destination_id", dest.id);
  const byKey = new Map<string, any>(
    ((existing as any[]) ?? []).map((r) => [`${r.website_id}:${r.copy_kind}`, r]),
  );

  for (const site of list) {
    // سيرفر التنفيذ: سيرفر التخزين المخصّص أولاً، ثم سيرفر الموقع إن وُجد.
    const execServer = storageServerId ?? site.server_id ?? null;
    const via = storageServerId
      ? site.server_id === storageServerId
        ? "storage_server"
        : site.server_id
          ? "storage_server_remote_pull"
          : "storage_server_fetch"
      : "site_server";

    if (!execServer) {
      summary.skipped += 1;
      summary.details.push({
        domain: site.domain,
        status: "skipped",
        reason: "no_storage_server",
      });
      continue;
    }

    const kinds: Array<"first" | "current"> = [];
    const firstRow = byKey.get(`${site.id}:first`);
    if (!firstRow || firstRow.status !== "completed") kinds.push("first");
    kinds.push("current");

    for (const kind of kinds) {
      const remotePath = `${base}/${site.domain}/${kind}`;

      const { data: cmd } = await admin
        .from("server_commands")
        .insert({
          owner_id: dest.owner_id,
          server_id: execServer,
          website_id: site.id,
          action: "site_archive",
          args: {
            domain: site.domain,
            kind,
            remote_path: remotePath,
            target_host: dest.host,
            target_user: dest.username,
            target_port: dest.port ?? 22,
            secret_ref: dest.secret_id ?? null,
            destination_id: dest.id,
            // عندما لا يكون الموقع على هذا السيرفر يُنزَّل من مصدره الحيّ
            fetch_remote: site.server_id !== execServer,
            source_url: `https://${site.domain}`,
          },
          requested_by: dest.owner_id,
          status: "pending",
        })
        .select("id")
        .maybeSingle();

      const row = {
        owner_id: dest.owner_id,
        destination_id: dest.id,
        website_id: site.id,
        domain: site.domain,
        copy_kind: kind,
        remote_path: remotePath,
        status: "pending",
        error_message: null,
        command_id: cmd?.id ?? null,
      };

      await admin
        .from("site_backup_copies")
        .upsert(row, { onConflict: "destination_id,website_id,copy_kind" });

      summary.queued += 1;
      summary.details.push({ domain: site.domain, kind, status: "queued", via });
    }
  }

  await admin
    .from("backup_destinations")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: summary.queued > 0 ? "queued" : "empty",
      last_run_summary: summary,
    })
    .eq("id", dest.id);

  await admin.from("operation_log").insert({
    owner_id: dest.owner_id,
    scope: "backup",
    operation: "nightly_backup",
    title: `نسخ ليلي إلى ${dest.name} — ${summary.queued} مهمة`,
    input: { destination_id: dest.id, base_path: base, scope },
    result: summary,
    status: "success",
    actor: "system",
  });

  return summary;
}
