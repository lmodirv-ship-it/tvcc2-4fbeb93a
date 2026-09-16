import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/** نفس اشتقاق مفتاح الخزنة المستخدم في server-ops حتى تُقرأ الأسرار نفسها. */

function vaultKey() {
  const key = process.env["VAULT_MASTER_KEY"];
  if (!key) throw new Error("VAULT_MASTER_KEY غير مضبوط — الخزنة معطّلة حتى ضبط المفتاح");
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


/** مفاتيح فك التشفير: المفتاح الحالي ثم مفتاح قديم اختياري من البيئة (للترحيل فقط). */
function vaultKeys(): Buffer[] {
  const keys: Buffer[] = [vaultKey()];
  const legacy = process.env["VAULT_LEGACY_KEY"];
  if (legacy) keys.push(scryptSync(legacy, "tvcc-vault-salt", 32));
  return keys;
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  let lastError: unknown;
  for (const key of vaultKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
      decipher.setAuthTag(buf.subarray(0, 16));
      return Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]).toString("utf8");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("تعذّر فك تشفير السر");
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return value.slice(0, 3) + "•".repeat(value.length - 6) + value.slice(-3);
}
