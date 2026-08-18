import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import tvccLogo from "@/assets/tvcc-logo.asset.json";

type OAuthClient = { name?: string; client_name?: string; redirect_uri?: string };
type AuthorizationDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };

// The `supabase.auth.oauth` namespace is beta; keep a small typed view of it.
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
    approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
    denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  };
}).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>تعذّر تحميل طلب الصلاحية</CardTitle>
          <CardDescription>{String((error as Error)?.message ?? error)}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  ),
});

const SCOPE_LABELS: Record<string, string> = {
  openid: "التعرّف على هويتك",
  email: "مشاركة عنوان بريدك الإلكتروني",
  profile: "مشاركة ملفك الشخصي الأساسي",
};

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "تطبيق خارجي";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error: err } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (err) {
      setBusy(null);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("لم يُرجِع خادم الصلاحيات رابط إعادة توجيه.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background" dir="rtl">
      <Card className="w-full max-w-md" style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader className="text-center">
          <img src={tvccLogo.url} alt="TVCC" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
          <CardTitle className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            ربط {clientName} بحسابك
          </CardTitle>
          <CardDescription>
            سيتمكّن {clientName} من استخدام أدوات TVCC نيابةً عنك أثناء تسجيل دخولك.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {details?.client?.redirect_uri && (
            <div className="rounded-md border border-border/50 bg-secondary/30 p-3">
              <div className="text-xs text-muted-foreground mb-1">عنوان إعادة التوجيه</div>
              <code dir="ltr" className="text-xs break-all">{details.client.redirect_uri}</code>
            </div>
          )}

          {scopes.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-semibold">الصلاحيات المطلوبة</div>
              <ul className="text-sm text-muted-foreground list-disc pr-5 space-y-1">
                {scopes.map((s) => (
                  <li key={s}>{SCOPE_LABELS[s] ?? `صلاحية إضافية: ${s}`}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            هذا لا يتجاوز صلاحيات التطبيق أو سياسات الحماية في قاعدة البيانات — سيرى فقط ما تراه أنت.
          </p>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy !== null} onClick={() => decide(true)}>
              {busy === "approve" && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              الموافقة
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy !== null} onClick={() => decide(false)}>
              {busy === "deny" && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              إلغاء الربط
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
