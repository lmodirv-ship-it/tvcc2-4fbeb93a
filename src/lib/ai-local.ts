/** Client-safe helpers for deciding whether a model must be called from the browser. */

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

/** True when the URL points at a machine only reachable from the user's own network. */
export function isLocalEndpoint(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url.includes("://") ? url : `http://${url}`).hostname;
    return PRIVATE_HOST.test(host) || host.endsWith(".local");
  } catch {
    return false;
  }
}

/** A model runs in the browser when it is declared local, or its endpoint is private. */
export function isBrowserModel(model: any, provider?: any): boolean {
  if (!model) return false;
  if (model.kind === "local") return true;
  return isLocalEndpoint(model.endpoint_url ?? provider?.base_url ?? null);
}

export function modelBaseUrl(model: any, provider?: any): string {
  return String(model?.endpoint_url ?? provider?.base_url ?? "").replace(/\/+$/, "");
}
