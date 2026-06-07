# ARCHITECTURE — TVCC

## Stack

- **Framework:** TanStack Start v1 (React 19 + Vite 7, SSR + server functions)
- **Styling:** Tailwind v4 + shadcn/ui, custom Neon Enterprise theme (`src/styles.css`)
- **State / data:** TanStack Query + TanStack Router
- **i18n:** i18next (Arabic default + RTL, French, English)
- **Backend:** Lovable Cloud / Supabase (Postgres + Auth + Realtime + Storage)
- **Auth:** Supabase Auth (email/password + Google OAuth via Lovable broker)

## Folder layout

```
src/
  routes/                    File-based routes (TanStack Router)
    __root.tsx               Root layout, i18n + RTL
    auth.tsx                 Sign in / Sign up + Google
    _authenticated/          All protected pages (gated by managed layout)
      dashboard.tsx
      websites.tsx
      groups.tsx
      templates.tsx
      editor.tsx
      monitoring.tsx
      jobs.tsx
      integrations.tsx
      domains.tsx
      ssl.tsx
      notifications.tsx
      settings.notifications.tsx
      env.tsx
      activity.tsx
      reports.tsx
      audit.tsx
      ...
    api/public/              Public HTTP endpoints (no auth gate)
      notifications.ingest.ts   HN-DB / HN-Cloud → TVCC ingestion
  components/
    layout/                  AppShell, AppSidebar, AppHeader, NotificationBell, LanguageSwitcher
    ui/                      shadcn primitives
  i18n/                      ar.json | fr.json | en.json + index.ts
  integrations/
    supabase/                client.ts, client.server.ts, auth-middleware.ts (auto-generated)
    lovable/                 Lovable broker (Google OAuth)
  lib/                       Helpers + server functions (*.functions.ts)
  styles.css                 Design tokens (oklch, Neon Enterprise)
supabase/migrations/         SQL migrations
```

## Authentication & roles

- `auth.users` (Supabase managed)
- `public.profiles` — mirror of users, auto-populated by `handle_new_user()` trigger
- `public.user_roles` — separate roles table; enum `app_role = admin | moderator | user | system_owner`
- `lmodirv@gmail.com` and `info@hnchat.net` are auto-promoted to `system_owner` and protected from deletion by `protect_system_owner()` trigger
- All policy checks go through the `has_role(uid, role)` SECURITY DEFINER function (no recursive RLS)

Protected routes live under `src/routes/_authenticated/` — the integration-managed layout file enforces sign-in and is `ssr: false`.

## Database (public schema)

| Table | Purpose |
|---|---|
| profiles | User profile mirror |
| user_roles | Role assignments |
| websites | Managed sites (status, android, hn-cloud / hn-db links) |
| site_groups, website_group_members | Group sites |
| site_templates, website_template_links | Templates |
| site_users, site_user_access | Per-site end users |
| website_settings, website_env_vars | Per-site config |
| website_android_releases | APK/AAB versions |
| domains | Domain & SSL tracking |
| databases | HN-DB connections |
| storages | HN-Cloud storage spaces |
| recovery_points | Backups |
| deployment_jobs, deployment_job_targets | Bulk job runner |
| site_health_checks | Monitoring results |
| clients, subscriptions | CRM / billing |
| vault_secrets | Encrypted secret vault |
| **notifications** | In-app alerts (Realtime enabled) |
| **notification_channels** | Email / Telegram / Webhook destinations |
| **notification_preferences** | Per-event delivery preferences per user |
| **notification_logs** | Delivery attempts + provider responses |
| activity_log | Audit trail |

All tables have RLS scoped to `owner_id = auth.uid()` (or read-own for profiles/roles/activity).

## Notification Center

```
                   ┌──────────────────────────────┐
HN-DB    ─────▶    │ /api/public/notifications/   │
HN-Cloud ─────▶    │   ingest  (HMAC-signed)      │
                   └─────────────┬────────────────┘
                                 │ insert
                                 ▼
                       public.notifications
                                 │
                                 │ Realtime
                                 ▼
                   ┌──────────────────────────────┐
                   │  Header bell  +  /notifications│
                   │  +  toast (sonner)            │
                   └──────────────────────────────┘
                                 │
                                 │ fan-out (planned)
                                 ▼
                Email / Telegram / Webhook channels
                (driven by notification_preferences)
```

Severity levels: `info` | `success` | `warning` | `critical`.
Tabs on `/notifications`: All, Unread, Critical, Warning, Info, Success.
Per-event delivery configured at `/settings/notifications`.

## Internationalization

- Default language: Arabic (RTL).
- Switcher in the header persists the choice in `localStorage`.
- `<html lang>` and `<html dir>` updated on language change.
- All sidebar / header / notification strings are translation keys.

## Design system

- `src/styles.css` defines all tokens in `oklch` (Neon Enterprise: dark slate base with neon blue/cyan/purple accents).
- Components MUST use semantic tokens (`bg-card`, `text-foreground`, `border-border`, `text-primary`, etc.). No raw hex colors.
- Utilities `neon-border` and `neon-text` available for emphasized elements.

## Server-side patterns

- App-internal server logic → `createServerFn` (`src/lib/*.functions.ts`).
- External callers (webhooks, cron) → public TanStack routes under `src/routes/api/public/*` with HMAC signature verification.
- Admin DB access → `supabaseAdmin` (`@/integrations/supabase/client.server`) imported inside handler scope only.

## Extensibility

The system is designed so that future project sources can plug in without rewrites:
- Lovable Integration (workspace API)
- GitHub Integration (repo-based deployments)
- ZIP / Local Uploads

All routed through the same `websites` + `deployment_jobs` pipeline.
