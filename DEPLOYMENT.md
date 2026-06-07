# DEPLOYMENT — TVCC on a VPS

This guide deploys TVCC to a Linux VPS (Ubuntu 22.04+) behind Nginx with a Let's Encrypt SSL certificate, and keeps it running with PM2.

TVCC is a TanStack Start application — the production build produces a Node-compatible server in `.output/server/index.mjs`.

---

## 1. Prepare the VPS

```bash
ssh root@your-server-ip
apt update && apt upgrade -y
apt install -y curl git nginx ufw
```

Install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2 bun
```

Open the firewall:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## 2. Upload the project

Option A — via Git:
```bash
cd /var/www
git clone <your-repo-url> tvcc
cd tvcc
```

Option B — via ZIP from your machine:
```bash
scp tvcc.zip root@your-server-ip:/var/www/
ssh root@your-server-ip
cd /var/www && unzip tvcc.zip -d tvcc && cd tvcc
```

## 3. Install + build

```bash
bun install
cp .env.example .env
nano .env    # fill in all required values
bun run build
```

## 4. Run with PM2

```bash
pm2 start .output/server/index.mjs --name tvcc --env production
pm2 save
pm2 startup systemd
```

The app now listens on `http://127.0.0.1:3000` by default.

Common PM2 commands:
```bash
pm2 status
pm2 logs tvcc
pm2 restart tvcc
pm2 stop tvcc
```

## 5. Nginx reverse proxy

Create `/etc/nginx/sites-available/tvcc`:

```nginx
server {
    listen 80;
    server_name tvcc.example.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/tvcc /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 6. Point your domain

In your DNS provider, create an `A` record:

```
tvcc.example.com   →   <your-server-ip>
```

Wait for propagation (`dig tvcc.example.com`).

## 7. Issue an SSL certificate

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tvcc.example.com --redirect --agree-tos -m you@example.com
```

Certbot updates the Nginx config and installs a renewal cron automatically.

## 8. Configure the Notification ingest endpoint

The TVCC public endpoint:

```
POST https://tvcc.example.com/api/public/notifications/ingest
Header:  x-tvcc-signature: sha256=<HMAC-SHA256(NOTIFICATIONS_INGEST_SECRET, raw_body)>
Body:    { "owner_id": "...", "type": "database_error", "severity": "critical",
           "title": "...", "message": "..." }
```

Set the same `NOTIFICATIONS_INGEST_SECRET` value in HN-DB and HN-Cloud so they can push events.

## 9. Updating the app

```bash
cd /var/www/tvcc
git pull        # or upload a new ZIP
bun install
bun run build
pm2 restart tvcc
```

## 10. Backups

- Database: rely on Supabase's automatic backups, or run `pg_dump $SUPABASE_DB_URL` on a cron.
- App files: standard VPS snapshot or `rsync` to off-site storage.

## 11. Health check

After deployment, verify:

- [ ] `https://tvcc.example.com` loads and redirects to `/auth` when signed out
- [ ] Sign-in works (email + Google)
- [ ] `/dashboard` renders without console errors
- [ ] `/notifications` shows the bell and updates in realtime
- [ ] `curl -I https://tvcc.example.com` returns 200 with valid TLS
