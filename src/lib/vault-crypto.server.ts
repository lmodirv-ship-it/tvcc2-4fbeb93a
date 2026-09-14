import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/** نفس اشتقاق مفتاح الخزنة المستخدم في server-ops حتى تُقرأ الأسرار نفسها. */
const VAULT_FALLBACK_KEY = "tvcc-hn-groupe-vault-default-master-key-2026";

function vaultKey() {
  const key = process.env["VAULT_MASTER_KEY"] || VAULT_FALLBACK_KEY;
  return scryptSync(key, "tvcc-vault-salt", 32);
}

export function encryptSecret(plain: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    ciphertext: Buffer.concat([cipher.getAuthTag(), encrypted]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(buf.subarray(0, 16));
  return Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return value.slice(0, 3) + "•".repeat(value.length - 6) + value.slice(-3);
}
