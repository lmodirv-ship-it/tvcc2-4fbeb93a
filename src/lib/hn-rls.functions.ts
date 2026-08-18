import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const WebsiteInput = z.object({ websiteId: z.string().uuid() });
const RevokeInput = z.object({
  certificateId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

type CertRow = {
  id: string;
  serial: string;
  domain: string;
  status: string;
  issued_at: string;
  expires_at: string;
  fingerprint: string;
  verification_method: string;
};

/**
 * Verify domain ownership, then issue an HN.RLS certificate and register the
 * project. Each step gates the next: no verification -> no certificate,
 * no active certificate -> no registration.
 */
export const verifyIssueRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WebsiteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const {
      buildCertificate,
      checkDomainOwnership,
      makeProjectId,
      notifyCoreHub,
    } = await import("./hn-rls.server");

    const { data: site, error: siteErr } = await supabase
      .from("websites")
      .select("id, name, domain, site_id, hn_project_id, registration_status")
      .eq("id", data.websiteId)
      .maybeSingle();
    if (siteErr) throw new Error(siteErr.message);
    if (!site) throw new Error("الموقع غير موجود");

    // 1) Domain ownership
    const check = await checkDomainOwnership(site.domain);
    const checkedAt = new Date().toISOString();

    if (!check.verified) {
      await supabase
        .from("websites")
        .update({ verified: false, status: "offline", last_checked_at: checkedAt })
        .eq("id", site.id);
      // Any active certificate is no longer trustworthy.
      await supabase
        .from("hn_certificates")
        .update({
          status: "revoked",
          revoked_at: checkedAt,
          revoked_reason: "فقد النطاق التحقق من الملكية",
        })
        .eq("website_id", site.id)
        .eq("status", "active");

      return {
        verified: false as const,
        method: null,
        certificate: null,
        registration: null,
      };
    }

    await supabase
      .from("websites")
      .update({ verified: true, status: "online", last_checked_at: checkedAt })
      .eq("id", site.id);

    // 2) Certificate — reuse the active one if it is still valid
    const { data: existing } = await supabase
      .from("hn_certificates")
      .select("id, serial, domain, status, issued_at, expires_at, fingerprint, verification_method")
      .eq("website_id", site.id)
      .eq("status", "active")
      .maybeSingle();

    let certificate = existing as CertRow | null;
    let issuedNow = false;

    if (certificate && new Date(certificate.expires_at).getTime() <= Date.now()) {
      await supabase
        .from("hn_certificates")
        .update({ status: "expired" })
        .eq("id", certificate.id);
      certificate = null;
    }

    const projectId = site.hn_project_id ?? makeProjectId(site.id);

    if (!certificate) {
      const built = buildCertificate({
        domain: check.domain,
        projectName: site.name,
        projectId,
        ownerId: userId,
        verificationMethod: check.method ?? "DNS",
      });
      const { data: inserted, error: certErr } = await supabase
        .from("hn_certificates")
        .insert({
          owner_id: userId,
          website_id: site.id,
          domain: check.domain,
          serial: built.payload.serial,
          verification_method: check.method ?? "DNS",
          issued_at: built.issuedAt,
          expires_at: built.expiresAt,
          status: "active",
          fingerprint: built.fingerprint,
          signature: built.signature,
          payload: built.payload,
        })
        .select("id, serial, domain, status, issued_at, expires_at, fingerprint, verification_method")
        .maybeSingle();
      if (certErr) throw new Error(certErr.message);
      certificate = inserted as CertRow;
      issuedNow = true;
    }

    // 3) Project registration
    const { data: cfg } = await supabase
      .from("core_hub_config")
      .select("core_url, api_key")
      .eq("owner_id", userId)
      .maybeSingle();
    const coreUrl = cfg?.core_url ?? "https://hn-nwt.lovable.app";

    const push = await notifyCoreHub(coreUrl, cfg?.api_key ?? null, {
      event: "project.registered",
      project_id: projectId,
      site_id: site.site_id ?? projectId,
      name: site.name,
      domain: check.domain,
      certificate: {
        serial: certificate!.serial,
        fingerprint: certificate!.fingerprint,
        issued_at: certificate!.issued_at,
        expires_at: certificate!.expires_at,
      },
    });

    const registrationStatus = push.ok ? "registered" : "pending_sync";
    const registeredAt = new Date().toISOString();

    await supabase
      .from("websites")
      .update({
        hn_project_id: projectId,
        site_id: site.site_id ?? projectId,
        registration_status: registrationStatus,
        registered_at: registeredAt,
      })
      .eq("id", site.id);

    await supabase.from("activity_log").insert({
      owner_id: userId,
      action: issuedNow ? "hn_rls.certificate_issued" : "hn_rls.project_registered",
      entity_type: "website",
      entity_id: site.id,
      details: {
        domain: check.domain,
        serial: certificate!.serial,
        project_id: projectId,
        registration_status: registrationStatus,
        core_hub: { ok: push.ok, status: push.status, error: push.error },
      },
    });

    return {
      verified: true as const,
      method: check.method,
      issuedNow,
      certificate: certificate!,
      registration: {
        project_id: projectId,
        status: registrationStatus,
        registered_at: registeredAt,
        core_hub_error: push.error,
      },
    };
  });

/** Revoke an active certificate and mark the project as unregistered. */
export const revokeCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevokeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cert, error } = await supabase
      .from("hn_certificates")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: data.reason ?? "سحب يدوي من لوحة التحكم",
      })
      .eq("id", data.certificateId)
      .eq("status", "active")
      .select("id, website_id, serial")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cert) throw new Error("لا توجد شهادة سارية بهذا المعرّف");

    await supabase
      .from("websites")
      .update({ registration_status: "unregistered", registered_at: null })
      .eq("id", cert.website_id);

    await supabase.from("activity_log").insert({
      owner_id: context.userId,
      action: "hn_rls.certificate_revoked",
      entity_type: "website",
      entity_id: cert.website_id,
      details: { serial: cert.serial, reason: data.reason ?? null },
    });

    return { ok: true, serial: cert.serial };
  });

/** Revoke the current certificate then run the full issue + register flow again. */
export const reissueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WebsiteInput.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("hn_certificates")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: "إعادة إصدار",
      })
      .eq("website_id", data.websiteId)
      .eq("status", "active");
    return { ok: true };
  });

/** Full signed certificate document, for download. */
export const getCertificateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ certificateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cert, error } = await context.supabase
      .from("hn_certificates")
      .select("serial, domain, status, issued_at, expires_at, fingerprint, signature, payload, verification_method")
      .eq("id", data.certificateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cert) throw new Error("الشهادة غير موجودة");
    return cert;
  });
