import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** وجهات النسخ الليلي + حالة نسخ كل موقع. */
export const listBackupDestinations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: destinations }, { data: copies }] = await Promise.all([
      sb
        .from("backup_destinations")
        .select("id, name, host, username, port, base_path, is_enabled, last_run_at, last_run_status, last_run_summary, notes, created_at, secret_id")
        .order("created_at", { ascending: false }),
      sb
        .from("site_backup_copies")
        .select("id, destination_id, website_id, domain, copy_kind, remote_path, size_bytes, status, error_message, completed_at, updated_at")
        .order("domain"),
    ]);
    return { destinations: destinations ?? [], copies: copies ?? [] };
  });

export const saveBackupDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      name: string;
      host: string;
      username: string;
      port?: number;
      password?: string | null;
      basePath: string;
      isEnabled: boolean;
      notes?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!data.name.trim() || !data.host.trim() || !data.basePath.trim()) {
      throw new Error("الاسم والسيرفر والمسار مطلوبة");
    }

    let secretId: string | null = null;
    if (data.password && data.password.trim()) {
      const { encryptSecret, maskSecret } = await import("@/lib/vault-crypto.server");
      const { ciphertext, iv } = encryptSecret(data.password.trim());
      const { data: secret, error: secretError } = await sb
        .from("vault_secrets")
        .insert({
          owner_id: context.userId,
          name: `backup-dest-${data.host}-${Date.now()}`,
          kind: "ssh_password",
          description: `كلمة سر وجهة النسخ: ${data.name}`,
          encrypted_value: ciphertext,
          iv,
          masked_value: maskSecret(data.password.trim()),
        })
        .select("id")
        .maybeSingle();
      if (secretError) throw new Error(secretError.message);
      secretId = secret?.id ?? null;
    }

    const payload: Record<string, unknown> = {
      owner_id: context.userId,
      name: data.name.trim(),
      host: data.host.trim(),
      username: (data.username || "root").trim(),
      port: data.port ?? 22,
      base_path: data.basePath.trim().replace(/\/+$/, ""),
      is_enabled: data.isEnabled,
      notes: data.notes ?? null,
    };
    if (secretId) payload["secret_id"] = secretId;

    if (data.id) {
      const { error } = await sb.from("backup_destinations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }

    const { data: row, error } = await sb
      .from("backup_destinations")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id };
  });

export const toggleBackupDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isEnabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("backup_destinations")
      .update({ is_enabled: data.isEnabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBackupDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("backup_destinations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** تشغيل النسخ الكامل فوراً لوجهة واحدة (نفس منطق المهمة الليلية). */
export const runBackupDestinationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: dest } = await sb
      .from("backup_destinations")
      .select("id, owner_id, name, host, username, port, base_path, secret_id, is_enabled")
      .eq("id", data.id)
      .maybeSingle();
    if (!dest) throw new Error("الوجهة غير موجودة");
    if (dest.owner_id !== context.userId) throw new Error("غير مصرح");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runNightlyBackupForDestination } = await import("@/lib/nightly-backup.server");
    return runNightlyBackupForDestination(supabaseAdmin as any, dest);
  });
