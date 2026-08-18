export function buildAgentScript(serverId: string, token: string, endpoint: string): string {
  return `#!/usr/bin/env bash
# TVCC agent — sends server resources + local AI models every 60s
set -euo pipefail
TVCC_SERVER_ID="${serverId}"
TVCC_TOKEN="${token}"
TVCC_ENDPOINT="${endpoint}"
TVCC_AI_ENDPOINT="\${TVCC_AI_ENDPOINT:-http://127.0.0.1:11434}"

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

  BODY="{\\"cpu_percent\\":\${CPU:-0},\\"mem_used_mb\\":\${MEM_USED:-0},\\"mem_total_mb\\":\${MEM_TOTAL:-0},\\"disk_used_gb\\":\${DISK_USED:-0},\\"disk_total_gb\\":\${DISK_TOTAL:-0},\\"load_avg\\":\${LOAD:-0},\\"uptime_seconds\\":\${UPTIME:-0},\\"process_count\\":\${PROCS:-0},\\"os\\":\\"\${OS}\\",\\"agent_version\\":\\"1.0.0\\",\\"ai_endpoint\\":\\"\${TVCC_AI_ENDPOINT}\\",\\"ai_models\\":\${AI_MODELS}}"

  SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$TVCC_TOKEN" -hex | awk '{print $NF}')
  curl -s -o /dev/null -X POST "$TVCC_ENDPOINT" \\
    -H "content-type: application/json" \\
    -H "x-tvcc-server: $TVCC_SERVER_ID" \\
    -H "x-tvcc-signature: sha256=$SIG" \\
    --data "$BODY" || true
  sleep 60
done
`;
}
