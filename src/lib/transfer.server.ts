/** Server-only helpers for the file transfer / remote build feature. */

export interface DeploySpec {
  name: string;
  targetPath: string;
  port: number;
  service: string;
  installCmd?: string | null;
  buildCmd?: string | null;
  startCmd?: string | null;
  outputDir?: string | null;
}

/** Safe slug for directory + systemd unit names. */
export function slugName(raw: string): string {
  const s = (raw || "site")
    .toLowerCase()
    .replace(/\.zip$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "site";
}

export function normalizePath(raw?: string | null): string {
  const p = (raw || "/home/ismail/hn").trim();
  if (!/^\/[A-Za-z0-9._/-]*$/.test(p)) return "/home/ismail/hn";
  return p.replace(/\/+$/, "") || "/";
}

function psQuote(v: string | number | null | undefined): string {
  return `'${String(v ?? "").replace(/'/g, "''")}'`;
}

/**
 * PowerShell fallback: uploads a local folder to the server over SSH/SCP,
 * then builds and starts it there. Used when no agent is installed.
 */
export function buildPowerShellScript(opts: {
  host: string;
  user: string;
  sshPort: number;
  localPath: string;
  spec: DeploySpec;
}): string {
  const { host, user, sshPort, localPath, spec } = opts;
  const dir = `${spec.targetPath}/${spec.name}`;
  const remote = `
set -e
mkdir -p '${dir}'
cd '${dir}'
if [ -f package.json ]; then
  command -v node >/dev/null || (apt-get update -y && apt-get install -y nodejs npm)
  ${spec.installCmd || "npm install || npm install --legacy-peer-deps || npm install --force"}
  ${spec.buildCmd || 'if grep -q \'"build"\' package.json; then npm run build; fi'}
fi
OUT='${spec.outputDir || ""}'
if [ -z "$OUT" ]; then for d in dist build out .output/public; do [ -d "$d" ] && OUT="$d" && break; done; fi
EXEC='${spec.startCmd || ""}'
if [ -z "$EXEC" ]; then
  if grep -q '"start"' package.json 2>/dev/null; then EXEC='npm run start';
  else EXEC="python3 -m http.server ${spec.port} --bind 0.0.0.0 --directory ${dir}/\${OUT:-.}"; fi
fi
cat > /etc/systemd/system/${spec.service}.service <<UNIT
[Unit]
Description=TVCC site ${spec.name}
After=network.target
[Service]
WorkingDirectory=${dir}
Environment="PORT=${spec.port}"
Environment="HOST=0.0.0.0"
ExecStart=/bin/bash -lc "$EXEC"
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now ${spec.service}
ufw allow ${spec.port}/tcp || true
sleep 3
systemctl is-active ${spec.service} || journalctl -u ${spec.service} -n 40 --no-pager
curl -s -o /dev/null -w 'HTTP %{http_code}\\n' http://127.0.0.1:${spec.port} || true
`.trim();

  return `# TVCC — نقل وبناء وتشغيل موقع على السيرفر
# شغّل هذا الملف في PowerShell على حاسوبك (يتطلب OpenSSH: ssh / scp)
$ErrorActionPreference = 'Stop'
$Server   = ${psQuote(host)}
$User     = ${psQuote(user)}
$SshPort  = ${sshPort}
$Local    = ${psQuote(localPath)}
$RemoteDir= ${psQuote(dir)}
$Service  = ${psQuote(spec.service)}
$Port     = ${spec.port}

function Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "!! $m" -ForegroundColor Red; exit 1 }

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  Fail "OpenSSH غير مثبت. ثبّته: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0"
}
if (-not (Test-Path $Local)) { Fail "المسار المحلي غير موجود: $Local" }

Step "ضغط الملفات محلياً"
$Zip = Join-Path $env:TEMP ("tvcc-" + $Service + ".zip")
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path (Join-Path $Local '*') -DestinationPath $Zip -Force

Step "اختبار الاتصال بالسيرفر ($Server)"
ssh -p $SshPort -o StrictHostKeyChecking=accept-new "$User@$Server" "echo ok" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "تعذّر الاتصال بـ SSH — تحقّق من IP والمستخدم وكلمة المرور/المفتاح" }

Step "إنشاء المجلد على السيرفر: $RemoteDir"
ssh -p $SshPort "$User@$Server" "mkdir -p '$RemoteDir'"

Step "رفع الحزمة"
scp -P $SshPort $Zip "\${User}@\${Server}:/tmp/tvcc-upload.zip"
if ($LASTEXITCODE -ne 0) { Fail "فشل الرفع (scp)" }

Step "فك الضغط على السيرفر"
ssh -p $SshPort "$User@$Server" "command -v unzip >/dev/null || (apt-get update -y && apt-get install -y unzip); unzip -oq /tmp/tvcc-upload.zip -d '$RemoteDir' && rm -f /tmp/tvcc-upload.zip"
if ($LASTEXITCODE -ne 0) { Fail "فشل فك الضغط على السيرفر" }

Step "البناء والتشغيل وفتح المنفذ $Port"
$Remote = @'
${remote}
'@
$Remote = $Remote -replace "\`r", ""
$Remote | ssh -p $SshPort "$User@$Server" "sudo bash -s"
if ($LASTEXITCODE -ne 0) { Fail "فشل البناء/التشغيل — راجع السجلات أعلاه" }

Step "تم ✓  الموقع يعمل على  http://\${Server}:$Port"
Write-Host "خدمة systemd: $Service   |   المجلد: $RemoteDir" -ForegroundColor Green
`;
}
