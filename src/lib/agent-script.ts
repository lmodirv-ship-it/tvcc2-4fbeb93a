export function buildAgentScript(serverId: string, token: string, endpoint: string): string {
  return `#!/usr/bin/env bash
# TVCC agent — resources + AI models + open ports + configs, and runs whitelisted commands
set -euo pipefail
TVCC_SERVER_ID="${serverId}"
TVCC_TOKEN="${token}"
TVCC_ENDPOINT="${endpoint}"
TVCC_AI_ENDPOINT="\${TVCC_AI_ENDPOINT:-http://127.0.0.1:11434}"
TVCC_BACKUP_DIR="\${TVCC_BACKUP_DIR:-/var/backups/tvcc}"
mkdir -p "$TVCC_BACKUP_DIR"

json_escape() { python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))'; }

post() { # $1 = body -> echoes response
  local BODY="$1"
  local SIG
  SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$TVCC_TOKEN" -hex | awk '{print $NF}')
  curl -s -X POST "$TVCC_ENDPOINT" \\
    -H "content-type: application/json" \\
    -H "x-tvcc-server: $TVCC_SERVER_ID" \\
    -H "x-tvcc-signature: sha256=$SIG" \\
    --data "$BODY" || echo '{}'
}

run_command() { # $1 = action, $2 = args json -> prints output
  local ACTION="$1" ARGS="$2"
  local GET; GET() { echo "$ARGS" | python3 -c "import sys,json;print(json.load(sys.stdin).get('$1','') )" 2>/dev/null || echo ""; }
  case "$ACTION" in
    scan_ports)      ss -tulpn 2>/dev/null || netstat -tulpn ;;
    read_configs)    nginx -T 2>/dev/null | head -400 ;;
    service_status)  systemctl status "$(GET name)" --no-pager 2>&1 | head -40 ;;
    service_restart) systemctl restart "$(GET name)" && echo "restarted $(GET name)" ;;
    service_logs)    journalctl -u "$(GET name)" -n 200 --no-pager 2>&1 ;;
    nginx_test)      nginx -t 2>&1 ;;
    nginx_reload)    nginx -t && systemctl reload nginx && echo "nginx reloaded" ;;
    firewall_list)   ufw status numbered 2>&1 || iptables -L -n ;;
    firewall_allow)  ufw allow "$(GET port)" 2>&1 ;;
    firewall_deny)   ufw deny "$(GET port)" 2>&1 ;;
    disk_usage)      df -h; echo; du -sh /var/www/* 2>/dev/null | head -50 ;;
    write_config)    echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);open(d["path"],"w").write(d.get("content",""))' && echo "wrote $(GET path)" ;;
    site_backup)     D="$(GET domain)"; F="$TVCC_BACKUP_DIR/\${D}-$(date +%Y%m%d%H%M%S).tar.gz"; tar czf "$F" "/var/www/$D" 2>/dev/null && echo "$F ($(du -m "$F" | cut -f1) MB)" ;;
    site_restore)    tar xzf "$(GET storage_path)" -C / && echo "restored $(GET storage_path)" ;;
    db_dump)         D="$(GET domain)"; F="$TVCC_BACKUP_DIR/\${D}-$(date +%Y%m%d%H%M%S).sql.gz"; mysqldump --single-transaction "\${D//./_}" 2>/dev/null | gzip > "$F" && echo "$F" ;;
    db_import)       gunzip -c "$(GET storage_path)" | mysql "$(GET database)" && echo "imported" ;;
    platform_deploy) bash -lc "$(GET script)" ;;
    *) echo "unsupported action: $ACTION"; return 127 ;;
  esac
}

while true; do
  CPU=$(top -bn1 | awk '/Cpu\\(s\\)/{print 100 - $8}' | head -1)
  MEM_TOTAL=$(free -m | awk '/Mem:/{print $2}')
  MEM_USED=$(free -m | awk '/Mem:/{print $3}')
  DISK_TOTAL=$(df -BG --output=size / | tail -1 | tr -dc '0-9')
  DISK_USED=$(df -BG --output=used / | tail -1 | tr -dc '0-9')
  LOAD=$(awk '{print $1}' /proc/loadavg)
  UPTIME=$(awk '{print int($1)}' /proc/uptime)
  PROCS=$(ps -e --no-headers | wc -l)
  OS=$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)

  AI_RAW=$(curl -s --max-time 3 "$TVCC_AI_ENDPOINT/api/tags" || echo "")
  if [ -n "$AI_RAW" ]; then
    AI_MODELS=$(echo "$AI_RAW" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(json.dumps([{"model_id":m["name"],"name":m["name"],"size_mb":round(m.get("size",0)/1048576)} for m in d.get("models",[])]))' 2>/dev/null || echo "[]")
  else
    AI_MODELS="[]"
  fi

  PORTS=$( (ss -tulpnH 2>/dev/null || true) | python3 -c '
import sys,json,re
out=[]
for line in sys.stdin:
    p=line.split()
    if len(p)<5: continue
    proto=p[0]; local=p[4]
    m=re.search(r":(\\d+)$", local)
    if not m: continue
    addr=local[:m.start()].strip("[]")
    pm=re.search(r"\\(\\(\\"([^\\"]+)\\"", line)
    out.append({"port":int(m.group(1)),"protocol":proto[:4],"address":addr or "*","process_name":pm.group(1) if pm else None})
seen=set(); uniq=[]
for o in out:
    k=(o["port"],o["protocol"],o["address"])
    if k in seen: continue
    seen.add(k); uniq.append(o)
print(json.dumps(uniq[:300]))' 2>/dev/null || echo "[]")

  CONFIGS="[]"
  if command -v python3 >/dev/null; then
    CONFIGS=$(python3 -c '
import json,os
paths=[("nginx","/etc/nginx/nginx.conf"),("firewall","/etc/ufw/user.rules"),("hosts","/etc/hosts"),("ssh","/etc/ssh/sshd_config")]
out=[]
for kind,p in paths:
    try:
        with open(p) as f: out.append({"kind":kind,"path":p,"content":f.read()[:20000]})
    except Exception: pass
print(json.dumps(out))' 2>/dev/null || echo "[]")
  fi

  BODY="{\\"cpu_percent\\":\${CPU:-0},\\"mem_used_mb\\":\${MEM_USED:-0},\\"mem_total_mb\\":\${MEM_TOTAL:-0},\\"disk_used_gb\\":\${DISK_USED:-0},\\"disk_total_gb\\":\${DISK_TOTAL:-0},\\"load_avg\\":\${LOAD:-0},\\"uptime_seconds\\":\${UPTIME:-0},\\"process_count\\":\${PROCS:-0},\\"os\\":\\"\${OS}\\",\\"agent_version\\":\\"2.0.0\\",\\"ai_endpoint\\":\\"\${TVCC_AI_ENDPOINT}\\",\\"ai_models\\":\${AI_MODELS},\\"ports\\":\${PORTS},\\"configs\\":\${CONFIGS}}"

  RESP=$(post "$BODY")

  # Execute any queued whitelisted commands, then report results back.
  CMDS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin).get("commands",[])))' 2>/dev/null || echo "[]")
  COUNT=$(echo "$CMDS" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
  if [ "\${COUNT:-0}" -gt 0 ]; then
    RESULTS="["
    for i in $(seq 0 $((COUNT-1))); do
      ID=$(echo "$CMDS" | python3 -c "import sys,json;print(json.load(sys.stdin)[$i]['id'])")
      ACTION=$(echo "$CMDS" | python3 -c "import sys,json;print(json.load(sys.stdin)[$i]['action'])")
      ARGS=$(echo "$CMDS" | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)[$i].get('args',{})))")
      set +e
      OUT=$(run_command "$ACTION" "$ARGS" 2>&1 | tail -c 20000)
      CODE=$?
      set -e
      OUT_J=$(printf '%s' "$OUT" | json_escape)
      [ "$RESULTS" != "[" ] && RESULTS="$RESULTS,"
      RESULTS="$RESULTS{\\"id\\":\\"$ID\\",\\"exit_code\\":$CODE,\\"output\\":$OUT_J}"
    done
    RESULTS="$RESULTS]"
    post "{\\"agent_version\\":\\"2.0.0\\",\\"command_results\\":$RESULTS}" >/dev/null
  fi

  sleep 60
done
`;
}
