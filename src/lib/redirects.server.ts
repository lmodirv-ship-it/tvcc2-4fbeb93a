/** Server-only helpers for domain/port redirects managed from the domains page. */

export type Kind = "domain" | "port";
export type Mode = "redirect_301" | "proxy" | "tcp_bridge";

const DOMAIN_RE = /^[a-z0-9.-]{3,253}$/i;

/** Detect whether a free-text value is a port number or a domain name. */
export function classify(value: string): { kind: Kind; value: string } | null {
  const v = value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!v) return null;
  if (/^\d{1,5}$/.test(v)) {
    const p = Number(v);
    if (p < 1 || p > 65535) return null;
    return { kind: "port", value: String(p) };
  }
  if (!DOMAIN_RE.test(v) || v.includes("..") || !v.includes(".")) return null;
  return { kind: "domain", value: v.toLowerCase() };
}

/** Which operation a source/target pair maps to. */
export function resolveMode(sourceKind: Kind, targetKind: Kind): Mode | null {
  if (sourceKind === "domain" && targetKind === "domain") return "redirect_301";
  if (sourceKind === "domain" && targetKind === "port") return "proxy";
  if (sourceKind === "port" && targetKind === "port") return "tcp_bridge";
  return null; // port → domain is not supported (no source domain to bind)
}

export const MODE_LABELS: Record<Mode, string> = {
  redirect_301: "تحويل دائم 301",
  proxy: "بروكسي إلى منفذ",
  tcp_bridge: "جسر TCP بين منفذين",
};

/** Nginx permanent redirect that preserves the request path. */
export function buildRedirectConf(from: string, to: string): string {
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${from};

    # managed by TVCC — redirect ${from} → ${to}
    location / {
        return 301 https://${to}$request_uri;
    }
}
`;
}

/** Placeholder written when a redirect is removed, so nginx keeps parsing. */
export function buildDisabledConf(domain: string): string {
  return `# managed by TVCC — redirect for ${domain} removed\n`;
}
