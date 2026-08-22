import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugName, normalizePath, buildPowerShellScript } from "./transfer.server";

export const listTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("file_transfers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<Record<string, any>>;
    const ids = rows.map((r) => r.command_id).filter(Boolean);
    let cmds: Record<string, any> = {};
    if (ids.length) {
      const { data: cs } = await sb.from("server_commands").select("id, status, output, finished_at").in("id", ids);
      for (const c of (cs ?? []) as Array<Record<string, any>>) cmds[c.id] = c;
    }
    return rows.map((r) => ({ ...r, command: r.command_id ? (cmds[r.command_id] ?? null) : null }));
  });

/** Step 1 — register the transfer and return the storage path the browser should upload to. */
export const createTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string | null;
    name: string;
    targetPath?: string;
    port?: number;
    installCmd?: string;
    buildCmd?: string;
    startCmd?: string;
    outputDir?: string;
    mode?: "agent" | "powershell";
    host?: string;
    sshUser?: string;
    fileCount?: number;
    sizeBytes?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const name = slugName(data.name);
    const targetPath = normalizePath(data.targetPath);
    const port = Number(data.port) > 0 ? Math.floor(Number(data.port)) : 3000;

    const { data: row, error } = await sb
      .from("file_transfers")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        name,
        target_path: targetPath,
        port,
        service_name: `tvcc-hn-${name}`,
        install_cmd: data.installCmd || null,
        build_cmd: data.buildCmd || null,
        start_cmd: data.startCmd || null,
        output_dir: data.outputDir || null,
        mode: data.mode ?? "agent",
        host: data.host || null,
        ssh_user: data.sshUser || null,
        file_count: data.fileCount ?? 0,
        size_bytes: data.sizeBytes ?? 0,
        status: "draft",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const storagePath = `${context.userId}/${row.id}.zip`;
    await sb.from("file_transfers").update({ storage_path: storagePath, status: "uploading" }).eq("id", row.id);
    return { ...row, storage_path: storagePath, bucket: "site-uploads" };
  });

/** Step 2 — after the browser uploaded the zip, queue the agent deployment command. */
export const startTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: t, error } = await sb.from("file_transfers").select("*").eq("id", data.transferId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("عملية النقل غير موجودة");
    if (!t.server_id) throw new Error("اختر سيرفراً أولاً");
    if (!t.storage_path) throw new Error("لم يتم رفع الملفات بعد");

    const { data: signed, error: sErr } = await sb.storage
      .from("site-uploads")
      .createSignedUrl(t.storage_path, 3600);
    if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "تعذّر توليد رابط التنزيل");

    const { data: cmd, error: cErr } = await sb
      .from("server_commands")
      .insert({
        owner_id: context.userId,
        server_id: t.server_id,
        action: "deploy_upload",
        args: {
          url: signed.signedUrl,
          name: t.name,
          path: t.target_path,
          port: String(t.port ?? 3000),
          install: t.install_cmd ?? "",
          build: t.build_cmd ?? "",
          start: t.start_cmd ?? "",
          output_dir: t.output_dir ?? "",
          service: t.service_name ?? `tvcc-hn-${t.name}`,
        },
        dry_run: data.dryRun ?? false,
        requested_by: context.userId,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);

    await sb
      .from("file_transfers")
      .update({ command_id: cmd.id, status: data.dryRun ? "dry_run" : "deploying", dry_run: !!data.dryRun, updated_at: new Date().toISOString() })
      .eq("id", t.id);

    return { ok: true, commandId: cmd.id };
  });

/** Re-reads the linked command and folds its result back into the transfer row. */
export const syncTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: t } = await sb.from("file_transfers").select("*").eq("id", data.transferId).maybeSingle();
    if (!t?.command_id) return { status: t?.status ?? "draft", log: t?.log ?? "" };
    const { data: c } = await sb.from("server_commands").select("status, output").eq("id", t.command_id).maybeSingle();
    if (!c) return { status: t.status, log: t.log ?? "" };

    let status = t.status;
    if (c.status === "done") status = t.dry_run ? "dry_run" : "running";
    else if (c.status === "failed") status = "failed";

    const out = String(c.output ?? "");
    const m = out.match(/RESULT port=(\d+) service=(\S+) http=(\d+)/);
    const patch: Record<string, unknown> = { status, log: out.slice(-8000), updated_at: new Date().toISOString() };
    if (m) {
      patch["port"] = Number(m[1]);
      patch["service_name"] = m[2];
      if (m[3] === "000") patch["status"] = "unhealthy";
    }
    await sb.from("file_transfers").update(patch).eq("id", t.id);
    return { status: patch["status"], log: out };
  });

export const deleteTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: t } = await sb.from("file_transfers").select("storage_path").eq("id", data.transferId).maybeSingle();
    if (t?.storage_path) await sb.storage.from("site-uploads").remove([t.storage_path]);
    const { error } = await sb.from("file_transfers").delete().eq("id", data.transferId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** PowerShell fallback for servers without the agent. */
export const generatePowerShell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name: string; host: string; sshUser?: string; sshPort?: number; localPath: string;
    targetPath?: string; port?: number; installCmd?: string; buildCmd?: string; startCmd?: string; outputDir?: string;
  }) => input)
  .handler(async ({ data }) => {
    const name = slugName(data.name);
    const script = buildPowerShellScript({
      host: data.host,
      user: data.sshUser || "root",
      sshPort: Number(data.sshPort) > 0 ? Math.floor(Number(data.sshPort)) : 22,
      localPath: data.localPath || "C:\\path\\to\\project",
      spec: {
        name,
        targetPath: normalizePath(data.targetPath),
        port: Number(data.port) > 0 ? Math.floor(Number(data.port)) : 3000,
        service: `tvcc-hn-${name}`,
        installCmd: data.installCmd ?? null,
        buildCmd: data.buildCmd ?? null,
        startCmd: data.startCmd ?? null,
        outputDir: data.outputDir ?? null,
      },
    });
    return { script, fileName: `tvcc-deploy-${name}.ps1` };
  });
