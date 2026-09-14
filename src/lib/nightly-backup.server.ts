/**
 * منطق النسخ الليلي الكامل لكل موقع مُثبت الملكية إلى وجهة تخزين خارجية.
 * لكل موقع مجلد باسم نطاقه داخل المسار الأساسي، وبداخله:
 *   first/   النسخة الأولى — تُكتب مرة واحدة ولا تُستبدل أبداً.
 *   current/ النسخة الحالية — تُستبدل كل ليلة بنسخة كاملة جديدة.
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
};

export type RunSummary = {
  destination_id: string;
  sites: number;
  queued: number;
  skipped: number;
  details: Array<{ domain: string; kind?: string; status: string; reason?: string }>;
};

const cleanPath = (p: string) => (p || "/srv/tvcc-backups").replace(/\/+$/, "");

export async function runNightlyBackupForDestination(
  admin: any,
  dest: DestinationRow,
): Promise<RunSummary> {
  const base = cleanPath(dest.base_path);
  const summary: RunSummary = {
    destination_id: dest.id,
    sites: 0,
    queued: 0,
    skipped: 0,
    details: [],
  };

  // فقط المواقع المملوكة والمُثبتة ملكيتها عبر سجل TXT في إعدادات DNS
  const { data: sites } = await admin
    .from("websites")
    .select("id, domain, server_id, verified, is_active")
    .eq("owner_id", dest.owner_id)
    .eq("verified", true)
    .order("domain");

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
    if (!site.server_id) {
      summary.skipped += 1;
      summary.details.push({ domain: site.domain, status: "skipped", reason: "no_server" });
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
          server_id: site.server_id,
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
      summary.details.push({ domain: site.domain, kind, status: "queued" });
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
    input: { destination_id: dest.id, base_path: base },
    result: summary,
    status: "success",
    actor: "system",
  });

  return summary;
}
