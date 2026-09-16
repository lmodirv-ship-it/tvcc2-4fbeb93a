import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * مفتاح خاص بكل موقع مشتق من سر المنصة. لا يُخزَّن أبداً — تُخزَّن بصمته فقط.
 */
export function deriveSiteKey(secret: string, websiteId: string): string {
  return createHmac("sha256", secret).update(`site:${websiteId}`).digest("hex").slice(0, 48);
}

export function hashSiteKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function signSitePayload(key: string, rawBody: string): string {
  return createHmac("sha256", key).update(rawBody).digest("hex");
}

export function verifySiteSignature(key: string, rawBody: string, provided: string | null): boolean {
  if (!provided) return false;
  const expected = signSitePayload(key, rawBody);
  const a = Buffer.from(provided.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** النبضة صالحة خلال 5 دقائق من إرسالها (مقاومة إعادة الإرسال). */
export function freshTimestamp(ts: unknown): boolean {
  const n = Number(ts);
  if (!Number.isFinite(n)) return false;
  return Math.abs(Date.now() - n) < 5 * 60 * 1000;
}

export const SITE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
