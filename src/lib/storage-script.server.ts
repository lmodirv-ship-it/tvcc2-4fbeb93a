/**
 * يبني سكريبت Node.js يعمل على سيرفر التخزين:
 *  - يجلب قائمة كل مواقع المالك من المنصة
 *  - ينشئ لكل نطاق مجلداً فيه first/ و current/
 *  - يمسح السيرفر (nginx/apache/systemd/المجلدات) لمعرفة المواقع الموجودة عليه
 *  - يرفع تقرير المسح إلى المنصة
 * بدون أي تبعيات خارجية، ولا يحذف أي ملف.
 */
export function buildStorageScript(opts: {
  baseUrl: string;
  secret: string;
  destinationId: string;
  basePath: string;
}): string {
  const { baseUrl, secret, destinationId, basePath } = opts;
  return `#!/usr/bin/env node
/* TVCC — سكريبت سيرفر التخزين: إنشاء مجلدات النسخ + تحليل مواقع السيرفر
   التشغيل:  node tvcc-storage.js            (تنفيذ فعلي)
             node tvcc-storage.js --dry-run  (معاينة فقط)
   لا يحذف هذا السكريبت أي ملف إطلاقاً. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const API = ${JSON.stringify(baseUrl)};
const SECRET = ${JSON.stringify(secret)};
const DESTINATION_ID = ${JSON.stringify(destinationId)};
const BASE = ${JSON.stringify(basePath)};
const DRY = process.argv.includes('--dry-run');

function log(m) { console.log('[tvcc] ' + m); }

async function api(route, body) {
  const res = await fetch(API + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tvcc-secret': SECRET },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(route + ' -> HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

/* ---------- 1) إنشاء مجلدات النسخ ---------- */
function ensureFolders(domains) {
  let created = 0;
  for (const d of domains) {
    for (const kind of ['first', 'current']) {
      const dir = path.join(BASE, d, kind);
      if (fs.existsSync(dir)) continue;
      if (DRY) { log('سيُنشأ: ' + dir); created++; continue; }
      fs.mkdirSync(dir, { recursive: true });
      created++;
    }
  }
  return created;
}

/* ---------- 2) تحليل مواقع السيرفر ---------- */
function scanVhosts() {
  const found = [];
  const dirs = [
    '/etc/nginx/sites-enabled', '/etc/nginx/conf.d',
    '/etc/apache2/sites-enabled', '/etc/httpd/conf.d',
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      let txt = '';
      try { txt = fs.readFileSync(p, 'utf8'); } catch { continue; }
      const names = [...txt.matchAll(/(?:server_name|ServerName|ServerAlias)\\s+([^;\\n]+)/g)]
        .flatMap((m) => m[1].split(/\\s+/))
        .map((s) => s.trim())
        .filter((s) => s && s !== '_' && s !== 'localhost' && !s.startsWith('#'));
      const rootM = txt.match(/(?:root|DocumentRoot)\\s+([^;\\n]+)/);
      const portM = txt.match(/listen\\s+(\\d+)/);
      for (const n of [...new Set(names)]) {
        found.push({
          domain: n.replace(/;$/, ''),
          source: dir.includes('nginx') ? 'nginx' : 'apache',
          doc_root: rootM ? rootM[1].trim().replace(/;$/, '') : null,
          port: portM ? Number(portM[1]) : null,
          details: { config_file: p },
        });
      }
    }
  }
  return found;
}

function scanWebRoots() {
  const found = [];
  for (const root of ['/var/www', '/srv/www', '/home']) {
    if (!fs.existsSync(root)) continue;
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (!/\\.[a-z]{2,}$/i.test(e.name)) continue; // يبدو كاسم نطاق
      found.push({ domain: e.name, source: 'webroot', doc_root: path.join(root, e.name), port: null, details: {} });
    }
  }
  return found;
}

function scanServices() {
  const out = sh('systemctl list-units --type=service --no-legend --no-pager');
  return out.split('\\n')
    .map((l) => l.trim().split(/\\s+/)[0])
    .filter((n) => n && /tvcc|web|site|node|php|nginx|apache/i.test(n))
    .map((n) => ({ service_name: n }));
}

function scanPorts() {
  const out = sh('ss -ltnp') || sh('netstat -ltnp');
  return [...new Set([...out.matchAll(/:(\\d{2,5})\\s/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

(async () => {
  log('الاتصال بالمنصة…');
  const inv = await api('/api/public/backups/inventory', { destination_id: DESTINATION_ID });
  const domains = inv.domains || [];
  log('عدد المواقع في المنصة: ' + domains.length);

  const created = ensureFolders(domains);
  log((DRY ? 'معاينة — ' : '') + 'مجلدات أُنشئت: ' + created + ' داخل ' + BASE);

  log('تحليل مواقع هذا السيرفر…');
  const vhosts = scanVhosts();
  const roots = scanWebRoots();
  const byDomain = new Map();
  for (const item of [...vhosts, ...roots]) {
    if (!byDomain.has(item.domain)) byDomain.set(item.domain, item);
  }
  const sites = [...byDomain.values()];
  const services = scanServices();
  const ports = scanPorts();

  log('مواقع مكتشفة على السيرفر: ' + sites.length + ' | خدمات: ' + services.length + ' | منافذ: ' + ports.length);
  for (const s of sites) log('  - ' + s.domain + (s.doc_root ? '  (' + s.doc_root + ')' : ''));

  if (DRY) { log('وضع المعاينة — لم يُرسل أي تقرير.'); return; }

  const report = await api('/api/public/backups/scan-report', {
    destination_id: DESTINATION_ID,
    hostname: os.hostname(),
    sites,
    services,
    ports,
  });
  log('تم رفع التقرير: ' + JSON.stringify(report));
})().catch((e) => { console.error('[tvcc] خطأ: ' + e.message); process.exit(1); });
`;
}
