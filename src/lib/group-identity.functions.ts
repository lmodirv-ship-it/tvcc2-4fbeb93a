import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.string().regex(/^[A-Z][0-9]{6}$/, "رمز غير صالح");

export const listGroupIdentities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hn_group_identities")
      .select(
        "id, code, service_number, service_name, site_url, origin, status, hub_source, first_seen_at, last_signal_at, signal_count, created_at",
      )
      .order("last_signal_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listIdentitySignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ identityId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("hn_group_identity_signals")
      .select("id, code, origin, ip_hash, user_agent, signature_valid, created_at")
      .eq("identity_id", data.identityId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setIdentityStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["discovered", "connected", "revoked"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("hn_group_identities")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("hn_group_identities")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const lookupIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: codeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("hn_group_identities")
      .select("id, code, service_name, site_url, status, last_signal_at")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getIdentityHubConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    announceUrl: "https://tvcc.hnpay.live/api/public/hn/announce",
    lookupUrl: "https://tvcc.hnpay.live/api/public/hn/identity/{code}",
    signatureHeader: "x-hn-signature",
    secretConfigured: Boolean(process.env["HN_HUB_VERIFICATION_SALT"]),
  }));
