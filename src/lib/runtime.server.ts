/** Server-only helpers for site runtime control, database links and live storage sync. */

export type RuntimeKind = "node" | "php" | "docker" | "static" | "custom";

export const RUNTIME_KINDS: { id: RuntimeKind; label: string; needsPort: boolean }[] = [
  { id: "node", label: "Node.js", needsPort: true },
  { id: "php", label: "PHP-FPM", needsPort: false },
  { id: "docker", label: "Docker", needsPort: true },
  { id: "static", label: "ملفات ثابتة (Nginx)", needsPort: false },
  { id: "custom", label: "أمر مخصّص", needsPort: true },
];

export function unitName(domain: string): string {
  return `tvcc-site-${domain.replace(/[^a-z0-9.-]/gi, "-").toLowerCase()}`;
}

export function siteRoot(domain: string): string {
  return `/var/www/${domain}`;
}

export function defaultExecStart(kind: RuntimeKind, domain: string, port?: number | null): string {
  const root = siteRoot(domain);
  switch (kind) {
    case "node":
      return `/usr/bin/env PORT=${port ?? 3000} node ${root}/server.js`;
    case "docker":
      return `/usr/bin/docker start -a ${unitName(domain)}`;
    case "php":
      return `/usr/sbin/php-fpm -F`;
    case "static":
      return `/bin/true`;
    default:
      return `/bin/bash -lc 'cd ${root} && ./start.sh'`;
  }
}

export function buildUnit(domain: string, execStart: string, port?: number | null): string {
  return `[Unit]
Description=TVCC site ${domain}
After=network.target

[Service]
Type=simple
WorkingDirectory=${siteRoot(domain)}
Environment="PORT=${port ?? 3000}"
EnvironmentFile=-${siteRoot(domain)}/.tvcc/env
ExecStart=${execStart}
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
`;
}

export function unitPath(domain: string): string {
  return `/etc/systemd/system/${unitName(domain)}.service`;
}

export function identityPath(domain: string): string {
  return `${siteRoot(domain)}/.tvcc/site.json`;
}

export function buildIdentity(input: {
  websiteId: string; ownerId: string; domain: string; serverId: string; syncKey: string;
}): string {
  return JSON.stringify(
    {
      platform: "TVCC",
      panel: "tvcc.hnpay.live",
      website_id: input.websiteId,
      owner_id: input.ownerId,
      server_id: input.serverId,
      domain: input.domain,
      sync_key: input.syncKey,
      verified_at: new Date().toISOString(),
    },
    null,
    2,
  );
}

/** Build a connection string for the linked database. */
export function buildDsn(input: {
  engine: string; user: string; password: string; host: string; port: number; dbName: string;
}): string {
  const scheme = input.engine === "mysql" ? "mysql" : input.engine === "mongodb" ? "mongodb" : "postgresql";
  return `${scheme}://${encodeURIComponent(input.user)}:${encodeURIComponent(input.password)}@${input.host}:${input.port}/${input.dbName}`;
}

export function defaultDbPort(engine: string): number {
  return engine === "mysql" ? 3306 : engine === "mongodb" ? 27017 : engine === "redis" ? 6379 : 5432;
}

export function dbNameFor(domain: string): string {
  return domain.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 48);
}

export function isSafeDomain(d: string): boolean {
  return /^[a-z0-9.-]{3,253}$/i.test(d) && !d.includes("..");
}

export function isSafeIdent(s: string): boolean {
  return /^[a-z0-9_]{1,63}$/i.test(s);
}

export function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
