import { createHmac, timingSafeEqual } from "crypto";

/**
 * Shared webhook verification for `/api/public/*.ingest` routes.
 * Callers send `sha256=<hex>` of HMAC-SHA256(secret, raw body) in one of the
 * accepted signature headers. A missing secret fails closed.
 */
export async function verifyIngestSignature(
  request: Request,
  secretEnvName: string,
  headerNames: string[] = ["x-tvcc-signature"],
): Promise<{ ok: true; raw: string } | { ok: false; response: Response }> {
  const secret = process.env[secretEnvName];
  if (!secret) {
    return { ok: false, response: new Response("Server not configured", { status: 500 }) };
  }

  const raw = await request.clone().text();
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

  for (const name of headerNames) {
    const provided = request.headers.get(name);
    if (!provided) continue;
    const a = Buffer.from(provided.trim());
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true, raw };
  }
  return { ok: false, response: new Response("Invalid signature", { status: 401 }) };
}
