/** Server-only helpers for the server mesh (links, clusters, proxy configs, provisioning). */

/** Normalised key used to group the same site running on several servers. */
export function clusterKey(nameOrDomain: string): string {
  return nameOrDomain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

/** Nginx reverse-proxy vhost pointing a domain at a local port. */
export function buildProxyConf(domain: string, port: number): string {
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    # managed by TVCC — do not edit by hand
    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
`;
}

export function proxyConfPath(domain: string): string {
  return `/etc/nginx/sites-enabled/${domain}.conf`;
}

export function siteRoot(domain: string): string {
  return `/var/www/${domain}`;
}

export const PROVISION_STEPS = [
  "dns_verify",
  "site_dir",
  "storage",
  "nginx",
  "ssl",
  "register_service",
] as const;

export const PROVISION_LABELS: Record<string, string> = {
  dns_verify: "التحقق من DNS",
  site_dir: "إنشاء مجلد الموقع",
  storage: "تهيئة التخزين",
  nginx: "إعداد Nginx",
  ssl: "شهادة SSL",
  register_service: "تسجيل الموقع كخدمة",
};

/** Safe domain guard for anything that ends up in a shell/file path. */
export function isSafeDomain(d: string): boolean {
  return /^[a-z0-9.-]{3,253}$/i.test(d) && !d.includes("..");
}
