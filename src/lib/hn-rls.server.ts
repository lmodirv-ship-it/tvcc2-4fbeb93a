import { createHash, createHmac, randomBytes } from "crypto";

export const CERT_VALIDITY_DAYS = 365;

export type CertificatePayload = {
  version: "HN.RLS/1";
  serial: string;
  domain: string;
  project_name: string;
  project_id: string;
  owner_id: string;
  verification_method: string;
  issued_at: string;
  expires_at: string;
  issuer: string;
};

function signingKey(): string {
  const key = process.env["HN_RLS_SIGNING_KEY"];
  if (!key) throw new Error("HN_RLS_SIGNING_KEY غير مُعرَّف على الخادم");
  return key;
}

/** Serial format: HN-RLS-<year>-<6 hex chars, uppercase>. */
export function makeSerial(): string {
  const year = new Date().getUTCFullYear();
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `HN-RLS-${year}-${rand}`;
}

/** Stable HN project id derived from the website uuid. */
export function makeProjectId(websiteId: string): string {
  return `HN-${createHash("sha256").update(websiteId).digest("hex").slice(0, 12).toUpperCase()}`;
}

/** Canonical JSON so the fingerprint is reproducible. */
function canonical(payload: CertificatePayload): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))),
  );
}

export function fingerprintOf(payload: CertificatePayload): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

export function signPayload(payload: CertificatePayload): string {
  return createHmac("sha256", signingKey()).update(canonical(payload)).digest("base64url");
}

export function verifySignature(payload: CertificatePayload, signature: string): boolean {
  try {
    return signPayload(payload) === signature;
  } catch {
    return false;
  }
}

export function buildCertificate(input: {
  domain: string;
  projectName: string;
  projectId: string;
  ownerId: string;
  verificationMethod: string;
}) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CERT_VALIDITY_DAYS * 86400000);
  const payload: CertificatePayload = {
    version: "HN.RLS/1",
    serial: makeSerial(),
    domain: input.domain.toLowerCase(),
    project_name: input.projectName,
    project_id: input.projectId,
    owner_id: input.ownerId,
    verification_method: input.verificationMethod,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    issuer: "HN Network Registry (HN.RLS)",
  };
  return {
    payload,
    fingerprint: fingerprintOf(payload),
    signature: signPayload(payload),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Notify the Core Hub about a newly registered project. Never throws. */
export async function notifyCoreHub(
  coreUrl: string,
  apiKey: string | null,
  body: unknown,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(`${coreUrl.replace(/\/$/, "")}/api/public/registry/projects`, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-core-key": apiKey } : {}),
      },
      body: JSON.stringify(body),
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error)?.message ?? "network error" };
  }
}
