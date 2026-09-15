/** محركات المنصة: كل محرّك = سكربت قابل للمعاينة + خطوات أوامر يُنفّذها وكيل السيرفر. */

export type EngineContext = {
  serverName: string;
  hostname: string;
  domain: string;
  siteName: string;
  rootPath: string;
  port: number;
  model: string;
  repo: string;
  unit: string;
};

export type EngineStep = { action: string; args: Record<string, unknown> };

export type Engine = {
  id: string;
  label: string;
  description: string;
  group: "مواقع" | "شبكة" | "ذكاء" | "بيانات";
  needs: Array<"site" | "model" | "port" | "repo" | "path">;
  /** أي علاقات تُحدَّث بعد الإرسال */
  relation: string;
  steps: (c: EngineContext) => EngineStep[];
  script: (c: EngineContext) => string;
};

const head = (title: string, c: EngineContext) =>
  `#!/usr/bin/env bash
set -euo pipefail
# TVCC — ${title}
# server: ${c.serverName} (${c.hostname})
# site:   ${c.siteName || "—"} ${c.domain ? `(${c.domain})` : ""}
`;

export const ENGINES: Engine[] = [
  {
    id: "site_up",
    label: "تشغيل موقع",
    description: "تجهيز خدمة systemd للموقع وتشغيلها وتفعيل الإقلاع التلقائي",
    group: "مواقع",
    needs: ["site", "path", "port"],
    relation: "site_runtimes + server_sites",
    steps: (c) => [
      { action: "site_dir", args: { path: c.rootPath, domain: c.domain } },
      {
        action: "unit_write",
        args: {
          unit: c.unit,
          root_path: c.rootPath,
          exec_start: `/usr/bin/env PORT=${c.port} npm run start`,
          port: c.port,
          domain: c.domain,
        },
      },
      { action: "site_start", args: { unit: c.unit, domain: c.domain, port: c.port } },
    ],
    script: (c) => `${head("تشغيل موقع", c)}
ROOT="${c.rootPath}"; UNIT="${c.unit}"; PORT=${c.port}
mkdir -p "$ROOT"
cat >/etc/systemd/system/$UNIT.service <<EOF
[Unit]
Description=TVCC site ${c.domain}
After=network.target

[Service]
WorkingDirectory=$ROOT
Environment=PORT=$PORT
ExecStart=/usr/bin/env npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now $UNIT
systemctl is-active $UNIT`,
  },
  {
    id: "git_redeploy",
    label: "إعادة نشر من Git",
    description: "سحب آخر إصدار من المستودع، بناء المشروع، وإعادة تشغيل الخدمة",
    group: "مواقع",
    needs: ["site", "path", "repo"],
    relation: "site_runtimes",
    steps: (c) => [
      { action: "git_deploy", args: { repo: c.repo, path: c.rootPath, domain: c.domain, branch: "main" } },
      { action: "build_run", args: { path: c.rootPath, command: "npm ci && npm run build" } },
      { action: "site_restart", args: { unit: c.unit, domain: c.domain } },
    ],
    script: (c) => `${head("إعادة نشر من Git", c)}
ROOT="${c.rootPath}"; REPO="${c.repo}"
if [ -d "$ROOT/.git" ]; then cd "$ROOT" && git fetch --all && git reset --hard origin/main;
else git clone "$REPO" "$ROOT" && cd "$ROOT"; fi
npm ci && npm run build
systemctl restart ${c.unit} || true
systemctl is-active ${c.unit} || true`,
  },
  {
    id: "build_serve",
    label: "بناء وتشغيل",
    description: "تثبيت الاعتماديات، تنفيذ البناء، ورفع الخدمة على المنفذ المحدّد",
    group: "مواقع",
    needs: ["site", "path", "port"],
    relation: "site_runtimes + port_links",
    steps: (c) => [
      { action: "build_run", args: { path: c.rootPath, command: "npm ci && npm run build" } },
      { action: "serve_start", args: { path: c.rootPath, port: c.port, domain: c.domain } },
    ],
    script: (c) => `${head("بناء وتشغيل", c)}
cd "${c.rootPath}"
npm ci
npm run build
PORT=${c.port} nohup npm run start >/var/log/tvcc-${c.unit}.log 2>&1 &
sleep 2
ss -ltnp | grep ":${c.port}" || echo "port ${c.port} not listening yet"`,
  },
  {
    id: "bind_site",
    label: "ربط الموقع بالسيرفر",
    description: "كتابة إعداد Nginx للنطاق وربطه بالمنفذ المحلي ثم إعادة التحميل",
    group: "شبكة",
    needs: ["site", "port"],
    relation: "server_sites + port_links + websites.server_id",
    steps: (c) => [
      { action: "nginx_write_vhost", args: { domain: c.domain, port: c.port, websocket: true } },
      { action: "nginx_test", args: {} },
      { action: "nginx_reload", args: {} },
      { action: "port_bind_domain", args: { domain: c.domain, port: c.port } },
    ],
    script: (c) => `${head("ربط الموقع بالسيرفر", c)}
cat >/etc/nginx/sites-available/${c.domain}.conf <<'EOF'
server {
    listen 80;
    server_name ${c.domain};
    location / {
        proxy_pass http://127.0.0.1:${c.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/${c.domain}.conf /etc/nginx/sites-enabled/${c.domain}.conf
nginx -t && systemctl reload nginx`,
  },
  {
    id: "ssl_issue",
    label: "إصدار شهادة SSL",
    description: "إصدار شهادة Let's Encrypt للنطاق وتفعيل HTTPS والتجديد التلقائي",
    group: "شبكة",
    needs: ["site"],
    relation: "ssl_certificates + hn_certificates",
    steps: (c) => [
      { action: "issue_ssl", args: { domain: c.domain } },
      { action: "nginx_reload", args: {} },
    ],
    script: (c) => `${head("إصدار شهادة SSL", c)}
command -v certbot >/dev/null || (apt-get update -y && apt-get install -y certbot python3-certbot-nginx)
certbot --nginx -d ${c.domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect
systemctl reload nginx
certbot certificates | grep -A2 "${c.domain}"`,
  },
  {
    id: "health_heal",
    label: "فحص الصحة والإصلاح",
    description: "فحص المنافذ والخدمات والقرص، وإعادة تشغيل ما توقف تلقائياً",
    group: "مواقع",
    needs: [],
    relation: "server_health_snapshots + server_ports",
    steps: (c) => [
      { action: "scan_ports", args: {} },
      { action: "disk_usage", args: {} },
      { action: "service_status", args: { unit: c.unit || "nginx" } },
      { action: "service_restart", args: { unit: c.unit || "nginx", only_if_down: true } },
    ],
    script: (c) => `${head("فحص الصحة والإصلاح", c)}
df -h /
free -m
ss -ltnp | head -50
for U in nginx ${c.unit}; do
  [ -z "$U" ] && continue
  systemctl is-active --quiet "$U" || systemctl restart "$U" || true
  echo "$U: $(systemctl is-active $U 2>/dev/null || echo missing)"
done`,
  },
  {
    id: "ai_local_up",
    label: "تشغيل نماذج الذكاء المحلية",
    description: "تشغيل Ollama، سحب النموذج المختار، وعرض قائمة النماذج المتاحة",
    group: "ذكاء",
    needs: ["model"],
    relation: "ai_providers + ai_models",
    steps: (c) => [
      { action: "ollama_start", args: {} },
      { action: "ollama_pull", args: { model: c.model } },
      { action: "ai_models_list", args: {} },
    ],
    script: (c) => `${head("تشغيل نماذج الذكاء المحلية", c)}
command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
systemctl enable --now ollama 2>/dev/null || (OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve >/var/log/ollama.log 2>&1 &)
sleep 3
ollama pull ${c.model}
ollama list`,
  },
  {
    id: "ai_bind_site",
    label: "ربط الموقع بنموذج محلي",
    description: "نشر نموذج Ollama على مسار /ai داخل نطاق الموقع عبر Nginx",
    group: "ذكاء",
    needs: ["site", "model"],
    relation: "manara_endpoints + port_links",
    steps: (c) => [
      {
        action: "write_config",
        args: {
          path: `/etc/nginx/sites-available/${c.domain}-ai.conf`,
          content: aiProxyConf(c.domain),
        },
      },
      { action: "nginx_reload", args: {} },
      { action: "ollama_ps", args: {} },
    ],
    script: (c) => `${head("ربط الموقع بنموذج محلي", c)}
cat >/etc/nginx/sites-available/${c.domain}-ai.conf <<'EOF'
${aiProxyConf(c.domain)}EOF
ln -sf /etc/nginx/sites-available/${c.domain}-ai.conf /etc/nginx/sites-enabled/${c.domain}-ai.conf
nginx -t && systemctl reload nginx
curl -s -m 5 http://127.0.0.1:11434/api/tags | head -c 300`,
  },
  {
    id: "db_sync_site",
    label: "مزامنة قاعدة بيانات الموقع",
    description: "مزامنة قاعدة الموقع المحلية مع قاعدة المنصة (إضافة وتحديث فقط)",
    group: "بيانات",
    needs: ["site"],
    relation: "site_databases + db_sync_sources",
    steps: (c) => [
      { action: "db_ping", args: { domain: c.domain } },
      { action: "db_sync", args: { domain: c.domain, mode: "upsert" } },
    ],
    script: (c) => `${head("مزامنة قاعدة بيانات الموقع", c)}
pg_isready -h 127.0.0.1 -p 5432
if [ -f /opt/tvcc/tvcc-dbsync.js ]; then
  node /opt/tvcc/tvcc-dbsync.js --once
else
  echo "سكربت المزامنة غير مثبّت — نزّله من مركز قواعد البيانات إلى /opt/tvcc/"
fi`,
  },
  {
    id: "backup_storage",
    label: "نسخة احتياطية ومزامنة تخزين",
    description: "أرشفة ملفات الموقع وقاعدته ودفع النسخة إلى وجهة التخزين",
    group: "بيانات",
    needs: ["site", "path"],
    relation: "site_backups + site_storage_syncs",
    steps: (c) => [
      { action: "site_archive", args: { path: c.rootPath, domain: c.domain } },
      { action: "db_dump", args: { domain: c.domain } },
      { action: "storage_sync", args: { domain: c.domain } },
    ],
    script: (c) => `${head("نسخة احتياطية ومزامنة تخزين", c)}
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="/var/backups/tvcc/${c.domain}"
mkdir -p "$OUT"
tar -czf "$OUT/files-$STAMP.tar.gz" -C "${c.rootPath}" . 2>/dev/null || true
pg_dump -h 127.0.0.1 -U postgres postgres | gzip > "$OUT/db-$STAMP.sql.gz" 2>/dev/null || true
ls -lh "$OUT" | tail -5`,
  },
];

function aiProxyConf(domain: string) {
  return `server {
    listen 80;
    server_name ${domain};
    location /ai/ {
        proxy_pass http://127.0.0.1:11434/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
    }
}
`;
}

export function engineById(id: string) {
  return ENGINES.find((e) => e.id === id);
}

export function defaultContext(partial: Partial<EngineContext>): EngineContext {
  const domain = partial.domain ?? "example.com";
  return {
    serverName: partial.serverName ?? "—",
    hostname: partial.hostname ?? "—",
    domain,
    siteName: partial.siteName ?? domain,
    rootPath: partial.rootPath ?? `/var/www/${domain}`,
    port: partial.port ?? 3000,
    model: partial.model ?? "llama3.1",
    repo: partial.repo ?? "",
    unit: partial.unit ?? `tvcc-${domain.replace(/[^a-zA-Z0-9]+/g, "-")}`,
  };
}
