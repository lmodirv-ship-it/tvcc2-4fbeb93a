import { AGENT_VERSION } from "./agent-version";

export function buildAgentScript(serverId: string, token: string, endpoint: string): string {
  return `#!/usr/bin/env bash
# TVCC agent — metrics heartbeat + fast task channel (long-poll) + self-update
set -euo pipefail
TVCC_SERVER_ID="${serverId}"
TVCC_TOKEN="${token}"
TVCC_ENDPOINT="${endpoint}"
TVCC_TASK_ENDPOINT="\${TVCC_TASK_ENDPOINT:-${endpoint.replace(/\/heartbeat$/, "/commands")}}"
TVCC_TASK_WAIT="\${TVCC_TASK_WAIT:-15000}"
TVCC_AI_ENDPOINT="\${TVCC_AI_ENDPOINT:-http://127.0.0.1:11434}"
TVCC_BACKUP_DIR="\${TVCC_BACKUP_DIR:-/var/backups/tvcc}"
TVCC_AGENT_VERSION="${AGENT_VERSION}"
TVCC_HEARTBEAT_INTERVAL="\${TVCC_HEARTBEAT_INTERVAL:-60}"
# Multi-agent support: run several agents on one server, each with its own key/role.
# Example second agent: TVCC_AGENT_KEY=db TVCC_AGENT_ROLE=db ./tvcc-agent.sh
TVCC_AGENT_KEY="\${TVCC_AGENT_KEY:-main}"
TVCC_AGENT_ROLE="\${TVCC_AGENT_ROLE:-\$TVCC_AGENT_KEY}"
TVCC_STATE_DIR="\${TVCC_STATE_DIR:-/var/lib/tvcc}"
TVCC_HN_DIR="\${TVCC_HN_DIR:-/home/ismail/hn}"
mkdir -p "$TVCC_BACKUP_DIR"
mkdir -p "$TVCC_HN_DIR" 2>/dev/null || true
mkdir -p "$TVCC_STATE_DIR" 2>/dev/null || true
# stable agent id per machine (key-scoped so multiple agents coexist)
TVCC_AGENT_ID=$(cat "/etc/tvcc-agent-id-\${TVCC_AGENT_KEY}" 2>/dev/null || true)
if [ -z "\${TVCC_AGENT_ID:-}" ]; then
  TVCC_AGENT_ID=$( (cat /etc/machine-id 2>/dev/null || head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \\n') )
  echo "$TVCC_AGENT_ID" > "/etc/tvcc-agent-id-\${TVCC_AGENT_KEY}" 2>/dev/null || true
fi
# machine fingerprint for duplicate-server detection
TVCC_MACHINE_ID=$(cat /etc/machine-id 2>/dev/null || echo "\${TVCC_AGENT_ID}")


json_escape() { python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))'; }

free_port() { # $1 = wanted port -> prints a free port
  local P="\${1:-3000}"
  local I=0
  while [ $I -lt 60 ]; do
    if ! (ss -tulpnH 2>/dev/null | awk '{print $5}' | grep -qE ":$P\\$"); then echo "$P"; return 0; fi
    P=$((P+1)); I=$((I+1))
  done
  echo "$P"
}

ensure_node() {
  command -v node >/dev/null && return 0
  (apt-get update -y >/dev/null 2>&1 && apt-get install -y nodejs npm >/dev/null 2>&1) || true
  command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1 && apt-get install -y nodejs >/dev/null 2>&1) || true
  command -v node >/dev/null
}

write_site_unit() { # $1 name, $2 dir, $3 exec, $4 port
  cat > "/etc/systemd/system/$1.service" <<EOFU
[Unit]
Description=TVCC site $1
After=network.target

[Service]
WorkingDirectory=$2
Environment="PORT=$4"
Environment="HOST=0.0.0.0"
Environment="NODE_ENV=production"
ExecStart=/bin/bash -lc "$3"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOFU
  systemctl daemon-reload
  systemctl enable "$1.service" >/dev/null 2>&1 || true
  systemctl restart "$1.service" 2>&1 | tail -3
}

tvcc_deploy() { # $1 url $2 name $3 base $4 port $5 install $6 build $7 start $8 outdir $9 service
  local URL="$1" NAME="$2" BASE="$3" WPORT="$4" INS="$5" BLD="$6" STR="$7" OUT="$8" SVC="$9"
  [ -z "$BASE" ] && BASE="$TVCC_HN_DIR"
  local DIR="$BASE/$NAME"
  echo "== target: $DIR"
  mkdir -p "$DIR" || { echo "ERR: cannot create $DIR"; return 2; }
  local TMP="/tmp/tvcc-$NAME.zip"
  curl -fsSL --max-time 600 -o "$TMP" "$URL" || { echo "ERR: download failed"; return 3; }
  echo "== downloaded $(du -m "$TMP" | cut -f1)MB"
  command -v unzip >/dev/null || (apt-get update -y >/dev/null 2>&1 && apt-get install -y unzip >/dev/null 2>&1)
  rm -rf "$DIR.new"; mkdir -p "$DIR.new"
  unzip -oq "$TMP" -d "$DIR.new" || { echo "ERR: unzip failed"; rm -f "$TMP"; return 4; }
  # flatten single wrapper folder
  local INNER
  INNER=$(find "$DIR.new" -mindepth 1 -maxdepth 1 | head -2 | wc -l)
  if [ "$INNER" = "1" ] && [ -d "$(find "$DIR.new" -mindepth 1 -maxdepth 1)" ] && [ ! -f "$DIR.new/index.html" ]; then
    local SUB; SUB=$(find "$DIR.new" -mindepth 1 -maxdepth 1)
    if [ -f "$SUB/package.json" ] || [ -f "$SUB/index.html" ]; then mv "$SUB"/* "$SUB"/.[!.]* "$DIR.new"/ 2>/dev/null || true; rmdir "$SUB" 2>/dev/null || true; fi
  fi
  cp -a "$DIR.new/." "$DIR/" && rm -rf "$DIR.new" "$TMP"
  echo "== extracted $(find "$DIR" -type f | wc -l) files"
  cd "$DIR" || return 5

  local EXEC="" STATIC=false
  if [ -f package.json ]; then
    ensure_node || { echo "ERR: Node.js غير مثبت وتعذّر تثبيته تلقائياً — ثبّته يدوياً: apt install nodejs npm"; return 6; }
    local PM="npm"
    [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null && PM="pnpm"
    [ -f bun.lockb ] && command -v bun >/dev/null && PM="bun"
    [ -f yarn.lock ] && command -v yarn >/dev/null && PM="yarn"
    echo "== installing with $PM"
    if [ -n "$INS" ]; then
      bash -lc "$INS" 2>&1 | tail -n 25 || true
    else
      bash -lc "$PM install" 2>&1 | tail -n 25 || bash -lc "npm install --legacy-peer-deps" 2>&1 | tail -n 25 || bash -lc "npm install --force" 2>&1 | tail -n 25 || echo "WARN: install failed"
    fi
    local BUILDCMD="$BLD"
    if [ -z "$BUILDCMD" ] && grep -q '"build"' package.json; then BUILDCMD="$PM run build"; fi
    if [ -n "$BUILDCMD" ]; then
      echo "== building: $BUILDCMD"
      if ! NODE_OPTIONS="--max-old-space-size=2048" bash -lc "$BUILDCMD" 2>&1 | tail -n 60; then
        echo "WARN: build failed, retrying with more memory"
        NODE_OPTIONS="--max-old-space-size=4096" bash -lc "$BUILDCMD" 2>&1 | tail -n 60 || echo "ERR: build failed twice"
      fi
    fi
    [ -z "$OUT" ] && for D in dist build out public .output/public; do [ -d "$D" ] && OUT="$D" && break; done
    if [ -n "$STR" ]; then EXEC="$STR"
    elif grep -q '"start"' package.json; then EXEC="$PM run start"
    elif [ -n "$OUT" ]; then STATIC=true
    else EXEC="node index.js"; fi
  elif [ -f requirements.txt ]; then
    command -v python3 >/dev/null || (apt-get update -y >/dev/null 2>&1 && apt-get install -y python3 python3-pip >/dev/null 2>&1)
    python3 -m pip install -r requirements.txt >/dev/null 2>&1 || pip3 install -r requirements.txt 2>&1 | tail -n 10 || echo "WARN: pip install failed"
    EXEC="\${STR:-python3 app.py}"
  else
    STATIC=true; [ -z "$OUT" ] && OUT="."
  fi

  local PORT; PORT=$(free_port "\${WPORT:-3000}")
  [ "$PORT" != "\${WPORT:-3000}" ] && echo "WARN: المنفذ \${WPORT} مشغول — تم اختيار $PORT"

  if [ "$STATIC" = "true" ]; then
    EXEC="python3 -m http.server $PORT --bind 0.0.0.0 --directory $DIR/\${OUT:-.}"
  fi

  local SERVICE="\${SVC:-tvcc-hn-$NAME}"
  echo "== service: $SERVICE  exec: $EXEC"
  write_site_unit "$SERVICE" "$DIR" "$EXEC" "$PORT"
  sleep 3
  ufw allow "$PORT/tcp" >/dev/null 2>&1 || true
  if systemctl is-active --quiet "$SERVICE"; then
    local CODE; CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 8 "http://127.0.0.1:$PORT" || echo 000)
    echo "RESULT port=$PORT service=$SERVICE http=$CODE dir=$DIR"
    [ "$CODE" = "000" ] && { echo "WARN: لا استجابة على المنفذ — آخر السجلات:"; journalctl -u "$SERVICE" -n 40 --no-pager 2>&1 | tail -40; }
  else
    echo "ERR: الخدمة لم تعمل — آخر السجلات:"
    journalctl -u "$SERVICE" -n 60 --no-pager 2>&1 | tail -60
    echo "RESULT port=$PORT service=$SERVICE http=000 dir=$DIR"
    return 7
  fi
}


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

post_tasks() { # $1 = body -> echoes response of the fast task channel
  local BODY="$1"
  local SIG
  SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$TVCC_TOKEN" -hex | awk '{print $NF}')
  curl -s --max-time 60 -X POST "$TVCC_TASK_ENDPOINT" \\
    -H "content-type: application/json" \\
    -H "x-tvcc-server: $TVCC_SERVER_ID" \\
    -H "x-tvcc-signature: sha256=$SIG" \\
    --data "$BODY" || echo '{}'
}

jget() { # $1 = json, $2 = python expression on variable d
  printf '%s' "$1" | python3 -c "import sys,json;d=json.load(sys.stdin);print($2)" 2>/dev/null || echo ""
}

cap_allows() { # $1 = action -> 0 when allowed
  local F="$TVCC_STATE_DIR/caps.json"
  [ -s "$F" ] || return 0
  python3 - "$F" "$1" <<'PYCAP' 2>/dev/null || return 0
import json,sys
try:
    caps=json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
if not caps: sys.exit(0)
row=[c for c in caps if c.get("action")==sys.argv[2]]
sys.exit(0 if (not row or row[0].get("allowed")) else 3)
PYCAP
}

self_update() { # $1 = script url
  local URL="$1" TMP="/tmp/tvcc-agent.new"
  [ -n "$URL" ] || return 1
  curl -fsSL --max-time 60 -o "$TMP" "$URL" || { echo "download failed"; return 2; }
  bash -n "$TMP" || { echo "syntax check failed"; rm -f "$TMP"; return 3; }
  local SELF; SELF="$(readlink -f "$0" 2>/dev/null || echo /usr/local/bin/tvcc-agent.sh)"
  cp -f "$TMP" "$SELF" && chmod +x "$SELF" && rm -f "$TMP"
  echo "agent updated -> restarting"
  (systemctl restart tvcc-agent 2>/dev/null || kill -TERM $$) &
  return 0
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
      site_backup)     echo "[dry-run] tar czf $(GET dest_path)/\$D-\$(date).tar.gz /var/www/\$D then rsync -> $(GET target_host)" ;;
      site_archive)    echo "[dry-run] full archive of $(GET domain) -> $(GET target_user)@$(GET target_host):$(GET remote_path) ($(GET kind))" ;;
      site_restore)    echo "[dry-run] tar xzf $(GET storage_path) -C /" ;;
      db_dump)         echo "[dry-run] dump DB | gzip > $(GET dest_path)/file.sql.gz then rsync -> $(GET target_host)" ;;
      db_sync)         echo "[dry-run] dump source db then load into linked target db" ;;
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
      site_start)      echo "[dry-run] systemctl start $(GET name)" ;;
      site_stop)       echo "[dry-run] systemctl stop $(GET name)" ;;
      site_restart)    echo "[dry-run] systemctl restart $(GET name)" ;;
      site_logs)       echo "[dry-run] journalctl -u $(GET name) -n 200" ;;
      unit_write)      echo "[dry-run] write $(GET path) + systemctl daemon-reload + enable $(GET name)" ;;
      db_create)       echo "[dry-run] create database $(GET database) ($(GET engine))" ;;
      db_user_grant)   echo "[dry-run] create user $(GET user) and grant on $(GET database)" ;;
      db_ping)         echo "[dry-run] connect $(GET engine) $(GET host):$(GET port)/$(GET database)" ;;
      db_discover)     echo "[dry-run] discover PostgreSQL, Auth, Storage, Realtime and Functions on $(GET host):$(GET port)" ;;
      pg_meta)         echo "[dry-run] read PostgreSQL schemas, tables, columns, indexes and relations" ;;
      pg_rows)         echo "[dry-run] read a limited page from $(GET schema).$(GET table)" ;;
      pg_write)        echo "[dry-run] apply confirmed row mutation to $(GET schema).$(GET table)" ;;
      db_query)        echo "[dry-run] run confirmed SQL on $(GET database), read_only=$(GET read_only)" ;;
      db_policy)       echo "[dry-run] inspect/apply database policy" ;;
      auth_users)      echo "[dry-run] list local authentication metadata without passwords" ;;
      storage_list)    echo "[dry-run] list storage buckets and usage" ;;
      edge_functions_list) echo "[dry-run] list local functions" ;;
      realtime_inspect) echo "[dry-run] inspect realtime publications and slots" ;;
      advisor_scan)    echo "[dry-run] run database safety and performance advisors" ;;
      db_export)       echo "[dry-run] pg_dump full database to encrypted backup area" ;;
      db_import_full)  echo "[dry-run] verify then restore a full database export" ;;
      site_identity_provision) echo "[dry-run] create $(GET schema_name) and $(GET server_path) for site $(GET site_code)" ;;
      db_provision)    echo "[dry-run] provision database/schema $(GET database)" ;;
      db_migrate)      echo "[dry-run] migrate database with checksum and rollback point" ;;
      multi_sql)       echo "[dry-run] run confirmed SQL against selected targets" ;;
      backup_run)      echo "[dry-run] run compressed PostgreSQL backup" ;;
      backup_verify)   echo "[dry-run] verify backup checksum and archive structure" ;;
      backup_restore)  echo "[dry-run] restore verified PostgreSQL backup" ;;
      pitr_restore)    echo "[dry-run] restore PostgreSQL to selected recovery point" ;;
      proc_list)       echo "[dry-run] list database and TVCC processes" ;;
      agent_config_set) echo "[dry-run] update allowed TVCC agent configuration" ;;
      heal_action)     echo "[dry-run] inspect and restart failed TVCC service or tunnel" ;;
      site_snapshot)   echo "[dry-run] create site data and files snapshot" ;;
      site_rollback)   echo "[dry-run] restore selected site snapshot" ;;
      pooler_config)   echo "[dry-run] inspect/update PostgreSQL pooler" ;;
      nginx_read)      echo "[dry-run] read legacy routing configuration for migration" ;;
      nginx_write)     echo "[dry-run] write tested legacy routing configuration with rollback" ;;
      watch_start)     echo "[dry-run] inotifywait watcher on /var/www/$(GET domain)" ;;
      watch_stop)      echo "[dry-run] systemctl stop tvcc-watch-$(GET domain)" ;;
      git_deploy)      echo "[dry-run] git clone/pull $(GET repo) ($(GET branch)) -> $(GET path); build: $(GET build)" ;;
      failover_switch) echo "[dry-run] switch upstream of $(GET domain) -> $(GET target) then nginx -s reload" ;;
      deploy_upload)   echo "[dry-run] download $(GET url) -> $(GET path)/$(GET name); unzip; install/build; systemd $(GET service); ufw allow $(GET port)/tcp" ;;
      site_publish)    echo "[dry-run] pull $(GET source) -> $(GET path); build; systemctl restart $(GET service); ufw allow $(GET port)/tcp; health $(GET health_url)" ;;
      build_run)       echo "[dry-run] cd $(GET path)/$(GET name) && $(GET build)" ;;
      serve_start)     echo "[dry-run] systemctl restart $(GET service) && ufw allow $(GET port)/tcp" ;;
      serve_stop)      echo "[dry-run] systemctl disable --now $(GET service)" ;;
      fs_list)         echo "[dry-run] ls -la $(GET path)" ;;
      fs_tree)         echo "[dry-run] find $(GET path) -maxdepth $(GET depth)" ;;
      fs_read)         echo "[dry-run] head -n $(GET limit) $(GET path)" ;;
      fs_search)       echo "[dry-run] grep -rn $(GET query) $(GET path)" ;;
      fs_mkdir)        echo "[dry-run] mkdir -p $(GET path)" ;;
      fs_write)        echo "[dry-run] backup + write $(GET path)" ;;
      fs_delete)       echo "[dry-run] rm -rf $(GET path)" ;;
      fs_move)         echo "[dry-run] mv $(GET path) $(GET target)" ;;

      hosting_provision) echo "[dry-run] mkdir $(GET path); quota $(GET quota_gb)G for tenant $(GET tenant) ($(GET isolation))" ;;
      hosting_quota_set) echo "[dry-run] set quota $(GET quota_gb)G on $(GET path)" ;;
      hosting_usage_report) echo "[dry-run] du -sb $(GET path)" ;;
      file_replicate)  echo "[dry-run] rsync $(GET path) -> $(GET target_server)" ;;
      hn_dns_install)  echo "[dry-run] write /etc/dnsmasq.d/$(GET domain).conf then restart dnsmasq" ;;
      hn_domain_publish) echo "[dry-run] write nginx vhost for $(GET domain) -> port $(GET port); nginx -t && reload" ;;
      hn_domain_remove) echo "[dry-run] remove vhost + dns record of $(GET domain)" ;;
      nginx_write_vhost) echo "[dry-run] write /etc/nginx/sites-available/$(GET domain); nginx -t && reload" ;;
      ssl_issue_manual) echo "[dry-run] install cert files for $(GET domain) then reload nginx" ;;
      firewall_apply)  echo "[dry-run] ufw $(GET action) $(GET port)/$(GET protocol) from $(GET source)" ;;
      agent_update)    echo "[dry-run] curl installer from $(GET origin) | bash (agent self-update)" ;;
      tunnel_setup)    echo "[dry-run] reverse tunnel local:$(GET local_port) -> gateway $(GET gateway_host):$(GET gateway_port)" ;;
      tunnel_status)   echo "[dry-run] systemctl is-active tvcc-tunnel-$(GET name)" ;;
      tunnel_drop)     echo "[dry-run] systemctl disable --now tvcc-tunnel-$(GET name)" ;;
      gateway_publish) echo "[dry-run] on gateway: vhost $(GET domain) -> 127.0.0.1:$(GET gateway_port) + certbot" ;;
      storage_sync)    echo "[dry-run] rsync -az --delete $(GET source_path)/ $(GET storage_path)/" ;;
      storage_prune)   echo "[dry-run] rm -rf $(GET storage_path)" ;;
      vpn_setup)       echo "[dry-run] wg-quick up $(GET interface) address $(GET internal_ip)/24 port $(GET listen_port)" ;;
      vpn_peer_add)    echo "[dry-run] wg set $(GET interface) peer $(GET public_key) allowed-ips $(GET allowed_ips)" ;;
      vpn_peer_remove) echo "[dry-run] wg set $(GET interface) peer $(GET public_key) remove" ;;
      vpn_status)      echo "[dry-run] wg show $(GET interface)" ;;
      users_list)      echo "[dry-run] getent passwd" ;;
      service_action)  echo "[dry-run] systemctl $(GET op) $(GET name)" ;;
      pkg_list)        echo "[dry-run] dpkg-query -W" ;;
      pkg_updates)     echo "[dry-run] apt-get update && apt list --upgradable" ;;
      pkg_upgrade)     echo "[dry-run] apt-get update && apt-get upgrade -y" ;;
      shell_exec)      echo "[dry-run] $(GET cmd)" ;;
      cockpit_install) echo "[dry-run] apt-get install cockpit -y && systemctl enable --now cockpit.socket" ;;
      tool_action)     echo "[dry-run] tool $(GET slug) op=$(GET op)" ;;

      docker_*|nginx_vhost_*|nginx_cert_*|nginx_access_log|nginx_error_log|nginx_stats)
        echo "[dry-run] $ACTION args=$ARGS (no change applied)" ;;

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
    users_list)      getent passwd | awk -F: '$3 == 0 || $3 >= 1000 {print $1 "|uid=" $3 "|home=" $6 "|shell=" $7}' | head -300 ;;
    service_action)  N="$(GET name)"; OP="$(GET op)"; case "$OP" in start|stop|restart|enable|disable) systemctl "$OP" "$N" 2>&1 ;; *) echo "invalid service operation"; return 2 ;; esac; systemctl is-active "$N" 2>&1 || true ;;
    pkg_list)        dpkg-query -W -f='\${binary:Package}|\${Version}\\n' 2>/dev/null | head -1000 ;;
    pkg_updates)     apt-get update -qq && apt list --upgradable 2>/dev/null | head -500 ;;
    pkg_upgrade)     DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y 2>&1 | tail -300 ;;
    cockpit_install) DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install cockpit -y 2>&1 | tail -200; systemctl enable --now cockpit.socket 2>&1; ufw allow 9090/tcp >/dev/null 2>&1 || true; systemctl status cockpit.socket --no-pager 2>&1 | head -30 ;;
    tool_action)
      OP="$(GET op)"; SLUG="$(GET slug)"
      DET="$(GET detect_cmd)"; INS="$(GET install_cmd)"; STA="$(GET start_cmd)"; STO="$(GET stop_cmd)"; STS="$(GET status_cmd)"; UNI="$(GET uninstall_cmd)"
      TRUN() { [ -n "$1" ] || { echo "(no command defined)"; return 0; }; timeout 900 bash -lc "$1" 2>&1 | tail -c 20000; }
      INSTALLED=1
      if [ -n "$DET" ]; then bash -lc "$DET" >/dev/null 2>&1 && INSTALLED=0; fi
      case "$OP" in
        status)
          if [ "$INSTALLED" = "0" ]; then echo "installed=yes"; TRUN "$STS"; else echo "installed=no"; fi ;;
        install)
          if [ "$INSTALLED" = "0" ]; then echo "already installed=$SLUG"; else DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true; TRUN "$INS"; fi
          TRUN "$STA"; TRUN "$STS" ;;
        uninstall)
          TRUN "$UNI"; echo "removed=$SLUG" ;;
        start|stop|restart)
          if [ "$INSTALLED" != "0" ]; then echo "[auto-install] $SLUG"; DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true; TRUN "$INS"; fi
          case "$OP" in
            start) TRUN "$STA" ;;
            stop)  TRUN "$STO" ;;
            restart) TRUN "$STO"; TRUN "$STA" ;;
          esac
          TRUN "$STS" ;;
        *) echo "invalid tool op"; return 2 ;;
      esac ;;
    shell_exec)
      CMD="$(GET cmd)"; [ -n "$CMD" ] || { echo "command required"; return 2; }
      if echo "$CMD" | grep -Eiq '(^|[;&|])[[:space:]]*(rm[[:space:]]+-rf[[:space:]]+/(|\*)|mkfs([.]|[[:space:]])|shutdown|poweroff|reboot|passwd[[:space:]]+root|systemctl[[:space:]]+(stop|disable)[[:space:]]+tvcc-agent)'; then echo "blocked destructive command"; return 3; fi
      timeout 120 bash -lc "$CMD" 2>&1 | tail -c 20000 ;;
    nginx_test)      nginx -t 2>&1 ;;
    nginx_reload)    nginx -t && systemctl reload nginx && echo "nginx reloaded" ;;
    firewall_list)   ufw status numbered 2>&1 || iptables -L -n ;;
    firewall_allow)  ufw allow "$(GET port)" 2>&1 ;;
    firewall_deny)   ufw deny "$(GET port)" 2>&1 ;;
    disk_usage)      df -h; echo; du -sh /var/www/* 2>/dev/null | head -50 ;;
    write_config)    echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);open(d["path"],"w").write(d.get("content",""))' && echo "wrote $(GET path)" ;;
    site_backup)
      D="$(GET domain)"; DP="$(GET dest_path)"; TH="$(GET target_host)"
      OUT="\${DP:-$TVCC_BACKUP_DIR}"; mkdir -p "$OUT" 2>/dev/null
      F="$OUT/\${D}-$(date +%Y%m%d%H%M%S).tar.gz"
      tar czf "$F" "/var/www/$D" 2>/dev/null || true
      if [ ! -f "$F" ]; then echo "backup failed for $D"; exit 1; fi
      SZ=$(du -m "$F" | cut -f1)
      if [ -n "$TH" ]; then
        rsync -az -e "ssh -o StrictHostKeyChecking=no" "$F" "$TH:$OUT/" >/dev/null 2>&1 \\
          && echo "$F ($SZ MB) -> $TH:$OUT" || echo "$F ($SZ MB) transfer_failed=$TH"
      else
        echo "$F ($SZ MB)"
      fi ;;
    site_archive)
      D="$(GET domain)"; K="$(GET kind)"; RP="$(GET remote_path)"
      TH="$(GET target_host)"; TU="$(GET target_user)"; TPT="$(GET target_port)"; TPW="$(GET target_password)"
      if [ -z "$D" ] || [ -z "$RP" ]; then echo "missing domain/remote_path"; exit 1; fi
      WORK="$TVCC_BACKUP_DIR/archive-$D-$(date +%s)"; mkdir -p "$WORK"
      tar czf "$WORK/files.tar.gz" "/var/www/$D" 2>/dev/null || true
      DBN=$(echo "$D" | tr '.-' '__')
      mysqldump --single-transaction "$DBN" 2>/dev/null | gzip > "$WORK/database.sql.gz"
      if [ ! -s "$WORK/database.sql.gz" ]; then su - postgres -c "pg_dump '$DBN'" 2>/dev/null | gzip > "$WORK/database.sql.gz"; fi
      printf '{"domain":"%s","kind":"%s","created_at":"%s"}' "$D" "$K" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$WORK/manifest.json"
      SZ=$(du -sk "$WORK" | cut -f1)
      SSHOPT="-o StrictHostKeyChecking=no -p \${TPT:-22}"
      RUN=""
      if [ -n "$TPW" ] && command -v sshpass >/dev/null 2>&1; then RUN="sshpass -p $TPW"; fi
      if [ -n "$TH" ]; then
        REMOTE="\${TU:-root}@$TH"
        $RUN ssh $SSHOPT "$REMOTE" "mkdir -p '$RP.tmp' '$RP'" >/dev/null 2>&1
        if $RUN rsync -az --delete -e "ssh $SSHOPT" "$WORK/" "$REMOTE:$RP.tmp/" >/dev/null 2>&1; then
          if [ "$K" = "first" ]; then
            $RUN ssh $SSHOPT "$REMOTE" "if [ -f '$RP/manifest.json' ]; then rm -rf '$RP.tmp'; else rm -rf '$RP'; mv '$RP.tmp' '$RP'; fi" >/dev/null 2>&1
          else
            $RUN ssh $SSHOPT "$REMOTE" "rm -rf '$RP.old'; mv '$RP' '$RP.old' 2>/dev/null; mv '$RP.tmp' '$RP'; rm -rf '$RP.old'" >/dev/null 2>&1
          fi
          rm -rf "$WORK"
          echo "archived $D ($K) size_kb=$SZ -> $TH:$RP"
        else
          rm -rf "$WORK"; echo "transfer failed to $TH:$RP"; exit 1
        fi
      else
        echo "archived locally $WORK size_kb=$SZ"
      fi ;;
    site_restore)    tar xzf "$(GET storage_path)" -C / && echo "restored $(GET storage_path)" ;;
    db_dump)
      D="$(GET domain)"; DP="$(GET dest_path)"; TH="$(GET target_host)"
      OUT="\${DP:-$TVCC_BACKUP_DIR}"; mkdir -p "$OUT" 2>/dev/null
      F="$OUT/\${D}-$(date +%Y%m%d%H%M%S).sql.gz"
      mysqldump --single-transaction "\${D//./_}" 2>/dev/null | gzip > "$F"
      if [ ! -s "$F" ]; then su - postgres -c "pg_dump '\${D//./_}'" 2>/dev/null | gzip > "$F"; fi
      if [ ! -s "$F" ]; then echo "db dump failed for $D"; exit 1; fi
      SZ=$(du -m "$F" | cut -f1)
      if [ -n "$TH" ]; then
        rsync -az -e "ssh -o StrictHostKeyChecking=no" "$F" "$TH:$OUT/" >/dev/null 2>&1 \\
          && echo "$F ($SZ MB) -> $TH:$OUT" || echo "$F ($SZ MB) transfer_failed=$TH"
      else
        echo "$F ($SZ MB)"
      fi ;;
    db_sync)
      SRC=$(echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin).get("source",{}) or {};print("|".join([str(d.get(k) or "") for k in ("engine","host","port","db","user","password")]))')
      DST=$(echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin).get("target",{}) or {};print("|".join([str(d.get(k) or "") for k in ("engine","host","port","db","user","password")]))')
      IFS='|' read -r SE SH SP SD SU SPW <<< "$SRC"
      IFS='|' read -r TE TH2 TP TD TU TPW <<< "$DST"
      if [ -z "$SD" ] || [ -z "$TD" ]; then echo "missing source/target database"; exit 1; fi
      TMP="$TVCC_BACKUP_DIR/sync-$(date +%s).sql"
      mkdir -p "$TVCC_BACKUP_DIR" 2>/dev/null
      if [ "$SE" = "mysql" ]; then
        MYSQL_PWD="$SPW" mysqldump --single-transaction -h "\${SH:-127.0.0.1}" -P "\${SP:-3306}" -u "\${SU:-root}" "$SD" > "$TMP" 2>/dev/null
      else
        PGPASSWORD="$SPW" pg_dump -h "\${SH:-127.0.0.1}" -p "\${SP:-5432}" -U "\${SU:-postgres}" "$SD" > "$TMP" 2>/dev/null
      fi
      if [ ! -s "$TMP" ]; then echo "dump of $SD failed"; rm -f "$TMP"; exit 1; fi
      if [ "\${TE:-$SE}" = "mysql" ]; then
        MYSQL_PWD="$TPW" mysql -h "\${TH2:-127.0.0.1}" -P "\${TP:-3306}" -u "\${TU:-root}" "$TD" < "$TMP" 2>&1
      else
        PGPASSWORD="$TPW" psql -h "\${TH2:-127.0.0.1}" -p "\${TP:-5432}" -U "\${TU:-postgres}" -d "$TD" -f "$TMP" >/dev/null 2>&1
      fi
      R=$?; SZ=$(du -m "$TMP" | cut -f1); rm -f "$TMP"
      if [ "$R" -eq 0 ]; then echo "synced $SD -> $TD ($SZ MB)"; else echo "sync into $TD failed"; exit 1; fi ;;
    db_import)
      SP_FILE="$(GET storage_path)"; DBN="$(GET database)"; ENG="$(GET engine)"
      [ -s "$SP_FILE" ] || { echo "backup file not found: $SP_FILE"; exit 1; }
      case "$SP_FILE" in *.gz) CAT="gunzip -c" ;; *) CAT="cat" ;; esac
      if [ "$ENG" = "postgres" ] || [ "$ENG" = "postgresql" ] || ! command -v mysql >/dev/null 2>&1; then
        su - postgres -c "psql -d '$DBN'" < <($CAT "$SP_FILE") 2>&1 | tail -20 && echo "imported (postgres) $DBN"
      else
        $CAT "$SP_FILE" | mysql "$DBN" && echo "imported (mysql) $DBN"
      fi ;;
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
    site_start)      systemctl start "$(GET name)" 2>&1 && systemctl is-active "$(GET name)" ;;
    site_stop)       systemctl stop "$(GET name)" 2>&1; echo "stopped $(GET name)" ;;
    site_restart)    systemctl restart "$(GET name)" 2>&1 && systemctl is-active "$(GET name)" ;;
    site_logs)       journalctl -u "$(GET name)" -n 200 --no-pager 2>&1 ;;
    unit_write)
      echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);open(d["path"],"w").write(d.get("content",""))'
      systemctl daemon-reload && systemctl enable "$(GET name).service" >/dev/null 2>&1
      echo "unit $(GET name) written and enabled" ;;
    db_create)
      E="$(GET engine)"; D="$(GET database)"
      if [ "$E" = "mysql" ]; then
        mysql -e "CREATE DATABASE IF NOT EXISTS \\\`$D\\\`;" 2>&1 && echo "mysql database $D ready"
      else
        su - postgres -c "psql -tc \\"SELECT 1 FROM pg_database WHERE datname='$D'\\" | grep -q 1 || createdb '$D'" 2>&1 && echo "postgres database $D ready"
      fi ;;
    db_user_grant)
      E="$(GET engine)"; D="$(GET database)"; U="$(GET user)"; P="$(GET password)"
      if [ "$E" = "mysql" ]; then
        mysql -e "CREATE USER IF NOT EXISTS '$U'@'%' IDENTIFIED BY '$P'; GRANT ALL ON \\\`$D\\\`.* TO '$U'@'%'; FLUSH PRIVILEGES;" 2>&1 && echo "mysql user $U granted on $D"
      else
        su - postgres -c "psql -c \\"DO \\\\\\$\\\\\\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$U') THEN CREATE ROLE \\\\\\"$U\\\\\\" LOGIN PASSWORD '$P'; END IF; END \\\\\\$\\\\\\$;\\" && psql -c \\"GRANT ALL PRIVILEGES ON DATABASE \\\\\\"$D\\\\\\" TO \\\\\\"$U\\\\\\";\\"" 2>&1 && echo "postgres user $U granted on $D"
      fi ;;
    db_ping)
      E="$(GET engine)"; H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"
      S=$(date +%s%3N)
      if [ "$E" = "mysql" ]; then
        MYSQL_PWD="$PW" mysql -h "\${H:-127.0.0.1}" -P "\${P:-3306}" -u "$U" -e "SELECT 1" "$D" >/dev/null 2>&1
      else
        PGPASSWORD="$PW" psql -h "\${H:-127.0.0.1}" -p "\${P:-5432}" -U "$U" -d "$D" -c "SELECT 1" >/dev/null 2>&1
      fi
      R=$?; E2=$(date +%s%3N)
      if [ "$R" -eq 0 ]; then echo "db ok latency_ms=$((E2-S))"; else echo "db unreachable \${H}:\${P}/\${D}"; exit 1; fi ;;
    db_discover)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"
      H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      PGPASSWORD="$PW" psql -h "$H" -p "$P" -U "$U" -d "$D" -At -F '|' -c "SELECT current_database(),current_setting('server_version'),pg_database_size(current_database()),(SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')),(SELECT count(*) FROM pg_stat_activity);" 2>&1
      echo "services=$(for p in 8000 3000 4000 5000 5432 6543; do nc -z -w1 127.0.0.1 $p >/dev/null 2>&1 && printf '%s,' $p; done)" ;;
    pg_meta)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      PGPASSWORD="$PW" psql -h "$H" -p "$P" -U "$U" -d "$D" -At -F $'\t' -c "SELECT table_schema,table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema,table_name,ordinal_position LIMIT 5000;" 2>&1 ;;
    pg_rows)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; S="$(GET schema)"; T="$(GET table)"; L="$(GET limit)"
      H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"; S="\${S:-public}"; L="\${L:-100}"
      [[ "$S" =~ ^[A-Za-z_][A-Za-z0-9_]*$ && "$T" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "invalid table identifier"; return 2; }
      PGPASSWORD="$PW" psql -h "$H" -p "$P" -U "$U" -d "$D" -c "SELECT * FROM \\\"$S\\\".\\\"$T\\\" LIMIT $L;" 2>&1 ;;
    db_query|multi_sql)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; RO="$(GET read_only)"; SQL="$(GET sql)"
      H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      [ -n "$SQL" ] || { echo "sql required"; return 2; }
      if [ "$RO" = "true" ] && echo "$SQL" | grep -Eiq '\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|copy|vacuum|reindex)\b'; then echo "write statement blocked in read-only mode"; return 3; fi
      if [ "$RO" = "true" ]; then SQL="BEGIN READ ONLY; SET LOCAL statement_timeout='30s'; $SQL; ROLLBACK;"; fi
      PGPASSWORD="$PW" psql -X -v ON_ERROR_STOP=1 -h "$H" -p "$P" -U "$U" -d "$D" -c "$SQL" 2>&1 | head -2000 ;;
    db_policy)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; SQL="$(GET sql)"; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      [ -n "$SQL" ] || SQL="SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies ORDER BY schemaname,tablename,policyname;"
      PGPASSWORD="$PW" psql -X -v ON_ERROR_STOP=1 -h "$H" -p "$P" -U "$U" -d "$D" -c "$SQL" 2>&1 | head -2000 ;;
    auth_users)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      PGPASSWORD="$PW" psql -X -h "$H" -p "$P" -U "$U" -d "$D" -c "SELECT id,email,created_at,last_sign_in_at FROM auth.users ORDER BY created_at DESC LIMIT 200;" 2>&1 ;;
    storage_list)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      PGPASSWORD="$PW" psql -X -h "$H" -p "$P" -U "$U" -d "$D" -c "SELECT b.id,b.name,b.public,count(o.id) objects FROM storage.buckets b LEFT JOIN storage.objects o ON o.bucket_id=b.id GROUP BY b.id,b.name,b.public ORDER BY b.name;" 2>&1 ;;
    edge_functions_list)
      if [ -d /opt/supabase/functions ]; then find /opt/supabase/functions -mindepth 1 -maxdepth 2 -type f -printf '%p|%s bytes\n' | head -300; else systemctl list-units 'tvcc-*function*' --no-pager; fi ;;
    realtime_inspect)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      PGPASSWORD="$PW" psql -X -h "$H" -p "$P" -U "$U" -d "$D" -c "SELECT pubname,schemaname,tablename FROM pg_publication_tables ORDER BY pubname,schemaname,tablename; SELECT slot_name,active,restart_lsn FROM pg_replication_slots;" 2>&1 ;;
    advisor_scan)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      PGPASSWORD="$PW" psql -X -h "$H" -p "$P" -U "$U" -d "$D" -c "SELECT 'tables_without_primary_key' finding,count(*) total FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisprimary) UNION ALL SELECT 'invalid_indexes',count(*) FROM pg_index WHERE NOT indisvalid;" 2>&1 ;;
    site_identity_provision)
      C="$(GET site_code)"; S="$(GET schema_name)"; PATH_="$(GET server_path)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="$(GET host)"; P="$(GET port)"
      [[ "$C" =~ ^[A-Za-z0-9_-]+$ && "$S" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "invalid site identity"; return 2; }
      case "$PATH_" in /srv/tvcc/sites/*) ;; *) echo "invalid server path"; return 2 ;; esac
      mkdir -p "$PATH_"/{app,public,uploads,backups,logs,config} && chmod 750 "$PATH_"
      H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"
      PGPASSWORD="$PW" psql -X -v ON_ERROR_STOP=1 -h "$H" -p "$P" -U "$U" -d "$D" -c "CREATE SCHEMA IF NOT EXISTS \\\"$S\\\"; CREATE TABLE IF NOT EXISTS \\\"$S\\\".site_registry(site_code text PRIMARY KEY, server_path text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); INSERT INTO \\\"$S\\\".site_registry(site_code,server_path) VALUES ('$C','$PATH_') ON CONFLICT(site_code) DO UPDATE SET server_path=excluded.server_path;" 2>&1 && echo "site_identity=$C schema=$S path=$PATH_ ready" ;;
    db_export|backup_run)
      H="$(GET host)"; P="$(GET port)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"; mkdir -p "$TVCC_BACKUP_DIR/databases"
      F="$TVCC_BACKUP_DIR/databases/$D-$(date +%Y%m%d%H%M%S).dump"; PGPASSWORD="$PW" pg_dump -Fc -h "$H" -p "$P" -U "$U" -d "$D" -f "$F" && sha256sum "$F" | tee "$F.sha256" && echo "backup=$F size_bytes=$(stat -c%s "$F")" ;;
    backup_verify)
      F="$(GET path)"; [ -f "$F" ] || F=$(ls -1t "$TVCC_BACKUP_DIR/databases"/*.dump 2>/dev/null | head -1); [ -f "$F" ] || { echo "backup not found"; return 2; }
      sha256sum -c "$F.sha256" && pg_restore -l "$F" >/dev/null && echo "verified=$F" ;;
    db_import_full|backup_restore|pitr_restore)
      F="$(GET path)"; D="$(GET database)"; U="$(GET user)"; PW="$(GET password)"; H="$(GET host)"; P="$(GET port)"; [ -f "$F" ] || { echo "verified backup path required"; return 2; }
      sha256sum -c "$F.sha256" || { echo "checksum failed"; return 3; }; H="\${H:-127.0.0.1}"; P="\${P:-5432}"; D="\${D:-postgres}"; U="\${U:-postgres}"; PGPASSWORD="$PW" pg_restore --clean --if-exists -h "$H" -p "$P" -U "$U" -d "$D" "$F" 2>&1 | tail -200 ;;
    db_provision)
      D="$(GET database)"; S="$(GET schema_name)"; [ -n "$D" ] || { echo "database required"; return 2; }; su - postgres -c "psql -tc \\\"SELECT 1 FROM pg_database WHERE datname='$D'\\\" | grep -q 1 || createdb '$D'"; if [ -n "$S" ]; then su - postgres -c "psql '$D' -c 'CREATE SCHEMA IF NOT EXISTS \\\"$S\\\";'"; fi; echo "provisioned $D $S" ;;
    db_migrate)
      echo "migration queued through exported snapshot; use db_export then db_import_full for verified cutover" ;;
    pooler_config)
      systemctl status pgbouncer --no-pager 2>&1 | head -60 || systemctl status supavisor --no-pager 2>&1 | head -60 || echo "pooler not detected" ;;
    proc_list)
      ps -eo pid,ppid,user,%cpu,%mem,etimes,cmd --sort=-%cpu | grep -E 'postgres|supabase|realtime|storage|gotrue|postgrest|tvcc' | head -120 ;;
    agent_config_set)
      mkdir -p "$TVCC_STATE_DIR"; echo "$ARGS" > "$TVCC_STATE_DIR/db-agent-config.json"; chmod 600 "$TVCC_STATE_DIR/db-agent-config.json"; echo "agent configuration updated" ;;
    heal_action)
      N="$(GET name)"; [ -n "$N" ] || { echo "service name required"; return 2; }; systemctl reset-failed "$N"; systemctl restart "$N"; systemctl is-active "$N" ;;
    site_snapshot)
      C="$(GET site_code)"; PATH_="$(GET server_path)"; [ -d "$PATH_" ] || { echo "site path missing"; return 2; }; mkdir -p "$TVCC_BACKUP_DIR/sites/$C"; F="$TVCC_BACKUP_DIR/sites/$C/$C-$(date +%Y%m%d%H%M%S).tar.gz"; tar czf "$F" -C "$PATH_" . && sha256sum "$F" > "$F.sha256" && echo "snapshot=$F" ;;
    site_rollback)
      F="$(GET path)"; PATH_="$(GET server_path)"; sha256sum -c "$F.sha256" && mkdir -p "$PATH_" && tar xzf "$F" -C "$PATH_" && echo "rollback complete" ;;
    nginx_read)
      nginx -T 2>&1 | head -1000 || echo "legacy nginx is not installed" ;;
    nginx_write)
      echo "legacy nginx writes are retained only for migration rollback; use TVCC gateway for new public routing" ;;
    watch_start)
      D="$(GET domain)"
      command -v inotifywait >/dev/null || (apt-get update -y >/dev/null 2>&1 && apt-get install -y inotify-tools >/dev/null 2>&1)
      cat > "/usr/local/bin/tvcc-watch-$D.sh" <<EOF3
#!/usr/bin/env bash
while inotifywait -r -q -e modify,create,delete,move "/var/www/$D" >/dev/null 2>&1; do
  echo "\\$(date -Is) changed /var/www/$D" >> "/var/log/tvcc-watch-$D.log"
  if [ -f "/var/www/$D/.tvcc/peers" ]; then
    while read -r PEER; do
      [ -n "\\$PEER" ] && rsync -az --delete -e "ssh -o StrictHostKeyChecking=no" "/var/www/$D/" "\\$PEER:/var/www/$D/" >/dev/null 2>&1
    done < "/var/www/$D/.tvcc/peers"
  fi
  sleep 2
done
EOF3
      chmod +x "/usr/local/bin/tvcc-watch-$D.sh"
      cat > "/etc/systemd/system/tvcc-watch-$D.service" <<EOF4
[Unit]
Description=TVCC live sync watcher for $D
After=network.target

[Service]
ExecStart=/usr/local/bin/tvcc-watch-$D.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF4
      systemctl daemon-reload && systemctl enable --now "tvcc-watch-$D.service" && echo "live sync watching /var/www/$D" ;;
    watch_stop)      D="$(GET domain)"; systemctl disable --now "tvcc-watch-$D.service" 2>/dev/null; echo "watcher stopped for $D" ;;
    git_deploy)
      REPO="$(GET repo)"; BR="$(GET branch)"; DIR="$(GET path)"; BUILD="$(GET build)"
      [ -z "$BR" ] && BR="main"
      [ -z "$DIR" ] && { echo "missing path"; return 2; }
      if [ -d "$DIR/.git" ]; then
        git -C "$DIR" fetch --all -q && git -C "$DIR" reset --hard "origin/$BR" 2>&1
      else
        mkdir -p "$DIR" && git clone -q -b "$BR" "$REPO" "$DIR" 2>&1
      fi || { echo "git failed"; return 3; }
      if [ -n "$BUILD" ]; then ( cd "$DIR" && sh -c "$BUILD" 2>&1 | tail -n 60 ); fi
      echo "deployed $(git -C "$DIR" rev-parse --short HEAD 2>/dev/null) to $DIR" ;;
    site_publish)
      SRC="$(GET source)"; DIR="$(GET path)"; SVC="$(GET service)"; PRT="$(GET port)"; HU="$(GET health_url)"
      BUILD="$(GET build)"; BR="$(GET branch)"
      [ -z "$DIR" ] && DIR="/opt/tvcc"
      [ -z "$SVC" ] && SVC="tvcc"
      [ -z "$BR" ] && BR="main"
      mkdir -p "$DIR"
      if [ -n "$SRC" ]; then
        case "$SRC" in
          *.zip)
            curl -fsSL -o /tmp/tvcc-publish.zip "$SRC" || { echo "download failed"; return 3; }
            command -v unzip >/dev/null || (apt-get update -y >/dev/null 2>&1 && apt-get install -y unzip >/dev/null 2>&1)
            unzip -oq /tmp/tvcc-publish.zip -d "$DIR" && rm -f /tmp/tvcc-publish.zip ;;
          *)
            if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch --all -q && git -C "$DIR" reset --hard "origin/$BR" >/dev/null 2>&1
            else git clone -q -b "$BR" "$SRC" "$DIR" >/dev/null 2>&1; fi || { echo "git failed"; return 3; } ;;
        esac
      fi
      if [ -n "$BUILD" ]; then ( cd "$DIR" && sh -c "$BUILD" 2>&1 | tail -n 40 )
      elif [ -f "$DIR/package.json" ]; then ( cd "$DIR" && (bun install >/dev/null 2>&1 || npm install --legacy-peer-deps >/dev/null 2>&1) && (bun run build 2>&1 | tail -n 20 || npm run build 2>&1 | tail -n 20) ); fi
      systemctl restart "$SVC" >/dev/null 2>&1 || systemctl start "$SVC" >/dev/null 2>&1
      [ -n "$PRT" ] && ufw allow "$PRT/tcp" >/dev/null 2>&1
      sleep 3
      ST=$(systemctl is-active "$SVC" 2>/dev/null)
      HC=""
      [ -n "$HU" ] && HC=$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$HU" 2>/dev/null)
      [ -z "$PRT" ] && PRT="n/a"
      [ -z "$HC" ] && HC="skipped"
      echo "published $DIR | service=$SVC state=$ST port=$PRT health=$HC"
      [ "$ST" = "active" ] || return 4 ;;
    failover_switch)
      D="$(GET domain)"; T="$(GET target)"
      [ -z "$D" ] || [ -z "$T" ] && { echo "missing domain/target"; return 2; }
      CONF="/etc/nginx/conf.d/tvcc-failover-$D.conf"
      cat > "$CONF" <<EOF5
server {
  listen 80;
  server_name $D;
  location / { proxy_pass http://$T; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; }
}
EOF5
      nginx -t 2>&1 && nginx -s reload 2>&1 && echo "failover: $D -> $T" ;;
    deploy_upload)
      U="$(GET url)"; N="$(GET name)"; BP="$(GET path)"; PT="$(GET port)"
      IN="$(GET install)"; BD="$(GET build)"; ST="$(GET start)"; OD="$(GET output_dir)"; SV="$(GET service)"
      [ -z "$U" ] || [ -z "$N" ] && { echo "missing url/name"; return 2; }
      tvcc_deploy "$U" "$N" "$BP" "$PT" "$IN" "$BD" "$ST" "$OD" "$SV" ;;
    build_run)
      N="$(GET name)"; BP="$(GET path)"; BD="$(GET build)"
      [ -z "$BP" ] && BP="$TVCC_HN_DIR"
      cd "$BP/$N" || { echo "missing dir $BP/$N"; return 2; }
      bash -lc "\${BD:-npm run build}" 2>&1 | tail -n 80 ;;
    serve_start)
      SV="$(GET service)"; PT="$(GET port)"
      systemctl restart "$SV" 2>&1 | tail -3
      [ -n "$PT" ] && ufw allow "$PT/tcp" >/dev/null 2>&1 || true
      systemctl is-active "$SV" 2>&1 ;;
    serve_stop)
      SV="$(GET service)"
      systemctl disable --now "$SV" 2>&1 | tail -3; echo "stopped $SV" ;;

    fs_list)
      P="$(GET path)"; [ -z "$P" ] && P="$TVCC_HN_DIR"
      ls -la --time-style=long-iso "$P" 2>&1 | head -300 ;;
    fs_tree)
      P="$(GET path)"; D="$(GET depth)"; [ -z "$P" ] && P="$TVCC_HN_DIR"
      find "$P" -maxdepth "\${D:-3}" -not -path '*/node_modules/*' -not -path '*/.git/*' 2>&1 | head -400 ;;
    fs_read)
      P="$(GET path)"; L="$(GET limit)"
      [ -f "$P" ] || { echo "not a file: $P"; return 2; }
      sed -n "1,\${L:-500}p" "$P" 2>&1 ;;
    fs_search)
      P="$(GET path)"; Q="$(GET query)"; [ -z "$P" ] && P="$TVCC_HN_DIR"
      grep -rn --binary-files=without-match --exclude-dir=node_modules --exclude-dir=.git -- "$Q" "$P" 2>/dev/null | head -100 || echo "no matches" ;;
    fs_mkdir)
      P="$(GET path)"; mkdir -p "$P" && echo "created $P" ;;
    fs_write)
      echo "$ARGS" | python3 -c 'import sys,json,os,shutil;d=json.load(sys.stdin);p=d["path"];os.makedirs(os.path.dirname(p) or ".",exist_ok=True);shutil.copyfile(p,p+".tvcc.bak") if os.path.isfile(p) else None;open(p,"w").write(d.get("content",""));print("wrote %s (%d bytes)"%(p,len(d.get("content",""))))' 2>&1 ;;
    fs_delete)
      P="$(GET path)"
      case "$P" in /home/*|/var/www/*|/opt/tvcc/*) rm -rf "$P" && echo "deleted $P" ;; *) echo "refused: path outside allowed roots"; return 2 ;; esac ;;
    fs_move)
      S="$(GET path)"; T="$(GET target)"; mkdir -p "$(dirname "$T")"; mv "$S" "$T" && echo "moved $S -> $T" ;;

    hosting_provision)
      P="$(GET path)"; Q="$(GET quota_gb)"; T="$(GET tenant)"
      mkdir -p "$P" && chmod 750 "$P"
      echo "$P $Q" > "/opt/tvcc/quotas/\${T}.quota" 2>/dev/null || { mkdir -p /opt/tvcc/quotas; echo "$P $Q" > "/opt/tvcc/quotas/\${T}.quota"; }
      echo "provisioned $P for tenant $T with \${Q}G quota" ;;
    hosting_quota_set)
      P="$(GET path)"; Q="$(GET quota_gb)"; mkdir -p /opt/tvcc/quotas
      echo "$P $Q" > "/opt/tvcc/quotas/$(echo "$P" | tr '/' '_').quota"
      echo "quota for $P set to \${Q}G" ;;
    hosting_usage_report)
      P="$(GET path)"; du -sb "$P" 2>/dev/null | cut -f1 ;;
    file_replicate)
      S="$(GET path)"; T="$(GET target_server)"
      [ -e "$S" ] || { echo "missing source: $S"; return 2; }
      mkdir -p "$TVCC_BACKUP_DIR/replicas"
      cp -a "$S" "$TVCC_BACKUP_DIR/replicas/" 2>&1 && echo "replicated $S (target $T)" ;;
    hn_dns_install)
      D="$(GET domain)"; mkdir -p /etc/dnsmasq.d
      command -v dnsmasq >/dev/null 2>&1 || (apt-get install -y dnsmasq >/dev/null 2>&1 || true)
      echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);open("/etc/dnsmasq.d/%s.conf"%d["domain"],"w").write(d.get("zone",""))'
      systemctl restart dnsmasq 2>&1 | head -5; echo "dns zone installed for $D" ;;
    hn_domain_publish)
      D="$(GET domain)"; mkdir -p /var/www/"$D"
      echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);open("/etc/nginx/sites-available/%s"%d["domain"],"w").write(d.get("vhost",""))'
      ln -sf "/etc/nginx/sites-available/$D" "/etc/nginx/sites-enabled/$D"
      nginx -t 2>&1 && systemctl reload nginx && echo "published $D" ;;
    hn_domain_remove)
      D="$(GET domain)"
      rm -f "/etc/nginx/sites-enabled/$D" "/etc/nginx/sites-available/$D" "/etc/dnsmasq.d/$D.conf"
      nginx -t >/dev/null 2>&1 && systemctl reload nginx; systemctl restart dnsmasq 2>/dev/null
      echo "removed $D" ;;
    port_bind_domain)
      D="$(GET domain)"; P="$(GET port)"; SSL="$(GET ssl)"
      [ -z "$D" ] || [ -z "$P" ] && { echo "domain and port required"; return 2; }
      cat > "/etc/nginx/sites-available/$D" <<EOFV
server {
  listen 80;
  server_name $D;
  location / {
    proxy_pass http://127.0.0.1:$P;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \\$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \\$host;
    proxy_set_header X-Real-IP \\$remote_addr;
    proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\$scheme;
  }
}
EOFV
      ln -sf "/etc/nginx/sites-available/$D" "/etc/nginx/sites-enabled/$D"
      nginx -t 2>&1 && systemctl reload nginx && echo "bound $D -> 127.0.0.1:$P"
      if [ "$SSL" = "true" ]; then
        command -v certbot >/dev/null 2>&1 || (apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true)
        certbot --nginx -d "$D" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tail -5 || true
      fi
      echo "$D $P" >> "$TVCC_STATE_DIR/bindings" ;;
    port_unbind_domain)
      D="$(GET domain)"
      rm -f "/etc/nginx/sites-enabled/$D" "/etc/nginx/sites-available/$D"
      grep -v "^$D " "$TVCC_STATE_DIR/bindings" 2>/dev/null > "$TVCC_STATE_DIR/bindings.tmp" || true
      mv "$TVCC_STATE_DIR/bindings.tmp" "$TVCC_STATE_DIR/bindings" 2>/dev/null || true
      nginx -t >/dev/null 2>&1 && systemctl reload nginx; echo "unbound $D" ;;
    supabase_bind)
      P="$(GET port)"; DIR="$(GET project_dir)"; DIR="\${DIR:-/opt/supabase}"
      command -v supabase >/dev/null 2>&1 || (npm i -g supabase >/dev/null 2>&1 || true)
      (cd "$DIR" 2>/dev/null && supabase status 2>&1 | head -30) || echo "supabase project dir not found: $DIR"
      curl -s -o /dev/null -w "gateway :%{http_code}\\n" --max-time 5 "http://127.0.0.1:\${P:-8000}/rest/v1/" || true ;;
    nginx_write_vhost)
      D="$(GET domain)"
      [ -z "$D" ] && { echo "domain required"; return 2; }
      echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);open("/etc/nginx/sites-available/%s"%d["domain"],"w").write(d.get("vhost",""))'
      ln -sf "/etc/nginx/sites-available/$D" "/etc/nginx/sites-enabled/$D"
      nginx -t 2>&1 && systemctl reload nginx && echo "nginx vhost applied for $D" ;;
    ssl_issue_manual)
      D="$(GET domain)"; MODE="$(GET mode)"
      mkdir -p "/etc/tvcc/ssl/$D"
      if [ "$MODE" = "letsencrypt" ]; then
        command -v certbot >/dev/null 2>&1 || (apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true)
        certbot --nginx -d "$D" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tail -8
      else
        echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);p="/etc/tvcc/ssl/"+d["domain"];open(p+"/fullchain.pem","w").write(d.get("cert_pem",""));open(p+"/privkey.pem","w").write(d.get("key_pem",""))'
        chmod 600 "/etc/tvcc/ssl/$D/privkey.pem"
        nginx -t 2>&1 && systemctl reload nginx
      fi
      echo "ssl ready for $D ($(openssl x509 -enddate -noout -in "/etc/tvcc/ssl/$D/fullchain.pem" 2>/dev/null || echo managed))" ;;
    firewall_apply)
      A="$(GET action)"; P="$(GET port)"; PR="$(GET protocol)"; SRC="$(GET source)"
      PR="\${PR:-tcp}"
      command -v ufw >/dev/null 2>&1 || (apt-get install -y ufw >/dev/null 2>&1 || true)
      if [ "$A" = "deny" ]; then RULE="deny"; elif [ "$A" = "delete" ]; then RULE="delete"; else RULE="allow"; fi
      if [ "$RULE" = "delete" ]; then
        ufw delete allow "\${P}/\${PR}" >/dev/null 2>&1 || true
        ufw delete deny "\${P}/\${PR}" >/dev/null 2>&1 || true
        echo "firewall rule removed for \${P}/\${PR}"
      elif [ -n "$SRC" ] && [ "$SRC" != "any" ]; then
        ufw "$RULE" from "$SRC" to any port "$P" proto "$PR" 2>&1 | tail -3
      else
        ufw "$RULE" "\${P}/\${PR}" 2>&1 | tail -3
      fi
      ufw --force enable >/dev/null 2>&1 || true
      ufw status numbered 2>&1 | head -30 ;;
    agent_update)
      O="$(GET origin)"
      [ -z "$O" ] && O=$(echo "$TVCC_ENDPOINT" | sed -E 's#(https?://[^/]+).*#\\1#')
      curl -fsSL "\${O}/api/public/servers/agent?id=\${TVCC_SERVER_ID}&token=\${TVCC_TOKEN}" -o /tmp/tvcc-agent-new.sh 2>/dev/null || { echo "download failed"; return 3; }
      head -3 /tmp/tvcc-agent-new.sh | grep -q '#!/usr/bin/env bash' || { echo "invalid installer"; return 4; }
      install -m 0755 /tmp/tvcc-agent-new.sh /usr/local/bin/tvcc-agent.sh
      (systemctl restart tvcc-agent.service >/dev/null 2>&1 &) 
      echo "agent updated, restarting" ;;
    tunnel_setup)
      N="$(GET name)"; LP="$(GET local_port)"; GH="$(GET gateway_host)"; GU="$(GET gateway_user)"; GP="$(GET gateway_port)"
      [ -z "$N" ] || [ -z "$LP" ] || [ -z "$GH" ] && { echo "name, local_port and gateway_host required"; return 2; }
      GU="\${GU:-tvcc}"; GP="\${GP:-\${LP}}"
      command -v autossh >/dev/null 2>&1 || (apt-get update -y >/dev/null 2>&1 && apt-get install -y autossh >/dev/null 2>&1 || true)
      [ -f /root/.ssh/id_ed25519 ] || ssh-keygen -q -t ed25519 -N "" -f /root/.ssh/id_ed25519
      cat > "/etc/systemd/system/tvcc-tunnel-\${N}.service" <<EOFT
[Unit]
Description=TVCC reverse tunnel \${N} (local \${LP} -> \${GH}:\${GP})
After=network-online.target

[Service]
Type=simple
Environment="AUTOSSH_GATETIME=0"
ExecStart=/usr/bin/autossh -M 0 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=no -R 127.0.0.1:\${GP}:127.0.0.1:\${LP} \${GU}@\${GH}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOFT
      systemctl daemon-reload && systemctl enable --now "tvcc-tunnel-\${N}.service" >/dev/null 2>&1
      sleep 2
      echo "tunnel \${N}: $(systemctl is-active "tvcc-tunnel-\${N}.service") | pubkey: $(cat /root/.ssh/id_ed25519.pub 2>/dev/null)" ;;
    tunnel_status)
      N="$(GET name)"
      echo "state=$(systemctl is-active "tvcc-tunnel-\${N}.service" 2>/dev/null)"
      journalctl -u "tvcc-tunnel-\${N}.service" -n 20 --no-pager 2>/dev/null | tail -20 ;;
    tunnel_drop)
      N="$(GET name)"
      systemctl disable --now "tvcc-tunnel-\${N}.service" >/dev/null 2>&1 || true
      rm -f "/etc/systemd/system/tvcc-tunnel-\${N}.service"; systemctl daemon-reload
      echo "tunnel \${N} removed" ;;
    gateway_publish)
      D="$(GET domain)"; GP="$(GET gateway_port)"; SSL="$(GET ssl)"; PUB="$(GET pubkey)"
      [ -z "$D" ] || [ -z "$GP" ] && { echo "domain and gateway_port required"; return 2; }
      if [ -n "$PUB" ]; then
        id -u tvcc >/dev/null 2>&1 || useradd -m -s /bin/bash tvcc
        mkdir -p /home/tvcc/.ssh && touch /home/tvcc/.ssh/authorized_keys
        grep -qF "$PUB" /home/tvcc/.ssh/authorized_keys || echo "$PUB" >> /home/tvcc/.ssh/authorized_keys
        chown -R tvcc:tvcc /home/tvcc/.ssh; chmod 700 /home/tvcc/.ssh; chmod 600 /home/tvcc/.ssh/authorized_keys
      fi
      cat > "/etc/nginx/sites-available/$D" <<EOFG
server {
  listen 80;
  server_name $D;
  location / {
    proxy_pass http://127.0.0.1:$GP;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \\$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \\$host;
    proxy_set_header X-Real-IP \\$remote_addr;
    proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\$scheme;
  }
}
EOFG
      ln -sf "/etc/nginx/sites-available/$D" "/etc/nginx/sites-enabled/$D"
      nginx -t 2>&1 && systemctl reload nginx
      if [ "$SSL" = "true" ]; then
        command -v certbot >/dev/null 2>&1 || (apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true)
        certbot --nginx -d "$D" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tail -5 || true
      fi
      echo "gateway publishing $D -> 127.0.0.1:$GP" ;;
    storage_sync)
      SP="$(GET source_path)"; TP="$(GET storage_path)"; TH="$(GET target_host)"
      [ -z "$TP" ] && { echo "storage_path required"; return 2; }
      SP="\${SP:-/var/www/$(GET domain)}"
      [ -d "$SP" ] || { echo "source missing: $SP"; return 3; }
      if [ -n "$TH" ]; then
        ssh -o StrictHostKeyChecking=no "$TH" "mkdir -p '$TP'" >/dev/null 2>&1 || true
        rsync -az --delete -e "ssh -o StrictHostKeyChecking=no" "$SP/" "$TH:$TP/" 2>&1 | tail -5
      else
        mkdir -p "$TP"
        rsync -az --delete "$SP/" "$TP/" 2>&1 | tail -5
      fi
      echo "synced $SP -> \${TH:+$TH:}$TP size_mb=$(du -sm "$SP" 2>/dev/null | cut -f1)" ;;
    storage_prune)
      TP="$(GET storage_path)"
      case "$TP" in /srv/tvcc-storage/*) rm -rf "$TP" && echo "pruned $TP" ;; *) echo "refused: path outside /srv/tvcc-storage"; return 2 ;; esac ;;
    restore_all)   restore_services ;;

    vpn_setup)
      command -v wg >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y wireguard >/dev/null 2>&1; }
      IF="$(GET interface)"; [ -n "$IF" ] || IF="wg0"
      ADDR="$(GET internal_ip)"; PORT="$(GET listen_port)"; [ -n "$PORT" ] || PORT="51820"
      [ -n "$ADDR" ] || { echo "internal_ip required"; return 2; }
      mkdir -p /etc/wireguard && chmod 700 /etc/wireguard
      [ -f "/etc/wireguard/$IF.key" ] || { wg genkey > "/etc/wireguard/$IF.key"; chmod 600 "/etc/wireguard/$IF.key"; }
      wg pubkey < "/etc/wireguard/$IF.key" > "/etc/wireguard/$IF.pub"
      cat > "/etc/wireguard/$IF.conf" <<EOF2
[Interface]
Address = $ADDR/24
ListenPort = $PORT
PrivateKey = $(cat /etc/wireguard/$IF.key)
EOF2
      chmod 600 "/etc/wireguard/$IF.conf"
      ufw allow "$PORT"/udp >/dev/null 2>&1 || true
      systemctl enable --now "wg-quick@$IF" >/dev/null 2>&1 || wg-quick up "$IF" >/dev/null 2>&1
      echo "vpn ready iface=$IF address=$ADDR public_key=$(cat /etc/wireguard/$IF.pub)" ;;

    vpn_peer_add)
      IF="$(GET interface)"; [ -n "$IF" ] || IF="wg0"
      PK="$(GET public_key)"; AIPS="$(GET allowed_ips)"; EP="$(GET endpoint)"; KA="$(GET keepalive)"
      [ -n "$PK" ] && [ -n "$AIPS" ] || { echo "public_key and allowed_ips required"; return 2; }
      [ -n "$KA" ] || KA="25"
      if [ -n "$EP" ]; then
        wg set "$IF" peer "$PK" allowed-ips "$AIPS" endpoint "$EP" persistent-keepalive "$KA"
      else
        wg set "$IF" peer "$PK" allowed-ips "$AIPS" persistent-keepalive "$KA"
      fi
      wg-quick save "$IF" >/dev/null 2>&1 || true
      echo "peer added $PK -> $AIPS" ;;

    vpn_peer_remove)
      IF="$(GET interface)"; [ -n "$IF" ] || IF="wg0"
      PK="$(GET public_key)"; [ -n "$PK" ] || { echo "public_key required"; return 2; }
      wg set "$IF" peer "$PK" remove && wg-quick save "$IF" >/dev/null 2>&1
      echo "peer removed $PK" ;;

    vpn_status)
      IF="$(GET interface)"; [ -n "$IF" ] || IF="wg0"
      wg show "$IF" 2>&1 || echo "interface $IF is down" ;;

    site_autostore)
      D="$(GET domain)"; TP="$(GET storage_path)"; TH="$(GET target_host)"
      [ -n "$D" ] || { echo "domain required"; return 2; }
      SP="/var/www/$D"
      mkdir -p "$SP" && chown -R www-data:www-data "$SP" 2>/dev/null || true
      mkdir -p "$TVCC_BACKUP_DIR/sites"
      SNAP="$TVCC_BACKUP_DIR/sites/\${D}-$(date +%Y%m%d%H%M).tar.gz"
      tar czf "$SNAP" -C "/var/www" "$D" 2>/dev/null || true
      ls -1t "$TVCC_BACKUP_DIR/sites/\${D}-"*.tar.gz 2>/dev/null | tail -n +4 | xargs -r rm -f
      if [ -n "$TP" ]; then
        if [ -n "$TH" ]; then
          ssh -o StrictHostKeyChecking=no "$TH" "mkdir -p '$TP'" >/dev/null 2>&1 || true
          rsync -az --delete -e "ssh -o StrictHostKeyChecking=no" "$SP/" "$TH:$TP/" >/dev/null 2>&1 || true
        else
          mkdir -p "$TP"; rsync -az --delete "$SP/" "$TP/" >/dev/null 2>&1 || true
        fi
      fi
      echo "autostore $D path=$SP size_mb=$(du -sm "$SP" 2>/dev/null | cut -f1) snapshot=$SNAP copies=$(ls -1 "$TVCC_BACKUP_DIR/sites/\${D}-"*.tar.gz 2>/dev/null | wc -l)" ;;
    autostore_scan)
      mkdir -p "$TVCC_BACKUP_DIR/sites"
      OUTL=""
      for DIR in /var/www/*/; do
        [ -d "$DIR" ] || continue
        DN=$(basename "$DIR")
        LAST=$(ls -1t "$TVCC_BACKUP_DIR/sites/\${DN}-"*.tar.gz 2>/dev/null | head -1)
        AGE="never"
        if [ -n "$LAST" ]; then AGE=$(( ( $(date +%s) - $(stat -c %Y "$LAST") ) / 3600 ))h; fi
        OUTL="$OUTL\\n$DN size_mb=$(du -sm "$DIR" 2>/dev/null | cut -f1) last_snapshot=$AGE"
      done
      printf 'autostore inventory:%b\\n' "$OUTL" ;;
    agent_sync_all)
      printf 'version=%s\\nsites=%s\\nunits=%s\\nports=%s\\ndisk=%s\\n' \\
        "$TVCC_AGENT_VERSION" \\
        "$(ls -1 /var/www 2>/dev/null | tr '\\n' ',')" \\
        "$(systemctl list-units --type=service --state=running --no-legend 2>/dev/null | awk '{print $1}' | tr '\\n' ',' | head -c 3000)" \\
        "$(ss -tulpn 2>/dev/null | awk 'NR>1{print $5}' | tr '\\n' ',' | head -c 2000)" \\
        "$(df -h / | tail -1)" ;;

    docker_ps)
      command -v docker >/dev/null 2>&1 || { echo "docker is not installed"; return 2; }
      docker ps -a --no-trunc --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","state":"{{.State}}","status":"{{.Status}}","ports":"{{.Ports}}","created":"{{.CreatedAt}}","size":"{{.Size}}"}' 2>&1 ;;
    docker_stats)
      command -v docker >/dev/null 2>&1 || { echo "docker is not installed"; return 2; }
      docker stats --no-stream --format '{"id":"{{.ID}}","name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","mem_pct":"{{.MemPerc}}","net":"{{.NetIO}}","block":"{{.BlockIO}}","pids":"{{.PIDs}}"}' 2>&1 ;;
    docker_images)
      command -v docker >/dev/null 2>&1 || { echo "docker is not installed"; return 2; }
      docker images --format '{"id":"{{.ID}}","repo":"{{.Repository}}","tag":"{{.Tag}}","size":"{{.Size}}","created":"{{.CreatedSince}}"}' 2>&1 ;;
    docker_networks)
      docker network ls --format '{"id":"{{.ID}}","name":"{{.Name}}","driver":"{{.Driver}}","scope":"{{.Scope}}"}' 2>&1 ;;
    docker_volumes)
      docker volume ls --format '{"name":"{{.Name}}","driver":"{{.Driver}}","mount":"{{.Mountpoint}}"}' 2>&1 ;;
    docker_logs)
      C="$(GET container)"; N="$(GET lines)"; [ -n "$C" ] || { echo "container required"; return 2; }
      docker logs --tail "\${N:-200}" "$C" 2>&1 | tail -c 20000 ;;
    docker_action)
      C="$(GET container)"; A="$(GET op)"
      case "$A" in start|stop|restart|pause|unpause) ;; *) echo "invalid op"; return 2 ;; esac
      docker "$A" "$C" 2>&1 && echo "$A ok: $C" ;;
    docker_exec)
      C="$(GET container)"; CMD="$(GET cmd)"; [ -n "$C" ] || { echo "container required"; return 2; }
      docker exec "$C" sh -lc "$CMD" 2>&1 | tail -c 20000 ;;
    docker_pull)
      IMG="$(GET image)"; [ -n "$IMG" ] || { echo "image required"; return 2; }
      docker pull "$IMG" 2>&1 | tail -20 ;;
    docker_rm)
      C="$(GET container)"; F="$(GET force)"
      [ -n "$C" ] || { echo "container required"; return 2; }
      if [ "$F" = "true" ]; then docker rm -f "$C" 2>&1; else docker rm "$C" 2>&1; fi ;;
    docker_compose_read)
      P="$(GET path)"; P="\${P:-/opt/tvcc/docker-compose.yml}"
      case "$P" in /opt/*|/srv/*|/home/*|/etc/tvcc/*) ;; *) echo "refused: path outside allowed roots"; return 2 ;; esac
      [ -f "$P" ] && cat "$P" || echo "compose file not found: $P" ;;
    docker_compose_write)
      P="$(GET path)"; P="\${P:-/opt/tvcc/docker-compose.yml}"
      case "$P" in /opt/*|/srv/*|/home/*|/etc/tvcc/*) ;; *) echo "refused: path outside allowed roots"; return 2 ;; esac
      mkdir -p "$(dirname "$P")"
      [ -f "$P" ] && cp -f "$P" "$P.tvcc-bak"
      echo "$ARGS" | python3 -c 'import sys,json;d=json.load(sys.stdin);open(d.get("path") or "/opt/tvcc/docker-compose.yml","w").write(d.get("content",""))'
      (docker compose -f "$P" config >/dev/null 2>&1 || docker-compose -f "$P" config >/dev/null 2>&1) \\
        && echo "compose written and validated: $P" \\
        || { [ -f "$P.tvcc-bak" ] && cp -f "$P.tvcc-bak" "$P"; echo "compose invalid — rolled back"; return 3; } ;;
    docker_compose_up)
      P="$(GET path)"; P="\${P:-/opt/tvcc/docker-compose.yml}"
      (docker compose -f "$P" up -d 2>&1 || docker-compose -f "$P" up -d 2>&1) | tail -30 ;;
    docker_compose_down)
      P="$(GET path)"; P="\${P:-/opt/tvcc/docker-compose.yml}"
      (docker compose -f "$P" down 2>&1 || docker-compose -f "$P" down 2>&1) | tail -30 ;;
    docker_create)
      printf '%s' "$ARGS" > /tmp/tvcc-docker-args.json
      cat > /tmp/tvcc-docker-build.py <<'PYC'
import json, shlex
d = json.load(open("/tmp/tvcc-docker-args.json"))
args = ["docker", "run", "-d", "--restart", d.get("restart") or "unless-stopped"]
if d.get("name"): args += ["--name", d["name"]]
for p in (d.get("ports") or []): args += ["-p", str(p)]
for v in (d.get("volumes") or []): args += ["-v", str(v)]
for k, val in (d.get("env") or {}).items(): args += ["-e", "%s=%s" % (k, val)]
if d.get("network"): args += ["--network", d["network"]]
args.append(d.get("image") or "")
if d.get("command"): args += shlex.split(d["command"])
print(" ".join(shlex.quote(a) for a in args if a))
PYC
      RUNCMD=$(python3 /tmp/tvcc-docker-build.py) || { echo "invalid container spec"; return 2; }
      echo "$RUNCMD"
      sh -lc "$RUNCMD" 2>&1 | tail -5 ;;

    docker_prune)
      docker system prune -f 2>&1 | tail -10 ;;

    nginx_vhost_list)
      AV=/etc/nginx/sites-available; EN=/etc/nginx/sites-enabled
      [ -d "$AV" ] || AV=/etc/nginx/conf.d
      for F in "$AV"/*; do
        [ -f "$F" ] || continue
        NAME=$(basename "$F")
        ENABLED=false; [ -e "$EN/$NAME" ] && ENABLED=true
        [ "$AV" = "/etc/nginx/conf.d" ] && ENABLED=true
        SN=$(grep -m1 -E '^[[:space:]]*server_name' "$F" 2>/dev/null | sed 's/.*server_name//; s/;//' | xargs || true)
        PR=$(grep -m1 -E 'proxy_pass' "$F" 2>/dev/null | sed 's/.*proxy_pass//; s/;//' | xargs || true)
        SSL=false; grep -q 'ssl_certificate' "$F" 2>/dev/null && SSL=true
        MT=$(stat -c %y "$F" 2>/dev/null | cut -d. -f1)
        printf '{"file":"%s","path":"%s","server_name":"%s","proxy_pass":"%s","enabled":%s,"ssl":%s,"modified":"%s"}\\n' \\
          "$NAME" "$F" "$SN" "$PR" "$ENABLED" "$SSL" "$MT"
      done ;;
    nginx_vhost_read)
      F="$(GET file)"; P="/etc/nginx/sites-available/$F"
      [ -f "$P" ] || P="/etc/nginx/conf.d/$F"
      [ -f "$P" ] || { echo "vhost not found: $F"; return 2; }
      cat "$P" ;;
    nginx_vhost_write)
      F="$(GET file)"; [ -n "$F" ] || { echo "file required"; return 2; }
      case "$F" in */*|..*) echo "refused: invalid file name"; return 2 ;; esac
      D=/etc/nginx/sites-available; [ -d "$D" ] || D=/etc/nginx/conf.d
      P="$D/$F"
      [ -f "$P" ] && cp -f "$P" "/var/backups/tvcc/nginx-$F-$(date +%Y%m%d%H%M%S).bak"
      [ -f "$P" ] && cp -f "$P" "$P.tvcc-prev"
      echo "$ARGS" | python3 -c 'import sys,json,os;d=json.load(sys.stdin);base=d.get("dir") or "/etc/nginx/sites-available";base=base if os.path.isdir(base) else "/etc/nginx/conf.d";open(os.path.join(base,d["file"]),"w").write(d.get("content",""))'
      if nginx -t 2>&1; then
        systemctl reload nginx 2>&1 && echo "vhost saved and nginx reloaded: $F"
      else
        [ -f "$P.tvcc-prev" ] && cp -f "$P.tvcc-prev" "$P" || rm -f "$P"
        nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1
        echo "config test failed — rolled back automatically"; return 3
      fi ;;
    nginx_vhost_enable)
      F="$(GET file)"; ln -sf "/etc/nginx/sites-available/$F" "/etc/nginx/sites-enabled/$F"
      nginx -t 2>&1 && systemctl reload nginx && echo "enabled $F" ;;
    nginx_vhost_disable)
      F="$(GET file)"; rm -f "/etc/nginx/sites-enabled/$F"
      nginx -t 2>&1 && systemctl reload nginx && echo "disabled $F" ;;
    nginx_vhost_delete)
      F="$(GET file)"; case "$F" in */*|..*) echo "refused"; return 2 ;; esac
      [ -f "/etc/nginx/sites-available/$F" ] && cp -f "/etc/nginx/sites-available/$F" "/var/backups/tvcc/nginx-deleted-$F-$(date +%s).bak"
      rm -f "/etc/nginx/sites-enabled/$F" "/etc/nginx/sites-available/$F" "/etc/nginx/conf.d/$F"
      nginx -t 2>&1 && systemctl reload nginx && echo "deleted $F" ;;
    nginx_cert_list)
      for C in /etc/letsencrypt/live/*/fullchain.pem /etc/tvcc/ssl/*/fullchain.pem; do
        [ -f "$C" ] || continue
        DN=$(basename "$(dirname "$C")")
        END=$(openssl x509 -enddate -noout -in "$C" 2>/dev/null | cut -d= -f2)
        ISS=$(openssl x509 -issuer -noout -in "$C" 2>/dev/null | sed 's/issuer=//')
        printf '{"domain":"%s","expires":"%s","issuer":"%s","path":"%s"}\\n' "$DN" "$END" "$ISS" "$C"
      done ;;
    nginx_cert_issue)
      D="$(GET domain)"; EM="$(GET email)"
      [ -n "$D" ] || { echo "domain required"; return 2; }
      command -v certbot >/dev/null 2>&1 || (apt-get update -y >/dev/null 2>&1; apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true)
      if [ -n "$EM" ]; then
        certbot --nginx -d "$D" --non-interactive --agree-tos -m "$EM" 2>&1 | tail -12
      else
        certbot --nginx -d "$D" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tail -12
      fi ;;
    nginx_cert_renew)
      certbot renew --quiet 2>&1 | tail -20; echo "renew pass finished" ;;
    nginx_access_log)
      F="$(GET file)"; N="$(GET lines)"; Q="$(GET grep)"
      P="\${F:-/var/log/nginx/access.log}"
      [ -f "$P" ] || { echo "log not found: $P"; return 2; }
      if [ -n "$Q" ]; then grep -a -- "$Q" "$P" | tail -n "\${N:-200}"; else tail -n "\${N:-200}" "$P"; fi ;;
    nginx_error_log)
      N="$(GET lines)"; tail -n "\${N:-200}" /var/log/nginx/error.log 2>&1 ;;
    nginx_stats)
      P=/var/log/nginx/access.log
      [ -f "$P" ] || { echo "access log not found"; return 2; }
      T=$(wc -l < "$P")
      printf 'total_requests=%s\\n' "$T"
      printf 'status_4xx=%s\\n' "$(awk '{print $9}' "$P" | grep -c '^4' || true)"
      printf 'status_5xx=%s\\n' "$(awk '{print $9}' "$P" | grep -c '^5' || true)"
      echo "top_hosts:"; awk '{print $1}' "$P" | sort | uniq -c | sort -rn | head -10
      echo "top_paths:"; awk '{print $7}' "$P" | sort | uniq -c | sort -rn | head -10 ;;

    *) echo "unsupported action: $ACTION"; return 127 ;;

  esac

}

install_systemd() {
  # Templated unit: one service per agent key -> tvcc-agent@main, tvcc-agent@db, ...
  cat > /etc/systemd/system/tvcc-agent@.service <<'EOF'
[Unit]
Description=TVCC Agent (%i)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/tvcc-agent.sh
Restart=always
RestartSec=10
User=root
Environment="TVCC_AGENT_KEY=%i"
EnvironmentFile=-/etc/tvcc/agent-%i.env
Environment="TVCC_BACKUP_DIR=/var/backups/tvcc"
StandardOutput=append:/var/log/tvcc-agent-%i.log
StandardError=append:/var/log/tvcc-agent-%i.log

[Install]
WantedBy=multi-user.target
EOF

  mkdir -p /etc/tvcc
  printf 'TVCC_AGENT_ROLE=%s\n' "\${TVCC_AGENT_ROLE}" > "/etc/tvcc/agent-\${TVCC_AGENT_KEY}.env"
  chmod 600 "/etc/tvcc/agent-\${TVCC_AGENT_KEY}.env"

  cat > /etc/logrotate.d/tvcc-agent <<'EOF'
/var/log/tvcc-agent*.log {
  daily
  rotate 7
  size 20M
  missingok
  notifempty
  copytruncate
  compress
}
EOF

  # Legacy single-instance unit is replaced by the templated one.
  if systemctl list-unit-files 2>/dev/null | grep -q '^tvcc-agent.service'; then
    systemctl disable --now tvcc-agent.service >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/tvcc-agent.service
  fi

  systemctl daemon-reload
  systemctl enable "tvcc-agent@\${TVCC_AGENT_KEY}.service"
  systemctl restart "tvcc-agent@\${TVCC_AGENT_KEY}.service"
  echo "systemd service tvcc-agent@\${TVCC_AGENT_KEY} installed and started"
}

preflight() {
  local PROBLEMS=""
  [ "$(id -u)" = "0" ] || PROBLEMS="\${PROBLEMS}root required; "
  command -v curl >/dev/null 2>&1 || PROBLEMS="\${PROBLEMS}curl missing; "
  command -v python3 >/dev/null 2>&1 || PROBLEMS="\${PROBLEMS}python3 missing; "
  command -v openssl >/dev/null 2>&1 || PROBLEMS="\${PROBLEMS}openssl missing; "
  command -v systemctl >/dev/null 2>&1 || echo "warn: systemd not found — agent will run in foreground mode"
  if [ -n "$PROBLEMS" ]; then echo "preflight failed: $PROBLEMS"; return 1; fi
  echo "preflight ok (key=\${TVCC_AGENT_KEY} role=\${TVCC_AGENT_ROLE})"
}


restore_services() { # bring every registered unit back up after a reboot
  local REPORT="" OKC=0 FAILC=0
  for U in nginx docker dnsmasq postgresql redis-server; do
    systemctl list-unit-files 2>/dev/null | grep -q "^$U.service" || continue
    if systemctl start "$U" 2>/dev/null; then OKC=$((OKC+1)); REPORT="$REPORT $U:ok"; else FAILC=$((FAILC+1)); REPORT="$REPORT $U:fail"; fi
  done
  for U in $(systemctl list-unit-files --no-legend 2>/dev/null | awk '{print $1}' | grep -E '^(tvcc-|wg-quick@)' || true); do
    if systemctl start "$U" 2>/dev/null; then OKC=$((OKC+1)); REPORT="$REPORT $U:ok"; else FAILC=$((FAILC+1)); REPORT="$REPORT $U:fail"; fi
  done
  command -v docker >/dev/null 2>&1 && (docker start $(docker ps -aq --filter "status=exited") >/dev/null 2>&1 || true)
  echo "restored ok=$OKC failed=$FAILC:$REPORT"
}

# ---- boot restoration: run once per agent start ----
BOOT_MSG=$(restore_services 2>&1 | tail -c 4000)
BOOT_J=$(printf '%s' "$BOOT_MSG" | json_escape)
post "{\\"server_id\\":\\"\${TVCC_SERVER_ID}\\",\\"agent_id\\":\\"\${TVCC_AGENT_ID}\\",\\"agent_version\\":\\"\${TVCC_AGENT_VERSION}\\",\\"event\\":{\\"kind\\":\\"boot_restore\\",\\"severity\\":\\"info\\",\\"message\\":$BOOT_J}}" >/dev/null || true

# ---- fast task channel: long-poll, execute, report back in seconds ----
task_loop() {
  local BACKOFF=1
  while true; do
    PUB=$(curl -s --max-time 6 https://api.ipify.org 2>/dev/null || echo "")
    REQ="{\\"agent_id\\":\\"\${TVCC_AGENT_ID}\\",\\"agent_key\\":\\"\${TVCC_AGENT_KEY}\\",\\"agent_role\\":\\"\${TVCC_AGENT_ROLE}\\",\\"machine_id\\":\\"\${TVCC_MACHINE_ID}\\",\\"agent_version\\":\\"\${TVCC_AGENT_VERSION}\\",\\"public_ip\\":\\"\${PUB}\\",\\"os\\":\\"$(. /etc/os-release 2>/dev/null && echo "\${PRETTY_NAME:-linux}" || echo linux)\\",\\"wait\\":\${TVCC_TASK_WAIT},\\"results\\":\${TVCC_PENDING_RESULTS:-[]}}"
    RESP=$(post_tasks "$REQ")
    TVCC_PENDING_RESULTS="[]"

    if [ -z "$RESP" ] || [ "$RESP" = "{}" ]; then
      sleep "$BACKOFF"; BACKOFF=$(( BACKOFF < 30 ? BACKOFF*2 : 30 )); continue
    fi
    BACKOFF=1

    # store capability map locally (second line of defence)
    jget "$RESP" 'json.dumps(d.get("capabilities",[]))' > "$TVCC_STATE_DIR/caps.json" 2>/dev/null || true

    # self-update when the platform ships a newer agent
    WANT=$(jget "$RESP" 'd.get("agent_version","")')
    if [ -n "$WANT" ] && [ "$WANT" != "$TVCC_AGENT_VERSION" ]; then
      self_update "$(jget "$RESP" 'd.get("script_url","")')" >/dev/null 2>&1 || true
    fi

    CMDS=$(jget "$RESP" 'json.dumps(d.get("commands",[]))')
    [ -n "$CMDS" ] || CMDS="[]"
    COUNT=$(jget "$CMDS" 'len(d)')
    [ -n "$COUNT" ] || COUNT=0
    if [ "$COUNT" -eq 0 ]; then sleep 0.5; continue; fi

    RESULTS="["
    for i in $(seq 0 $((COUNT-1))); do
      ID=$(jget "$CMDS" "d[$i]['id']"); [ -n "$ID" ] || continue
      ACTION=$(jget "$CMDS" "d[$i]['action']"); [ -n "$ACTION" ] || continue
      ARGS=$(jget "$CMDS" "json.dumps(d[$i].get('args',{}))")
      DRY=$(jget "$CMDS" "'true' if d[$i].get('dry_run') else 'false'")
      S0=$(date +%s%3N)
      set +e
      case "$ACTION" in
        agent_self_update)
          OUT=$(self_update "$(jget "$RESP" 'd.get("script_url","")')" 2>&1); CODE=$? ;;
        agent_diag)
          OUT=$(printf 'version=%s\\nstate=%s\\ncaps=%s\\nuptime=%s\\n' "$TVCC_AGENT_VERSION" "$TVCC_STATE_DIR" "$(cat "$TVCC_STATE_DIR/caps.json" 2>/dev/null | head -c 2000)" "$(uptime -p 2>/dev/null)"); CODE=0 ;;
        job_cancel)
          OUT="cancelled"; CODE=0 ;;
        *)
          if ! cap_allows "$ACTION"; then
            OUT="rejected: الأمر $ACTION غير مسموح لهذا السيرفر حسب الصلاحيات"; CODE=13
          else
            OUT=$(run_command "$ACTION" "$ARGS" "$DRY" 2>&1 | tail -c 20000); CODE=$?
          fi ;;
      esac
      set -e
      S1=$(date +%s%3N)
      OUT_J=$(printf '%s' "$OUT" | json_escape)
      [ "$RESULTS" != "[" ] && RESULTS="$RESULTS,"
      RESULTS="$RESULTS{\\"id\\":\\"$ID\\",\\"exit_code\\":$CODE,\\"output\\":$OUT_J,\\"duration_ms\\":$((S1-S0))}"
    done
    RESULTS="$RESULTS]"
    TVCC_PENDING_RESULTS="$RESULTS"
  done
}

# ---- CLI: ./tvcc-agent.sh install | preflight | uninstall ----
case "\${1:-run}" in
  preflight) preflight; exit $? ;;
  install)
    preflight || exit 1
    if command -v systemctl >/dev/null 2>&1; then install_systemd; exit 0; fi
    echo "systemd unavailable — starting in background"
    nohup "$0" run >"/var/log/tvcc-agent-\${TVCC_AGENT_KEY}.log" 2>&1 &
    exit 0 ;;
  uninstall)
    systemctl disable --now "tvcc-agent@\${TVCC_AGENT_KEY}.service" >/dev/null 2>&1 || true
    echo "agent \${TVCC_AGENT_KEY} stopped"; exit 0 ;;
esac

task_loop &
TVCC_TASK_PID=$!
trap 'kill $TVCC_TASK_PID 2>/dev/null || true' EXIT

while true; do
  # ---- real OS metrics: /proc/stat, /proc/meminfo, df -B1 / ----
  CORE=$(python3 <<'PYEOF'
import json, time

def cpu_sample():
    with open("/proc/stat") as f:
        p = f.readline().split()[1:]
    v = [int(x) for x in p]
    idle = v[3] + (v[4] if len(v) > 4 else 0)
    return sum(v), idle

t1, i1 = cpu_sample()
time.sleep(1)
t2, i2 = cpu_sample()
dt, di = t2 - t1, i2 - i1
cpu = round(max(0.0, min(100.0, (1 - di / dt) * 100)), 2) if dt > 0 else 0.0

mi = {}
with open("/proc/meminfo") as f:
    for line in f:
        k, val = line.split(":", 1)
        mi[k] = int(val.strip().split()[0]) * 1024  # bytes
mem_total = mi.get("MemTotal", 0)
mem_avail = mi.get("MemAvailable", mi.get("MemFree", 0))
mem_used = max(0, mem_total - mem_avail)

import subprocess
disk_total = disk_used = 0
try:
    out = subprocess.check_output(["df", "-B1", "--output=size,used", "/"], stderr=subprocess.DEVNULL).decode()
    parts = out.strip().splitlines()[-1].split()
    disk_total, disk_used = int(parts[0]), int(parts[1])
except Exception:
    pass

with open("/proc/uptime") as f:
    up = int(float(f.read().split()[0]))

print(json.dumps({
    "cpu_percent": cpu,
    "memory_used_bytes": mem_used,
    "memory_total_bytes": mem_total,
    "memory_available_bytes": mem_avail,
    "disk_used_bytes": disk_used,
    "disk_total_bytes": disk_total,
    "mem_used_mb": round(mem_used / 1048576),
    "mem_total_mb": round(mem_total / 1048576),
    "disk_used_gb": round(disk_used / 1073741824, 2),
    "disk_total_gb": round(disk_total / 1073741824, 2),
    "uptime_seconds": up,
    "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
}))
PYEOF
)
  [ -z "$CORE" ] && CORE='{}'
  CPU=$(echo "$CORE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("cpu_percent",0))' 2>/dev/null || echo 0)
  MEM_TOTAL=$(echo "$CORE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("mem_total_mb",0))' 2>/dev/null || echo 0)
  MEM_USED=$(echo "$CORE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("mem_used_mb",0))' 2>/dev/null || echo 0)
  DISK_TOTAL=$(echo "$CORE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("disk_total_gb",0))' 2>/dev/null || echo 0)
  DISK_USED=$(echo "$CORE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("disk_used_gb",0))' 2>/dev/null || echo 0)
  LOAD=$(awk '{print $1}' /proc/loadavg)
  UPTIME=$(awk '{print int($1)}' /proc/uptime)
  PROCS=$(ps -e --no-headers | wc -l)
  # raw network counters (sum of all non-loopback interfaces)
  NET_RX=0; NET_TX=0
  if [ -d /sys/class/net ]; then
    for IF in /sys/class/net/*; do
      N=$(basename "$IF"); [ "$N" = "lo" ] && continue
      RX=$(cat "$IF/statistics/rx_bytes" 2>/dev/null || echo 0); TX=$(cat "$IF/statistics/tx_bytes" 2>/dev/null || echo 0)
      NET_RX=$((NET_RX + RX)); NET_TX=$((NET_TX + TX))
    done
  fi
  OS=$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)
  PUBLIC_IP=$( (curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || echo "") | head -1 | tr -d '\\n')
  PRIVATE_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '\\n')

  # ---- immediate signal when the machine's IP changed ----
  IP_NOW="\${PUBLIC_IP}|\${PRIVATE_IP}"
  IP_PREV=$(cat "$TVCC_STATE_DIR/last_ip" 2>/dev/null || echo "")
  if [ "$IP_NOW" != "$IP_PREV" ]; then
    echo "$IP_NOW" > "$TVCC_STATE_DIR/last_ip" 2>/dev/null || true
    if [ -n "$IP_PREV" ]; then
      post "{\\"server_id\\":\\"\${TVCC_SERVER_ID}\\",\\"agent_id\\":\\"\${TVCC_AGENT_ID}\\",\\"agent_version\\":\\"\${TVCC_AGENT_VERSION}\\",\\"public_ip\\":\\"\${PUBLIC_IP}\\",\\"private_ip\\":\\"\${PRIVATE_IP}\\",\\"event\\":{\\"kind\\":\\"ip_changed\\",\\"severity\\":\\"warning\\",\\"message\\":\\"IP changed \${IP_PREV} -> \${IP_NOW}\\"}}" >/dev/null || true
    fi
  fi
  KERNEL=$(uname -r 2>/dev/null || echo "")
  ARCH=$(uname -m 2>/dev/null || echo "")


  # ---- v3 rich telemetry: disks, network, services, containers, security ----
  EXTRA=$(TVCC_PREV_LAT="\${TVCC_PREV_LAT:-}" python3 <<'PYEOF'
import json, os, glob, subprocess, time

def sh(cmd, timeout=12):
    try:
        return subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=timeout).decode()
    except Exception:
        return ""

out = {}
try:
    p = open("/proc/loadavg").read().split()
    out["load5"] = float(p[1]); out["load15"] = float(p[2])
except Exception: pass
try:
    out["cpu_cores"] = os.cpu_count()
except Exception: pass
try:
    for l in open("/proc/cpuinfo"):
        if l.startswith("model name") and "cpu_model" not in out:
            out["cpu_model"] = l.split(":", 1)[1].strip()[:80]
        if l.startswith("cpu MHz") and "cpu_mhz" not in out:
            out["cpu_mhz"] = round(float(l.split(":", 1)[1].strip()))
except Exception: pass
for z in glob.glob("/sys/class/thermal/thermal_zone*/temp"):
    try:
        out["cpu_temp_c"] = round(int(open(z).read().strip()) / 1000, 1)
        break
    except Exception: pass
try:
    mi = {}
    for l in open("/proc/meminfo"):
        k, v = l.split(":", 1)
        mi[k] = int(v.strip().split()[0])
    out["mem_available_mb"] = round(mi.get("MemAvailable", 0) / 1024)
    out["swap_total_mb"] = round(mi.get("SwapTotal", 0) / 1024)
    out["swap_used_mb"] = round((mi.get("SwapTotal", 0) - mi.get("SwapFree", 0)) / 1024)
except Exception: pass

lat = os.environ.get("TVCC_PREV_LAT", "")
out["latency_ms"] = float(lat) if lat else None

try:
    ps = sh(["ps", "-eo", "comm,%cpu,%mem", "--sort=-%cpu"])
    tops = []
    for l in ps.splitlines()[1:6]:
        f = l.split()
        if len(f) >= 3:
            tops.append({"name": f[0][:40], "cpu": float(f[1]), "mem": float(f[2])})
    out["top_processes"] = tops
except Exception: pass

now = time.time()
prev = {}
try: prev = json.load(open("/tmp/tvcc-net-prev.json"))
except Exception: pass
ifaces = []
try:
    for line in open("/proc/net/dev").read().splitlines()[2:]:
        name, rest = line.split(":")
        name = name.strip()
        if name == "lo": continue
        f = rest.split()
        rx, tx = int(f[0]), int(f[8])
        p = prev.get(name)
        rx_bps = tx_bps = None
        if p and now - p["ts"] > 0:
            dt = now - p["ts"]
            rx_bps = round(max(0, rx - p["rx"]) / dt)
            tx_bps = round(max(0, tx - p["tx"]) / dt)
        prev[name] = {"ts": now, "rx": rx, "tx": tx}
        ifaces.append({"name": name, "rx_bps": rx_bps, "tx_bps": tx_bps,
                       "rx_errors": int(f[2]), "tx_errors": int(f[10]),
                       "rx_dropped": int(f[3]), "tx_dropped": int(f[11])})
except Exception: pass
try: json.dump(prev, open("/tmp/tvcc-net-prev.json", "w"))
except Exception: pass
out["net_interfaces"] = ifaces[:20]
out["net_rx_bps"] = sum(i["rx_bps"] or 0 for i in ifaces) or None
out["net_tx_bps"] = sum(i["tx_bps"] or 0 for i in ifaces) or None

dprev = {}
try: dprev = json.load(open("/tmp/tvcc-disk-prev.json"))
except Exception: pass
diskstats = {}
try:
    for l in open("/proc/diskstats"):
        f = l.split()
        if len(f) >= 14:
            diskstats[f[2]] = (int(f[5]), int(f[9]))
except Exception: pass
disks = []
try:
    lines = sh(["df", "-B1", "--output=target,source,size,used", "-x", "tmpfs", "-x", "devtmpfs", "-x", "overlay", "-x", "squashfs"]).splitlines()[1:]
    ipct = {}
    for l in sh(["df", "-i", "--output=target,ipcent", "-x", "tmpfs", "-x", "devtmpfs", "-x", "overlay", "-x", "squashfs"]).splitlines()[1:]:
        p = l.split()
        if len(p) >= 2: ipct[p[0]] = p[1].rstrip("%")
    seen = set()
    for l in lines:
        p = l.split()
        if len(p) < 4 or p[0] in seen: continue
        seen.add(p[0])
        size, used = int(p[2]), int(p[3])
        if size <= 0: continue
        dev = p[1].split("/")[-1]
        rd = wr = None
        d = None
        for cand in (dev, dev.rstrip("0123456789"), dev.rstrip("p0123456789")):
            if cand in diskstats:
                d = diskstats[cand]; break
        if d:
            pp = dprev.get(p[1])
            if pp and now - pp["ts"] > 0:
                dt = now - pp["ts"]
                rd = round(max(0, d[0] - pp["r"]) * 512 / dt)
                wr = round(max(0, d[1] - pp["w"]) * 512 / dt)
            dprev[p[1]] = {"ts": now, "r": d[0], "w": d[1]}
        try: ip = float(ipct.get(p[0], "0") or 0)
        except Exception: ip = 0
        disks.append({"mount": p[0], "device": p[1], "total_gb": round(size / 1073741824, 2),
                      "used_gb": round(used / 1073741824, 2), "read_bps": rd, "write_bps": wr,
                      "inodes_pct": ip, "health": "ok"})
except Exception: pass
try: json.dump(dprev, open("/tmp/tvcc-disk-prev.json", "w"))
except Exception: pass
out["disks"] = disks[:20]

names = ["nginx", "apache2", "postgresql", "mysql", "mariadb", "docker", "containerd",
         "redis-server", "ollama", "ssh", "sshd", "ufw", "fail2ban", "dnsmasq", "cron", "tvcc-agent"]
try:
    for l in sh(["systemctl", "list-units", "--type=service", "--all", "--no-legend", "--no-pager"]).splitlines():
        n = l.split()[0].replace(".service", "")
        if n.startswith("tvcc-") and n not in names: names.append(n)
except Exception: pass
services = []
for n in names:
    rc = subprocess.run(["systemctl", "status", n], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
    if rc == 4: continue
    st = sh(["systemctl", "is-active", n]).strip() or "unknown"
    if st == "unknown": continue
    sub = sh(["systemctl", "show", n, "-p", "SubState", "--value"]).strip()
    rst = sh(["systemctl", "show", n, "-p", "NRestarts", "--value"]).strip()
    services.append({"name": n, "status": st, "sub_status": sub or None,
                     "restarts": int(rst) if rst.isdigit() else None})
out["services"] = services[:60]

containers = []
if sh(["sh", "-c", "command -v docker"]).strip():
    stats = {}
    try:
        for l in sh(["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}"], timeout=20).splitlines():
            f = l.split("|")
            if len(f) >= 3: stats[f[0]] = (f[1], f[2])
    except Exception: pass
    try:
        for l in sh(["docker", "ps", "-a", "--format", "{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}"], timeout=15).splitlines():
            f = l.split("|")
            if len(f) < 5: continue
            name, image, status, state, ports = f[0], f[1], f[2], f[3], f[4]
            cpu = None; mb = None
            if name in stats:
                cpu = stats[name][0].rstrip("%")
                memraw = stats[name][1].split("/")[0].strip()
                try:
                    if memraw.endswith("GiB"): mb = round(float(memraw[:-3]) * 1024, 1)
                    elif memraw.endswith("MiB"): mb = round(float(memraw[:-3]), 1)
                    elif memraw.endswith("KiB"): mb = round(float(memraw[:-3]) / 1024, 2)
                except Exception: pass
            rst = sh(["docker", "inspect", "-f", "{{.RestartCount}}", name]).strip()
            containers.append({"name": name, "image": image[:80], "status": status[:80], "state": state,
                               "cpu_pct": float(cpu) if cpu else None, "mem_mb": mb,
                               "restarts": int(rst) if rst.isdigit() else None,
                               "ports": ports[:120] or None})
    except Exception: pass
out["containers"] = containers[:50]

sec = {}
try:
    failed = sh(["sh", "-c", "journalctl -u ssh -u sshd --since '24 hours ago' --no-pager 2>/dev/null | grep -ci 'failed password'"])
    if not failed.strip().isdigit():
        failed = sh(["sh", "-c", "grep -ci 'failed password' /var/log/auth.log 2>/dev/null"])
    sec["failed_ssh_24h"] = int(failed.strip()) if failed.strip().isdigit() else 0
except Exception: sec["failed_ssh_24h"] = 0
try:
    up = sh(["sh", "-c", "apt list --upgradable 2>/dev/null | tail -n +2 | wc -l"], timeout=30)
    sec["updates_pending"] = int(up.strip()) if up.strip().isdigit() else 0
except Exception: sec["updates_pending"] = 0
sec["firewall_active"] = "Status: active" in sh(["ufw", "status"])
w = sh(["sh", "-c", "who | wc -l"])
sec["active_users"] = int(w.strip()) if w.strip().isdigit() else 0
out["security"] = sec

print(json.dumps(out))
PYEOF
)

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

  BODY="{\\"server_id\\":\\"\${TVCC_SERVER_ID}\\",\\"agent_id\\":\\"\${TVCC_AGENT_ID}\\",\\"agent_key\\":\\"\${TVCC_AGENT_KEY}\\",\\"agent_role\\":\\"\${TVCC_AGENT_ROLE}\\",\\"machine_id\\":\\"\${TVCC_MACHINE_ID}\\",\\"net_rx_bytes\\":\${NET_RX:-0},\\"net_tx_bytes\\":\${NET_TX:-0},\\"cpu_percent\\":\${CPU:-0},\\"mem_used_mb\\":\${MEM_USED:-0},\\"mem_total_mb\\":\${MEM_TOTAL:-0},\\"disk_used_gb\\":\${DISK_USED:-0},\\"disk_total_gb\\":\${DISK_TOTAL:-0},\\"load_avg\\":\${LOAD:-0},\\"uptime_seconds\\":\${UPTIME:-0},\\"process_count\\":\${PROCS:-0},\\"os\\":\\"\${OS}\\",\\"kernel\\":\\"\${KERNEL}\\",\\"arch\\":\\"\${ARCH}\\",\\"agent_version\\":\\"\${TVCC_AGENT_VERSION}\\",\\"public_ip\\":\\"\${PUBLIC_IP}\\",\\"private_ip\\":\\"\${PRIVATE_IP}\\",\\"is_tvcc_node\\":\${TVCC_NODE},\\"tvcc_version\\":\\"\${TVCC_VERSION}\\",\\"ai_endpoint\\":\\"\${TVCC_AI_ENDPOINT}\\",\\"ai_models\\":\${AI_MODELS},\\"ports\\":\${PORTS},\\"configs\\":\${CONFIGS}}"
  BODY=$(python3 -c 'import sys,json
b=json.loads(sys.argv[1])
for extra in sys.argv[2:]:
    if extra:
        try: b.update(json.loads(extra))
        except Exception: pass
print(json.dumps(b))' "$BODY" "$CORE" "\${EXTRA:-}" 2>/dev/null || echo "$BODY")


  T0=$(date +%s%3N)
  RESP=$(post "$BODY")
  T1=$(date +%s%3N)
  TVCC_PREV_LAT=$((T1-T0))

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

  sleep "\${TVCC_HEARTBEAT_INTERVAL}"
done
`;
}
