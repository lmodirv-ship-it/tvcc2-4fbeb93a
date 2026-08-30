export function buildAgentScript(serverId: string, token: string, endpoint: string): string {
  return `#!/usr/bin/env bash
# TVCC agent — resources + AI models + open ports + configs, and runs whitelisted commands
set -euo pipefail
TVCC_SERVER_ID="${serverId}"
TVCC_TOKEN="${token}"
TVCC_ENDPOINT="${endpoint}"
TVCC_AI_ENDPOINT="\${TVCC_AI_ENDPOINT:-http://127.0.0.1:11434}"
TVCC_BACKUP_DIR="\${TVCC_BACKUP_DIR:-/var/backups/tvcc}"
TVCC_AGENT_VERSION="3.1.0"
TVCC_HEARTBEAT_INTERVAL="\${TVCC_HEARTBEAT_INTERVAL:-180}"
TVCC_HN_DIR="\${TVCC_HN_DIR:-/home/ismail/hn}"
mkdir -p "$TVCC_BACKUP_DIR"
mkdir -p "$TVCC_HN_DIR" 2>/dev/null || true
# stable agent id per machine
TVCC_AGENT_ID=$(cat /etc/tvcc-agent-id 2>/dev/null || true)
if [ -z "\${TVCC_AGENT_ID:-}" ]; then
  TVCC_AGENT_ID=$( (cat /etc/machine-id 2>/dev/null || head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \\n') )
  echo "$TVCC_AGENT_ID" > /etc/tvcc-agent-id 2>/dev/null || true
fi


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
      watch_start)     echo "[dry-run] inotifywait watcher on /var/www/$(GET domain)" ;;
      watch_stop)      echo "[dry-run] systemctl stop tvcc-watch-$(GET domain)" ;;
      git_deploy)      echo "[dry-run] git clone/pull $(GET repo) ($(GET branch)) -> $(GET path); build: $(GET build)" ;;
      failover_switch) echo "[dry-run] switch upstream of $(GET domain) -> $(GET target) then nginx -s reload" ;;
      deploy_upload)   echo "[dry-run] download $(GET url) -> $(GET path)/$(GET name); unzip; install/build; systemd $(GET service); ufw allow $(GET port)/tcp" ;;
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
  OS=$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)
  PUBLIC_IP=$( (curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || echo "") | head -1 | tr -d '\\n')
  PRIVATE_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '\\n')
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

  BODY="{\\"server_id\\":\\"\${TVCC_SERVER_ID}\\",\\"agent_id\\":\\"\${TVCC_AGENT_ID}\\",\\"cpu_percent\\":\${CPU:-0},\\"mem_used_mb\\":\${MEM_USED:-0},\\"mem_total_mb\\":\${MEM_TOTAL:-0},\\"disk_used_gb\\":\${DISK_USED:-0},\\"disk_total_gb\\":\${DISK_TOTAL:-0},\\"load_avg\\":\${LOAD:-0},\\"uptime_seconds\\":\${UPTIME:-0},\\"process_count\\":\${PROCS:-0},\\"os\\":\\"\${OS}\\",\\"kernel\\":\\"\${KERNEL}\\",\\"arch\\":\\"\${ARCH}\\",\\"agent_version\\":\\"\${TVCC_AGENT_VERSION}\\",\\"public_ip\\":\\"\${PUBLIC_IP}\\",\\"private_ip\\":\\"\${PRIVATE_IP}\\",\\"is_tvcc_node\\":\${TVCC_NODE},\\"tvcc_version\\":\\"\${TVCC_VERSION}\\",\\"ai_endpoint\\":\\"\${TVCC_AI_ENDPOINT}\\",\\"ai_models\\":\${AI_MODELS},\\"ports\\":\${PORTS},\\"configs\\":\${CONFIGS}}"
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
