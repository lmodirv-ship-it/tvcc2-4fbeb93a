export function buildAgentScript(serverId: string, token: string, endpoint: string): string {
  return `#!/usr/bin/env bash
# TVCC agent — resources + AI models + open ports + configs, and runs whitelisted commands
set -euo pipefail
TVCC_SERVER_ID="${serverId}"
TVCC_TOKEN="${token}"
TVCC_ENDPOINT="${endpoint}"
TVCC_AI_ENDPOINT="\${TVCC_AI_ENDPOINT:-http://127.0.0.1:11434}"
TVCC_BACKUP_DIR="\${TVCC_BACKUP_DIR:-/var/backups/tvcc}"
TVCC_AGENT_VERSION="2.3.0"
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

run_command() { # $1 = action, $2 = args json, $3 = dry_run -> prints output
  local ACTION="$1" ARGS="$2" DRY="$3"
  local GET; GET() { echo "$ARGS" | python3 -c "import sys,json;print(json.load(sys.stdin).get('\$1','') )" 2>/dev/null || echo ""; }
  if [ "$DRY" = "true" ]; then
    case "$ACTION" in
      scan_ports)      echo "[dry-run] ss -tulpn || netstat -tulpn" ;;
      read_configs)    echo "[dry-run] nginx -T | head -400" ;;
      service_status)  echo "[dry-run] systemctl status $(GET name)" ;;
      service_restart) echo "[dry-run] systemctl restart $(GET name)" ;;
      service_logs)    echo "[dry-run] journalctl -u $(GET name) -n 200" ;;
      nginx_test)      echo "[dry-run] nginx -t" ;;
      nginx_reload)    echo "[dry-run] nginx -t && systemctl reload nginx" ;;
      firewall_list)   echo "[dry-run] ufw status || iptables -L -n" ;;
      firewall_allow)  echo "[dry-run] ufw allow $(GET port)" ;;
      firewall_deny)   echo "[dry-run] ufw deny $(GET port)" ;;
      disk_usage)      echo "[dry-run] df -h && du -sh /var/www/*" ;;
      write_config)
        local PATH_=$(GET path) CONTENT=$(GET content)
        echo "[dry-run] would write to $PATH_"
        if command -v diff >/dev/null && [ -f "$PATH_" ]; then
          echo "--- diff preview ---"
          printf '%s' "$CONTENT" | diff -u "$PATH_" - || true
        fi
        ;;
      site_backup)     echo "[dry-run] tar czf /var/backups/tvcc/\${D}-\$(date).tar.gz /var/www/\$D" ;;
      site_restore)    echo "[dry-run] tar xzf $(GET storage_path) -C /" ;;
      db_dump)         echo "[dry-run] mysqldump --single-transaction DB | gzip > file.sql.gz" ;;
      db_import)       echo "[dry-run] gunzip -c $(GET storage_path) | mysql $(GET database)" ;;
      backup_delete)   echo "[dry-run] rm -f $(GET storage_path)" ;;
      platform_deploy) echo "[dry-run] $(GET script)" ;;
      link_check)      echo "[dry-run] nc -z -w5 $(GET host) $(GET port)" ;;
      sync_site)       echo "[dry-run] rsync -az --delete /var/www/$(GET domain)/ $(GET target_host):/var/www/$(GET domain)/" ;;
      storage_usage)   echo "[dry-run] du -sm /var/www/*" ;;
      site_dir)        echo "[dry-run] mkdir -p /var/www/$(GET domain) && chown -R www-data:www-data /var/www/$(GET domain)" ;;
      issue_ssl)       echo "[dry-run] certbot --nginx -d $(GET domain) --non-interactive --agree-tos -m admin@$(GET domain)" ;;
      port_check)      echo "[dry-run] nc -z -w5 $(GET host) $(GET port)" ;;
      port_forward)    echo "[dry-run] socat TCP4-LISTEN:$(GET local_port),fork,reuseaddr TCP4:$(GET target_host):$(GET target_port) (systemd unit $(GET name))" ;;
      ai_models_list)  echo "[dry-run] curl http://127.0.0.1:$(GET port)/api/tags" ;;
      ollama_start)    echo "[dry-run] systemctl start ollama" ;;
      ollama_stop)     echo "[dry-run] systemctl stop ollama" ;;
      ollama_pull)     echo "[dry-run] ollama pull $(GET model)" ;;
      ollama_rm)       echo "[dry-run] ollama rm $(GET model)" ;;
      ollama_ps)       echo "[dry-run] ollama ps" ;;
      *) echo "[dry-run] unsupported action: $ACTION"; return 127 ;;
    esac
    return 0
  fi
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
    backup_delete)   rm -f "$(GET storage_path)" && echo "deleted $(GET storage_path)" ;;
    platform_deploy) bash -lc "$(GET script)" ;;
    link_check)      H="$(GET host)"; P="$(GET port)"; S=$(date +%s%3N); if nc -z -w5 "$H" "\${P:-22}" 2>/dev/null; then E=$(date +%s%3N); echo "reachable $H:\${P:-22} latency_ms=$((E-S))"; else echo "unreachable $H:\${P:-22}"; exit 1; fi ;;
    sync_site)       D="$(GET domain)"; T="$(GET target_host)"; rsync -az --delete -e "ssh -o StrictHostKeyChecking=no" "/var/www/$D/" "$T:/var/www/$D/" 2>&1 && echo "synced $D -> $T" ;;
    storage_usage)   du -sm /var/www/* 2>/dev/null | awk '{print $2" "$1"MB"}' | head -200 ;;
    site_dir)        D="$(GET domain)"; mkdir -p "/var/www/$D" && chown -R www-data:www-data "/var/www/$D" 2>/dev/null; echo "ready /var/www/$D ($(du -sm "/var/www/$D" | cut -f1) MB)" ;;
    issue_ssl)       D="$(GET domain)"; certbot --nginx -d "$D" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tail -20 ;;
    port_check)      H="$(GET host)"; P="$(GET port)"; S=$(date +%s%3N); if nc -z -w5 "\${H:-127.0.0.1}" "$P" 2>/dev/null; then E=$(date +%s%3N); echo "open \${H:-127.0.0.1}:$P latency_ms=$((E-S))"; else echo "closed \${H:-127.0.0.1}:$P"; exit 1; fi ;;
    port_forward)
      N="$(GET name)"; LP="$(GET local_port)"; TH="$(GET target_host)"; TP="$(GET target_port)"
      command -v socat >/dev/null || (apt-get update -y >/dev/null 2>&1 && apt-get install -y socat >/dev/null 2>&1)
      cat > "/etc/systemd/system/\${N}.service" <<EOF2
[Unit]
Description=TVCC port bridge \${N}
After=network.target

[Service]
ExecStart=/usr/bin/socat TCP4-LISTEN:\${LP},fork,reuseaddr TCP4:\${TH}:\${TP}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF2
      systemctl daemon-reload && systemctl enable --now "\${N}.service" && systemctl is-active "\${N}.service" && echo "bridge \${LP} -> \${TH}:\${TP} active" ;;
    ai_models_list)  P="$(GET port)"; curl -s -m 8 "http://127.0.0.1:\${P}/api/tags" || curl -s -m 8 "http://127.0.0.1:\${P}/v1/models" || echo "no response on \${P}" ;;
    ollama_start)    systemctl start ollama 2>/dev/null || (OLLAMA_HOST=0.0.0.0:$(GET port) nohup ollama serve >/var/log/ollama.log 2>&1 & echo started) ;;
    ollama_stop)     systemctl stop ollama 2>/dev/null || pkill -f "ollama serve" || true; echo "stopped" ;;
    ollama_pull)     ollama pull "$(GET model)" 2>&1 | tail -5 ;;
    ollama_rm)       ollama rm "$(GET model)" 2>&1 | tail -5 ;;
    ollama_ps)       ollama ps 2>&1 | head -30 ;;
    *) echo "unsupported action: $ACTION"; return 127 ;;
  esac
}

install_systemd() {
  cat > /etc/systemd/system/tvcc-agent.service <<'EOF'
[Unit]
Description=TVCC Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/tvcc-agent.sh
Restart=always
RestartSec=10
User=root
Environment="TVCC_BACKUP_DIR=/var/backups/tvcc"

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable tvcc-agent.service
  systemctl start tvcc-agent.service
  echo "systemd service installed and started"
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
  PUBLIC_IP=$( (curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || echo "") | head -1 | tr -d '\\n')
  PRIVATE_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '\\n')

  # Detect a TVCC platform copy running on this server (pm2 process, service or /opt/tvcc)
  TVCC_NODE=false
  TVCC_VERSION=""
  if pm2 jlist 2>/dev/null | grep -qi '"name":"tvcc' || systemctl is-active --quiet tvcc 2>/dev/null || [ -d /opt/tvcc ]; then
    TVCC_NODE=true
    TVCC_VERSION=$(cat /opt/tvcc/package.json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin).get("version",""))' 2>/dev/null || echo "")
  fi


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
    pm=re.search(r"\\(\\"([^\\"]*)\\"", line)
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

  BODY="{\\"cpu_percent\\":\${CPU:-0},\\"mem_used_mb\\":\${MEM_USED:-0},\\"mem_total_mb\\":\${MEM_TOTAL:-0},\\"disk_used_gb\\":\${DISK_USED:-0},\\"disk_total_gb\\":\${DISK_TOTAL:-0},\\"load_avg\\":\${LOAD:-0},\\"uptime_seconds\\":\${UPTIME:-0},\\"process_count\\":\${PROCS:-0},\\"os\\":\\"\${OS}\\",\\"agent_version\\":\\"\${TVCC_AGENT_VERSION}\\",\\"public_ip\\":\\"\${PUBLIC_IP}\\",\\"private_ip\\":\\"\${PRIVATE_IP}\\",\\"is_tvcc_node\\":\${TVCC_NODE},\\"tvcc_version\\":\\"\${TVCC_VERSION}\\",\\"ai_endpoint\\":\\"\${TVCC_AI_ENDPOINT}\\",\\"ai_models\\":\${AI_MODELS},\\"ports\\":\${PORTS},\\"configs\\":\${CONFIGS}}"

  RESP=$(post "$BODY")

  # Execute any queued whitelisted commands, then report results back.
  CMDS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin).get("commands",[])))' 2>/dev/null || echo "[]")
  COUNT=$(echo "$CMDS" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
  if [ "\${COUNT:-0}" -gt 0 ]; then
    RESULTS="["
    for i in $(seq 0 $((COUNT-1))); do
      ID=$(echo "$CMDS" | python3 -c "import sys,json;print(json.load(sys.stdin)[$i]['id'])") || continue
      ACTION=$(echo "$CMDS" | python3 -c "import sys,json;print(json.load(sys.stdin)[$i]['action'])") || continue
      ARGS=$(echo "$CMDS" | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)[$i].get('args',{})))") || continue
      DRY=$(echo "$CMDS" | python3 -c "import sys,json;print('true' if json.load(sys.stdin)[$i].get('dry_run') else 'false')") || continue
      set +e
      OUT=$(run_command "$ACTION" "$ARGS" "$DRY" 2>&1 | tail -c 20000)
      CODE=$?
      set -e
      OUT_J=$(printf '%s' "$OUT" | json_escape)
      [ "$RESULTS" != "[" ] && RESULTS="$RESULTS,"
      RESULTS="$RESULTS{\\"id\\":\\"$ID\\",\\"exit_code\\":$CODE,\\"output\\":$OUT_J}"
    done
    RESULTS="$RESULTS]"
    post "{\\"agent_version\\":\\"\${TVCC_AGENT_VERSION}\\",\\"command_results\\":$RESULTS}" >/dev/null
  fi

  sleep 60
done
`;
}
