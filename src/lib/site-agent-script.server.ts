/** مولّدات برنامج الموقع: نسخة PHP ونسخة Node وشارة TVCC للصفحة الرسمية. لا يحذف أي شيء. */

export const SITE_AGENT_VERSION = "1.0.0";

type Opts = { platformUrl: string; siteCode: string; siteKey: string };

export function buildSiteAgentPhp({ platformUrl, siteCode, siteKey }: Opts): string {
  return `<?php
/**
 * tvcc-site.php — برنامج الموقع للاتصال بمنصة TVCC (نبضة موقّعة كل 60 ثانية).
 * الاستعمال: ضع الملف في جذر الموقع واستدعه من الصفحة الرئيسية:
 *   require_once __DIR__ . '/tvcc-site.php'; tvcc_beat(); echo tvcc_badge();
 * أو شغّله عبر cron:  * * * * * php /var/www/site/tvcc-site.php
 * المفتاح خاص بهذا الموقع ولا يُنشر في الواجهة.
 */
define('TVCC_URL', ${JSON.stringify(platformUrl)});
define('TVCC_SITE', ${JSON.stringify(siteCode)});
define('TVCC_KEY', ${JSON.stringify(siteKey)});
define('TVCC_VERSION', ${JSON.stringify(SITE_AGENT_VERSION)});
define('TVCC_STATE', sys_get_temp_dir() . '/tvcc-' . TVCC_SITE . '.json');

function tvcc_beat($force = false) {
  if (!$force && file_exists(TVCC_STATE) && (time() - filemtime(TVCC_STATE)) < 60) {
    return json_decode(@file_get_contents(TVCC_STATE), true);
  }
  $payload = json_encode(array(
    'site' => TVCC_SITE,
    'ts' => round(microtime(true) * 1000),
    'version' => TVCC_VERSION,
    'meta' => array(
      'php' => PHP_VERSION,
      'host' => gethostname(),
      'path' => __DIR__,
    ),
  ));
  $sign = hash_hmac('sha256', $payload, TVCC_KEY);
  $ctx = stream_context_create(array('http' => array(
    'method' => 'POST',
    'timeout' => 8,
    'ignore_errors' => true,
    'header' => "Content-Type: application/json\\r\\nx-tvcc-site-sign: $sign\\r\\n",
    'content' => $payload,
  )));
  $res = @file_get_contents(TVCC_URL . '/api/public/site/heartbeat', false, $ctx);
  $data = $res ? json_decode($res, true) : null;
  if ($data && !empty($data['ok'])) { @file_put_contents(TVCC_STATE, $res); }
  return $data;
}

function tvcc_badge() {
  return '<div id="tvcc-badge" style="direction:ltr;display:inline-flex;align-items:center;gap:6px;font:600 12px system-ui;padding:4px 10px;border-radius:999px;background:#0f172a;color:#fff">'
    . '<span id="tvcc-dot" style="width:8px;height:8px;border-radius:50%;background:#64748b"></span>TVCC</div>'
    . '<script>fetch(' . json_encode(TVCC_URL . '/api/public/site/badge?site=' . TVCC_SITE) . ')'
    . '.then(function(r){return r.json()}).then(function(d){'
    . 'document.getElementById("tvcc-dot").style.background = d.connected ? "#22c55e" : "#ef4444";'
    . 'document.getElementById("tvcc-badge").title = d.connected ? "متصل بمنصة TVCC — مجموعة HN" : "غير متصل بالمنصة";'
    . '}).catch(function(){});</script>';
}

if (php_sapi_name() === 'cli') { $r = tvcc_beat(true); echo json_encode($r) . PHP_EOL; }
`;
}

export function buildSiteAgentNode({ platformUrl, siteCode, siteKey }: Opts): string {
  return `#!/usr/bin/env node
/**
 * tvcc-site.js — برنامج الموقع (Node 18+) للاتصال بمنصة TVCC.
 * التشغيل الدائم:  nohup node tvcc-site.js &
 * دورة واحدة:      node tvcc-site.js --once
 */
const crypto = require("crypto");

const PLATFORM = process.env.TVCC_URL || ${JSON.stringify(platformUrl)};
const SITE = process.env.TVCC_SITE || ${JSON.stringify(siteCode)};
const KEY = process.env.TVCC_SITE_KEY || ${JSON.stringify(siteKey)};
const VERSION = ${JSON.stringify(SITE_AGENT_VERSION)};
const ONCE = process.argv.includes("--once");
let interval = 60000;

function log(...a) { console.log(new Date().toISOString(), ...a); }

async function beat() {
  const payload = JSON.stringify({
    site: SITE,
    ts: Date.now(),
    version: VERSION,
    meta: { node: process.version, host: require("os").hostname(), cwd: process.cwd() },
  });
  const sign = crypto.createHmac("sha256", KEY).update(payload).digest("hex");
  const res = await fetch(PLATFORM + "/api/public/site/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tvcc-site-sign": sign },
    body: payload,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error("HTTP " + res.status + " " + (data.error || ""));
  if (data.interval_seconds) interval = data.interval_seconds * 1000;
  log("نبضة مرسلة —", data.site && data.site.code, "متصل");
  return data;
}

async function main() {
  while (true) {
    try { await beat(); } catch (e) { log("فشل النبضة:", e.message); }
    if (ONCE) return;
    await new Promise((r) => setTimeout(r, interval));
  }
}

main();
`;
}

/** شارة TVCC لأي موقع لا يستعمل PHP — تُلصق في أعلى الصفحة الرسمية. */
export function buildBadgeSnippet({ platformUrl, siteCode }: Omit<Opts, "siteKey">): string {
  return `<!-- شارة TVCC — ضعها أعلى الصفحة الرسمية للموقع -->
<div id="tvcc-badge" style="direction:ltr;display:inline-flex;align-items:center;gap:6px;font:600 12px system-ui;padding:4px 10px;border-radius:999px;background:#0f172a;color:#fff">
  <span id="tvcc-dot" style="width:8px;height:8px;border-radius:50%;background:#64748b"></span>TVCC
</div>
<script>
(function () {
  var url = ${JSON.stringify(`${platformUrl}/api/public/site/badge?site=${siteCode}`)};
  function refresh() {
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var dot = document.getElementById("tvcc-dot");
      var box = document.getElementById("tvcc-badge");
      if (!dot || !box) return;
      dot.style.background = d.connected ? "#22c55e" : "#ef4444";
      box.title = d.connected ? "متصل بمنصة TVCC — مجموعة HN" : "غير متصل بالمنصة";
    }).catch(function () {});
  }
  refresh();
  setInterval(refresh, 60000);
})();
</script>
`;
}
