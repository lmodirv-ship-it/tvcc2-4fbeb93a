# INSTALLATION — TVCC

## 1. Requirements

- Node.js 20 LTS or newer (https://nodejs.org)
- Bun 1.1+ (recommended) or npm 10+ / pnpm 9+
- Git
- A Supabase project (or Lovable Cloud — already linked when exported from Lovable)
- (Optional) Docker if you prefer running Supabase locally

## 2. Clone / extract

```bash
unzip tvcc.zip -d tvcc && cd tvcc
# or
git clone <your-repo-url> tvcc && cd tvcc
```

## 3. Install dependencies

Bun is the official package manager for TVCC (`bun.lock` is the source of truth).

```bash
bun install
```

> If you must use npm, run `npm install --legacy-peer-deps` — TanStack/Nitro/Lovable have strict peer ranges that npm enforces too strictly.

## 4. Configure environment

```bash
cp .env.example .env
```

Fill in the values:

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Same values as the `VITE_*` ones |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` (KEEP SECRET) |
| `SUPABASE_DB_URL` | Supabase Dashboard → Project Settings → Database → Connection string |
| `LOVABLE_API_KEY` | Lovable Cloud → AI Gateway (only if you use AI features) |
| `NOTIFICATIONS_INGEST_SECRET` | Generate: `openssl rand -hex 32` |

## 5. Apply database migrations

If you are starting from a fresh Supabase project, push the migrations in `supabase/migrations/`:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

> Skip this step if your project was created via Lovable Cloud — migrations are already applied.

## 6. Run locally

```bash
bun dev
# → http://localhost:5173
```

## 7. Build for production

```bash
bun run build
# output: .output/
```

## 8. Preview the production build

```bash
bun run start
```

## 9. Verify before deploying

- [ ] `bun run build` exits with code 0
- [ ] You can sign in at `/auth`
- [ ] `/dashboard`, `/websites`, `/notifications`, `/audit`, `/reports` all load
- [ ] The bell in the header shows realtime notifications
- [ ] No browser console errors on the main pages

See `DEPLOYMENT.md` for the VPS + domain + SSL playbook.
