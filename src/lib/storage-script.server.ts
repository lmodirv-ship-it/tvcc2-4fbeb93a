/**
 * يبني سكريبت Node.js يعمل على سيرفر التخزين وينفّذ النسخ بنفسه:
 *  - خط اتصال حي مع المنصة (نبضة كل 5 دقائق)
 *  - ينشئ لكل نطاق مجلدين first/ و current/
 *  - يمسح السيرفر (nginx/apache/webroots/services/ports) ويرفع التقرير
 *  - يسحب مهام النسخ من المنصة وينفّذها فعلياً:
 *      • موقع مستضاف محلياً  → أرشيف tar.gz من مجلد الموقع
 *      • موقع غير مستضاف هنا → تحميل من مصدره الحيّ (wget mirror أو صفحة رئيسية)
 *  - يرفع نتيجة كل مهمة للمنصة. لا يحذف أي ملف إطلاقاً.
 */
export function buildStorageScript(opts: {
  baseUrl: string;
  secret: string;
  destinationId: string;
  basePath: string;
}): string {
  const { baseUrl, secret, destinationId, basePath } = opts;
  return `#!/usr/bin/env node
/* TVCC — سكريبت سيرفر التخزين (تنفيذ ذاتي للنسخ)
   التشغيل:  node tvcc-storage.js            (مستمر: دورة كل 5 دقائق)
             node tvcc-storage.js --once     (دورة واحدة)
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
const ONCE = process.argv.includes('--once');
const INTERVAL = 5 * 60 * 1000;
const BATCH = 25;

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
function has(bin) { return !!sh('command -v ' + bin).trim(); }
function q(s) { return "'" + String(s).replace(/'/g, "'\\\\''") + "'"; }

/* ---------- مجلدات النسخ ---------- */
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

/* ---------- تحليل السيرفر ---------- */
function scanVhosts() {
  const found = [];
  const dirs = ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d', '/etc/apache2/sites-enabled', '/etc/httpd/conf.d'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    let files = [];
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      const p = path.join(dir, f);
      let txt = '';
      try { txt = fs.readFileSync(p, 'utf8'); } catch { continue; }
      const names = [...txt.matchAll(/(?:server_name|ServerName|ServerAlias)\\s+([^;\\n]+)/g)]
        .flatMap((m) => m[1].split(/\\s+/)).map((s) => s.trim())
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
      if (!/\\.[a-z]{2,}$/i.test(e.name)) continue;
      found.push({ domain: e.name, source: 'webroot', doc_root: path.join(root, e.name), port: null, details: {} });
    }
  }
  return found;
}

function scanServices() {
  const out = sh('systemctl list-units --type=service --no-legend --no-pager');
  return out.split('\\n').map((l) => l.trim().split(/\\s+/)[0])
    .filter((n) => n && /tvcc|web|site|node|php|nginx|apache/i.test(n))
    .map((n) => ({ service_name: n }));
}

function scanPorts() {
  const out = sh('ss -ltnp') || sh('netstat -ltnp');
  return [...new Set([...out.matchAll(/:(\\d{2,5})\\s/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

/* ---------- تنفيذ مهمة نسخ ---------- */
function dirSize(dir) {
  const out = sh('du -sb ' + q(dir) + ' 2>/dev/null');
  const n = Number((out.split(/\\s+/)[0] || '').trim());
  return Number.isFinite(n) ? n : null;
}
function isEmptyDir(dir) {
  try { return fs.readdirSync(dir).length === 0; } catch { return true; }
}

async function saveSinglePage(domain, dir) {
  for (const proto of ['https', 'http']) {
    try {
      const res = await fetch(proto + '://' + domain, { redirect: 'follow' });
      if (!res.ok) continue;
      const html = await res.text();
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      return true;
    } catch { /* المحاولة التالية */ }
  }
  return false;
}

async function runTask(task, docRoots) {
  const dir = task.remote_path || path.join(BASE, task.domain, task.copy_kind);
  fs.mkdirSync(dir, { recursive: true });

  // النسخة الأولى تُكتب مرة واحدة فقط
  if (task.copy_kind === 'first' && !isEmptyDir(dir)) {
    return { status: 'completed', size: dirSize(dir), note: 'first_exists' };
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const root = docRoots.get(task.domain);

  if (root && fs.existsSync(root)) {
    const file = path.join(dir, 'site-' + stamp + '.tar.gz');
    sh('tar -czf ' + q(file) + ' -C ' + q(root) + ' . 2>/dev/null');
    if (fs.existsSync(file) && fs.statSync(file).size > 0) {
      return { status: 'completed', size: dirSize(dir), note: 'local_archive' };
    }
  }

  const mirror = path.join(dir, 'mirror');
  fs.mkdirSync(mirror, { recursive: true });
  if (has('wget')) {
    sh('wget --mirror --convert-links --adjust-extension --page-requisites --no-parent -q -e robots=off -P ' +
      q(mirror) + ' https://' + task.domain + ' 2>/dev/null');
  }
  if (isEmptyDir(mirror)) {
    const ok = await saveSinglePage(task.domain, mirror);
    if (!ok) return { status: 'failed', size: null, error: 'تعذر الوصول إلى ' + task.domain };
  }
  return { status: 'completed', size: dirSize(dir), note: 'remote_fetch' };
}

/* ---------- نظام ونبضة ---------- */
function diskInfo() {
  const out = sh('df -BG --output=size,avail ' + q(BASE) + ' 2>/dev/null || df -g ' + q(BASE));
  const nums = (out.match(/(\\d+)G/g) || []).map((s) => Number(s.replace('G', '')));
  return { total: nums[0] || null, free: nums[1] || null };
}

async function ping(extra) {
  const disk = diskInfo();
  return api('/api/public/backups/link', Object.assign({
    destination_id: DESTINATION_ID,
    hostname: os.hostname(),
    base_path: BASE,
    agent_version: '2.0.0',
    disk_total_gb: disk.total,
    disk_free_gb: disk.free,
    mem_total_mb: Math.round(os.totalmem() / 1048576),
    mem_free_mb: Math.round(os.freemem() / 1048576),
    load_avg: os.loadavg()[0],
    uptime_seconds: Math.round(os.uptime()),
  }, extra || {}));
}

/* ---------- دورة كاملة ---------- */
async function cycle() {
  const link = await ping({});
  const domains = link.domains || [];
  log('خط الاتصال ✓ — مواقع المنصة: ' + domains.length + ' | المسار: ' + BASE);

  const created = ensureFolders(domains);
  log((DRY ? 'معاينة — ' : '') + 'مجلدات أُنشئت: ' + created);

  const vhosts = scanVhosts();
  const roots = scanWebRoots();
  const byDomain = new Map();
  for (const item of [...vhosts, ...roots]) if (!byDomain.has(item.domain)) byDomain.set(item.domain, item);
  const sites = [...byDomain.values()];
  const docRoots = new Map(sites.filter((s) => s.doc_root).map((s) => [s.domain, s.doc_root]));
  log('مواقع على السيرفر: ' + sites.length);

  if (DRY) { log('وضع المعاينة — لا نسخ ولا تقارير.'); return; }

  await api('/api/public/backups/scan-report', {
    destination_id: DESTINATION_ID, hostname: os.hostname(),
    sites, services: scanServices(), ports: scanPorts(),
  });

  const { tasks } = await api('/api/public/backups/tasks', { destination_id: DESTINATION_ID, limit: BATCH });
  log('مهام نسخ: ' + (tasks || []).length);
  let done = 0, failed = 0;
  for (const t of tasks || []) {
    try {
      const r = await runTask(t, docRoots);
      await api('/api/public/backups/report', {
        destination_id: DESTINATION_ID, copy_id: t.id, status: r.status,
        size_bytes: r.size, remote_path: t.remote_path, error_message: r.error || null,
      });
      if (r.status === 'completed') { done++; log('✓ ' + t.domain + ' (' + t.copy_kind + ') ' + (r.note || '')); }
      else { failed++; log('✗ ' + t.domain + ': ' + r.error); }
    } catch (e) {
      failed++;
      try {
        await api('/api/public/backups/report', {
          destination_id: DESTINATION_ID, copy_id: t.id, status: 'failed', error_message: String(e.message || e),
        });
      } catch {}
      log('✗ ' + t.domain + ': ' + e.message);
    }
  }
  await ping({ domains_count: domains.length, folders_count: created, sites_found: sites.length,
    note: 'نسخ: ' + done + ' ناجح / ' + failed + ' فاشل' });
  log('انتهت الدورة — ناجح ' + done + ' | فاشل ' + failed);
}

(async () => {
  const runOnce = async () => {
    try { await cycle(); } catch (e) { console.error('[tvcc] خطأ في الدورة: ' + e.message); }
  };
  await runOnce();
  if (ONCE || DRY) return;
  log('الوضع المستمر — دورة كل ' + (INTERVAL / 60000) + ' دقائق. (Ctrl+C للإيقاف)');
  setInterval(runOnce, INTERVAL);
})();
`;
}
