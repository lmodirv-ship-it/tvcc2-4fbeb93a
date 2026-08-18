import { createHmac, createHash } from "crypto";

/**
 * Deterministic per-server agent token derived from SERVERS_INGEST_SECRET.
 * The token itself is never stored; only its sha256 hash is kept on the row.
 */
export function deriveAgentToken(secret: string, serverId: string): string {
  return createHmac("sha256", secret).update(`agent:${serverId}`).digest("hex").slice(0, 48);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function signBody(token: string, rawBody: string): string {
  return createHmac("sha256", token).update(rawBody).digest("hex");
}
