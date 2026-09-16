import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminOrOwner } from "./roles.server";

async function assertAdmin(supabase: any, userId: string) {
  const ok = await isAdminOrOwner(supabase, userId);
  if (!ok) throw new Error("هذه العملية متاحة للمالك والمدير فقط");
}

/** قائمة المفاتيح: بصمات فقط، لا مفاتيح كاملة. */
export const listMonitoringKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const [{ data: keys }, { data: websites }, { data: servers }] = await Promise.all([
      supabase.from("monitoring_keys").select("*").order("rotated_at", { ascending: false }),
      supabase.from("websites").select("id,name,domain,site_code"),
      supabase.from("servers").select("id,name,hostname"),
    ]);

    const siteById = new Map((websites ?? []).map((w: any) => [w.id, w]));
    const serverById = new Map((servers ?? []).map((s: any) => [s.id, s]));

    const shared = (keys ?? []).find((k: any) => k.key_type === "shared") ?? null;

    return {
      shared,
      rows: (keys ?? []).map((k: any) => ({
        ...k,
        target:
          k.key_type === "shared"
            ? "المفتاح المشترك للمجموعة"
            : k.website_id
              ? `${(siteById.get(k.website_id) as any)?.site_code ?? ""} · ${(siteById.get(k.website_id) as any)?.name ?? "موقع"}`
              : `${(serverById.get(k.server_id) as any)?.name ?? "سيرفر"}`,
      })),
      totals: {
        keys: (keys ?? []).length,
        sites: (keys ?? []).filter((k: any) => k.key_type === "site").length,
        servers: (keys ?? []).filter((k: any) => k.key_type === "server").length,
        enforced: !!shared?.enforced,
      },
    };
  });

/** إنشاء/تدوير المفتاح المشترك — يُعاد المفتاح الكامل مرة واحدة فقط. */
export const createSharedKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { graceMinutes?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { generateSharedKey, fingerprint } = await import("./monitoring-keys.server");
    const key = generateSharedKey();
    const fp = fingerprint(key);
    const grace = new Date(Date.now() + (data.graceMinutes ?? 60) * 60_000).toISOString();

    const { data: existing } = await supabase
      .from("monitoring_keys")
      .select("id,fingerprint,version")
      .eq("key_type", "shared")
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("monitoring_keys")
        .update({
          previous_fingerprint: existing.fingerprint,
          fingerprint: fp,
          version: (existing.version ?? 1) + 1,
          grace_until: grace,
          rotated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("monitoring_keys").insert({
        owner_id: userId,
        key_type: "shared",
        fingerprint: fp,
        grace_until: grace,
      });
      if (error) throw new Error(error.message);
    }

    return { key, fingerprint: fp };
  });

/** مزامنة المفاتيح: اشتقاق مفتاح لكل موقع وسيرفر من المفتاح المشترك (إضافة/تحديث بصمات فقط). */
export const syncMonitoringKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sharedKey: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    if (!data.sharedKey?.trim()) throw new Error("أدخل المفتاح المشترك أولاً");

    const { deriveEntityKey, fingerprint } = await import("./monitoring-keys.server");

    const { data: shared } = await supabase
      .from("monitoring_keys")
      .select("fingerprint")
      .eq("key_type", "shared")
      .maybeSingle();
    if (!shared) throw new Error("أنشئ المفتاح المشترك أولاً");
    if (fingerprint(data.sharedKey.trim()) !== shared.fingerprint) throw new Error("المفتاح المشترك غير مطابق");

    const [{ data: websites }, { data: servers }, { data: keys }] = await Promise.all([
      supabase.from("websites").select("id"),
      supabase.from("servers").select("id"),
      supabase.from("monitoring_keys").select("id,website_id,server_id,fingerprint,version"),
    ]);

    const byWebsite = new Map((keys ?? []).filter((k: any) => k.website_id).map((k: any) => [k.website_id, k]));
    const byServer = new Map((keys ?? []).filter((k: any) => k.server_id).map((k: any) => [k.server_id, k]));
    const grace = new Date(Date.now() + 60 * 60_000).toISOString();

    const inserts: any[] = [];
    let rotated = 0;

    const apply = async (kind: "site" | "server", id: string, prev: any) => {
      const fp = fingerprint(deriveEntityKey(data.sharedKey.trim(), kind, id));
      if (!prev) {
        inserts.push({
          owner_id: userId,
          key_type: kind,
          website_id: kind === "site" ? id : null,
          server_id: kind === "server" ? id : null,
          fingerprint: fp,
          grace_until: grace,
        });
        return;
      }
      if (prev.fingerprint === fp) return;
      await supabase
        .from("monitoring_keys")
        .update({
          previous_fingerprint: prev.fingerprint,
          fingerprint: fp,
          version: (prev.version ?? 1) + 1,
          grace_until: grace,
          rotated_at: new Date().toISOString(),
        })
        .eq("id", prev.id);
      rotated += 1;
    };

    for (const w of websites ?? []) await apply("site", w.id, byWebsite.get(w.id));
    for (const s of servers ?? []) await apply("server", s.id, byServer.get(s.id));

    let created = 0;
    for (let i = 0; i < inserts.length; i += 200) {
      const chunk = inserts.slice(i, i + 200);
      const { data: ins, error } = await supabase.from("monitoring_keys").insert(chunk).select("id");
      if (error) throw new Error(error.message);
      created += (ins ?? []).length;
    }

    return { created, rotated };
  });

/** تفعيل/تعطيل أمان مزامنة المفاتيح (رفض النبضات غير الموقّعة). */
export const setKeyEnforcement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enforced: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("monitoring_keys").update({ enforced: data.enforced }).eq("key_type", "shared");
    if (error) throw new Error(error.message);
    return { enforced: data.enforced };
  });

/** تدوير مفتاح موقع واحد — يُعاد المفتاح مرة واحدة. */
export const rotateSiteKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string; sharedKey?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { deriveEntityKey, fingerprint, generateSharedKey } = await import("./monitoring-keys.server");
    const base = data.sharedKey?.trim() || generateSharedKey();
    const key = deriveEntityKey(base, "site", data.websiteId);
    const fp = fingerprint(key);

    const { data: prev } = await supabase
      .from("monitoring_keys")
      .select("id,fingerprint,version")
      .eq("website_id", data.websiteId)
      .maybeSingle();

    if (prev) {
      await supabase
        .from("monitoring_keys")
        .update({
          previous_fingerprint: prev.fingerprint,
          fingerprint: fp,
          version: (prev.version ?? 1) + 1,
          grace_until: new Date(Date.now() + 3600_000).toISOString(),
          rotated_at: new Date().toISOString(),
        })
        .eq("id", prev.id);
    } else {
      await supabase.from("monitoring_keys").insert({
        owner_id: userId,
        key_type: "site",
        website_id: data.websiteId,
        fingerprint: fp,
      });
    }

    return { key, fingerprint: fp };
  });
