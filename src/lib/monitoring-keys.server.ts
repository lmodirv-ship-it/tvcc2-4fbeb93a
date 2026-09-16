import { createHash, createHmac, randomBytes } from "crypto";

/** مفتاح مشترك عشوائي للمجموعة — يُعرض مرة واحدة فقط ولا يُخزَّن. */
export function generateSharedKey(): string {
  return `tvcc_${randomBytes(24).toString("hex")}`;
}

export function fingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function shortFingerprint(fp: string): string {
  return `${fp.slice(0, 8)}…${fp.slice(-6)}`;
}

/** مفتاح كيان مشتق من المفتاح المشترك (موقع أو سيرفر). */
export function deriveEntityKey(sharedKey: string, kind: "site" | "server", id: string): string {
  return createHmac("sha256", sharedKey).update(`${kind}:${id}`).digest("hex").slice(0, 48);
}
