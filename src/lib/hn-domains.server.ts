/** Helpers for the private .HN registry (server-only, no secrets). */

export const HN_SUFFIX = "hn";
export const HN_PUBLIC_BASE = "hn-groupe.org";

const NAME_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

export function normalizeName(raw: string): string {
  return String(raw || "").trim().toLowerCase().replace(/\.hn$/, "").replace(/^www\./, "");
}

export function validateName(raw: string): string {
  const name = normalizeName(raw);
  if (!NAME_RE.test(name)) {
    throw new Error("اسم غير صالح: أحرف إنجليزية صغيرة وأرقام وشرطات فقط (2-63 حرفاً)");
  }
  return name;
}

export function buildFqdn(name: string) {
  return `${name}.${HN_SUFFIX}`;
}

export function buildPublicFqdn(name: string, base = HN_PUBLIC_BASE) {
  return `${name}.${HN_SUFFIX}.${base}`;
}

export function isSafeDomain(fqdn: string) {
  return /^[a-z0-9.-]{3,253}$/.test(fqdn) && !fqdn.includes("..") && !fqdn.startsWith("-");
}

/** dnsmasq zone lines: wildcard for the domain + explicit www/sub records. */
export function buildDnsZone(fqdn: string, ip: string, records: Array<{ sub: string }> = []) {
  const lines = [
    `# TVCC .HN registry — ${fqdn}`,
    `address=/${fqdn}/${ip}`,
    `address=/www.${fqdn}/${ip}`,
    ...records.filter((r) => r.sub).map((r) => `address=/${r.sub}.${fqdn}/${ip}`),
  ];
  return lines.join("\n") + "\n";
}

/** Nginx vhost that serves the internal name and (optionally) the public mirror name. */
export function buildHnVhost(opts: {
  fqdn: string;
  port: number;
  targetIp?: string | null;
  publicFqdn?: string | null;
  records?: Array<{ sub: string; port: number }>;
}) {
  const upstream = `${opts.targetIp || "127.0.0.1"}:${opts.port}`;
  const names = [opts.fqdn, `www.${opts.fqdn}`, ...(opts.publicFqdn ? [opts.publicFqdn, `www.${opts.publicFqdn}`] : [])];
  const subs = (opts.records || [])
    .filter((r) => r.sub && r.port)
    .map(
      (r) => `server {
  listen 80;
  server_name ${r.sub}.${opts.fqdn};
  location / {
    proxy_pass http://${opts.targetIp || "127.0.0.1"}:${r.port};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`,
    )
    .join("\n\n");

  return `# managed by TVCC — .HN registry
server {
  listen 80;
  server_name ${names.join(" ")};
  location / {
    proxy_pass http://${upstream};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
${subs}
`;
}
