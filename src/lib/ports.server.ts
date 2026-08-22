/** Server-only helpers for the ports hub: service catalog, bridges, proxy paths. */

export type ServiceTemplate = {
  id: string;
  label: string;
  port: number;
  kind: string;
  /** shell snippet executed through the agent's platform_deploy action */
  install: string;
  check: string;
};

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: "ollama",
    label: "Ollama (نماذج ذكاء محلية)",
    port: 11434,
    kind: "ai",
    install:
      "command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh; systemctl enable --now ollama || (OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve >/var/log/ollama.log 2>&1 &); sleep 2; ollama list",
    check: "curl -s -m 5 http://127.0.0.1:11434/api/tags | head -c 400",
  },
  {
    id: "postgres",
    label: "PostgreSQL",
    port: 5432,
    kind: "database",
    install: "command -v psql >/dev/null || (apt-get update -y && apt-get install -y postgresql); systemctl enable --now postgresql; systemctl is-active postgresql",
    check: "pg_isready -h 127.0.0.1 -p 5432",
  },
  {
    id: "redis",
    label: "Redis",
    port: 6379,
    kind: "cache",
    install: "command -v redis-server >/dev/null || (apt-get update -y && apt-get install -y redis-server); systemctl enable --now redis-server; systemctl is-active redis-server",
    check: "redis-cli -p 6379 ping",
  },
  {
    id: "n8n",
    label: "n8n (أتمتة)",
    port: 5678,
    kind: "automation",
    install:
      "command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sh); docker rm -f n8n 2>/dev/null; docker run -d --name n8n --restart always -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n",
    check: "curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:5678/",
  },
  {
    id: "minio",
    label: "MinIO (تخزين)",
    port: 9000,
    kind: "storage",
    install:
      "command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sh); docker rm -f minio 2>/dev/null; docker run -d --name minio --restart always -p 9000:9000 -p 9001:9001 -v /var/lib/minio:/data minio/minio server /data --console-address ':9001'",
    check: "curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:9000/minio/health/live",
  },
  {
    id: "nginx",
    label: "Nginx (خادم ويب)",
    port: 80,
    kind: "web",
    install: "command -v nginx >/dev/null || (apt-get update -y && apt-get install -y nginx); systemctl enable --now nginx; nginx -t",
    check: "curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1/",
  },
];

/** Known AI runtimes we can auto-discover from open ports. */
export const AI_PORT_MAP: Record<number, { provider: string; kind: "ollama" | "openai"; label: string }> = {
  11434: { provider: "ollama", kind: "ollama", label: "Ollama" },
  1234: { provider: "lmstudio", kind: "openai", label: "LM Studio" },
  8000: { provider: "vllm", kind: "openai", label: "vLLM" },
  8080: { provider: "llamacpp", kind: "openai", label: "llama.cpp" },
};

export function isSafePort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port < 65536;
}

export function isSafeHost(host: string): boolean {
  return /^[a-zA-Z0-9._-]{1,253}$/.test(host);
}

/** Nginx proxy for a sub-path of a domain instead of the whole vhost. */
export function buildPathProxyConf(domain: string, port: number, path: string, websocket: boolean): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    # managed by TVCC — path proxy
    location ${p} {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
${websocket ? '        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n' : ""}        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
`;
}

/** socat-based TCP bridge unit: local port -> remote host:port */
export function buildBridgeUnit(name: string, localPort: number, targetHost: string, targetPort: number): string {
  return `[Unit]
Description=TVCC port bridge ${name}
After=network.target

[Service]
ExecStart=/usr/bin/socat TCP4-LISTEN:${localPort},fork,reuseaddr TCP4:${targetHost}:${targetPort}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;
}
