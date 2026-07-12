import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autoFixAndReport } from "@/lib/health-check.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, Loader2,
  RefreshCw, Rocket, FileWarning, Wrench,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
  head: () => ({ meta: [{ title: "System Audit — TVCC" }] }),
});

type Severity = "ok" | "warn" | "error" | "info";
type Check = {
  id: string;
  category: string;
  title: string;
  severity: Severity;
  detail?: string;
  fixUrl?: string;
  fixLabel?: string;
  icon?: any;
};

function AuditPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["system-audit"],
    queryFn: runAudit,
  });

  const grouped = useMemo(() => {
    const g: Record<string, Check[]> = {};
    (data || []).forEach((c) => {
      g[c.category] = g[c.category] || [];
      g[c.category].push(c);
    });
    return g;
  }, [data]);

  const stats = useMemo(() => {
    const checks = data || [];
    const ok = checks.filter((c) => c.severity === "ok").length;
    const warn = checks.filter((c) => c.severity === "warn").length;
    const err = checks.filter((c) => c.severity === "error").length;
    const total = checks.length || 1;
    // Errors weigh double, warnings half
    const deduction = err * 2 + warn * 0.5;
    const score = Math.max(0, Math.round(((total - deduction) / total) * 100));
    return { ok, warn, err, total: checks.length, score };
  }, [data]);

  const readiness =
    stats.score >= 90 ? { label: "جاهز للنشر", color: "success" } :
    stats.score >= 70 ? { label: "جاهز جزئياً", color: "warning" } :
    stats.score >= 50 ? { label: "يحتاج عمل", color: "warning" } :
    { label: "غير جاهز", color: "destructive" };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" /> فحص النظام
          </h1>
          <p className="text-muted-foreground mt-1">
            تقرير جاهزية النشر — مشاكل الإعداد، البيانات الناقصة، والوظائف التجريبية
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
          {isFetching ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-1" />}
          إعادة الفحص
        </Button>
      </div>

      {/* Readiness Score */}
      <Card className="ring-1 ring-border bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 flex items-center justify-center rounded-full ring-4 ring-primary/20 bg-card">
                <span className="text-3xl font-extrabold text-primary">{stats.score}%</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">جاهزية النشر</p>
                <p className="text-2xl font-bold mt-0.5">
                  <Badge className={
                    readiness.color === "success" ? "bg-success/20 text-success border-success/40 text-base px-3 py-1" :
                    readiness.color === "warning" ? "bg-warning/20 text-warning border-warning/40 text-base px-3 py-1" :
                    "bg-destructive/20 text-destructive border-destructive/40 text-base px-3 py-1"
                  }>
                    <Rocket className="w-4 h-4 ml-1" /> {readiness.label}
                  </Badge>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat icon={CheckCircle2} color="success" value={stats.ok} label="ناجح" />
              <Stat icon={AlertTriangle} color="warning" value={stats.warn} label="تحذير" />
              <Stat icon={XCircle} color="destructive" value={stats.err} label="خطأ" />
            </div>
          </div>
          <Progress value={stats.score} className="h-2" />
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card className="ring-1 ring-border bg-card/60">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">جاري فحص النظام...</p>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(grouped).map(([category, checks]) => (
          <Card key={category} className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-primary" />
                {category}
                <Badge variant="outline" className="text-[10px]">{checks.length}</Badge>
              </h3>
              <div className="space-y-2">
                {checks.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-start gap-3 p-3 rounded-md border ${
                      c.severity === "ok" ? "border-success/20 bg-success/5" :
                      c.severity === "warn" ? "border-warning/20 bg-warning/5" :
                      c.severity === "error" ? "border-destructive/20 bg-destructive/5" :
                      "border-border/40 bg-secondary/30"
                    }`}
                  >
                    <SeverityIcon severity={c.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.title}</p>
                      {c.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>
                      )}
                    </div>
                    {c.fixUrl && (
                      <Button asChild size="sm" variant="ghost" className="text-xs">
                        <Link to={c.fixUrl}>{c.fixLabel || "إصلاح"}</Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, color, value, label }: any) {
  const cls: any = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="px-3">
      <Icon className={`w-5 h-5 mx-auto ${cls[color]}`} />
      <p className="text-xl font-bold mt-1">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "ok") return <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />;
  if (severity === "warn") return <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />;
  if (severity === "error") return <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />;
  return <ClipboardCheck className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />;
}

async function runAudit(): Promise<Check[]> {
  const checks: Check[] = [];
  const sb: any = supabase;

  // ----- WEBSITES -----
  const { data: websites } = await sb.from("websites").select("*");
  const wsList = websites || [];

  checks.push({
    id: "ws-count", category: "المواقع", title: "وجود مواقع مسجلة",
    severity: wsList.length === 0 ? "error" : "ok",
    detail: wsList.length === 0 ? "لا توجد مواقع — أضف موقعاً واحداً على الأقل" : `${wsList.length} موقع مسجل`,
    fixUrl: "/websites", fixLabel: "إدارة",
  });

  const unverified = wsList.filter((w: any) => !w.verified);
  if (wsList.length > 0) {
    checks.push({
      id: "ws-unverified", category: "المواقع", title: "مواقع غير موثّقة DNS",
      severity: unverified.length === 0 ? "ok" : "warn",
      detail: unverified.length === 0 ? "جميع المواقع موثّقة" : `${unverified.length} موقع بحاجة لتوثيق DNS`,
      fixUrl: "/websites", fixLabel: "توثيق",
    });

    const missingDomain = wsList.filter((w: any) => !w.frontend_domain);
    checks.push({
      id: "ws-frontend", category: "المواقع", title: "ربط دومين الواجهة",
      severity: missingDomain.length === 0 ? "ok" : "warn",
      detail: missingDomain.length === 0 ? "كل موقع لديه frontend_domain" : `${missingDomain.length} موقع بدون دومين واجهة`,
    });

    const missingDb = wsList.filter((w: any) => !w.hn_db_connection_id);
    checks.push({
      id: "ws-db-link", category: "المواقع", title: "ربط قاعدة بيانات HN-DB",
      severity: missingDb.length === 0 ? "ok" : "warn",
      detail: `${missingDb.length} موقع بدون hn_db_connection_id`,
    });

    const missingStorage = wsList.filter((w: any) => !w.hn_cloud_storage_id);
    checks.push({
      id: "ws-storage", category: "المواقع", title: "ربط تخزين HN-Cloud",
      severity: missingStorage.length === 0 ? "ok" : "warn",
      detail: `${missingStorage.length} موقع بدون hn_cloud_storage_id`,
    });
  }

  // ----- DOMAINS -----
  const { data: domains } = await sb.from("domains").select("*");
  const dList = domains || [];
  checks.push({
    id: "dom-count", category: "النطاقات", title: "تسجيل النطاقات في Domain Manager",
    severity: dList.length === 0 ? "warn" : "ok",
    detail: dList.length === 0 ? "لم تُسجَّل نطاقات بعد" : `${dList.length} نطاق مسجل`,
    fixUrl: "/domains",
  });

  const now = Date.now();
  const domExpSoon = dList.filter((d: any) => d.expires_at && (new Date(d.expires_at).getTime() - now) / 86400000 < 30);
  if (dList.length > 0) {
    checks.push({
      id: "dom-exp", category: "النطاقات", title: "نطاقات تنتهي خلال 30 يوم",
      severity: domExpSoon.length === 0 ? "ok" : domExpSoon.some((d: any) => (new Date(d.expires_at).getTime() - now) / 86400000 < 7) ? "error" : "warn",
      detail: domExpSoon.length === 0 ? "جميع النطاقات بعيدة عن الانتهاء" : `${domExpSoon.length} نطاق يحتاج تجديداً`,
      fixUrl: "/domains",
    });
  }

  // ----- SSL -----
  const sslExpSoon = dList.filter((d: any) => d.ssl_expires_at && (new Date(d.ssl_expires_at).getTime() - now) / 86400000 < 30);
  const sslExpired = dList.filter((d: any) => d.ssl_expires_at && new Date(d.ssl_expires_at).getTime() < now);
  if (dList.length > 0) {
    checks.push({
      id: "ssl-status", category: "SSL", title: "شهادات SSL منتهية",
      severity: sslExpired.length === 0 ? "ok" : "error",
      detail: `${sslExpired.length} شهادة منتهية`,
      fixUrl: "/ssl",
    });
    checks.push({
      id: "ssl-soon", category: "SSL", title: "شهادات تنتهي خلال 30 يوم",
      severity: sslExpSoon.length === 0 ? "ok" : "warn",
      detail: `${sslExpSoon.length} شهادة قريبة من الانتهاء`,
      fixUrl: "/ssl",
    });
  }

  // ----- BACKUPS / RECOVERY -----
  const { data: recovery } = await sb.from("recovery_points").select("*");
  const rList = recovery || [];
  checks.push({
    id: "rec-count", category: "النسخ الاحتياطية", title: "وجود نقاط استرداد",
    severity: rList.length === 0 ? "error" : rList.length < (wsList.length || 1) ? "warn" : "ok",
    detail: rList.length === 0
      ? "لا توجد نسخ احتياطية — أنشئ نقطة استرداد لكل موقع"
      : `${rList.length} نقطة استرداد لـ ${wsList.length} موقع`,
    fixUrl: "/recovery",
  });

  if (wsList.length > 0) {
    const sitesWithBackup = new Set(rList.map((r: any) => r.website_id));
    const sitesWithoutBackup = wsList.filter((w: any) => !sitesWithBackup.has(w.id));
    checks.push({
      id: "rec-coverage", category: "النسخ الاحتياطية", title: "تغطية المواقع بالنسخ",
      severity: sitesWithoutBackup.length === 0 ? "ok" : "warn",
      detail: `${sitesWithoutBackup.length} موقع بدون نسخ احتياطية`,
      fixUrl: "/recovery",
    });
  }

  // ----- SECRETS / VAULT -----
  const { data: vault } = await sb.from("vault_secrets").select("id,name,category,last_rotated_at,created_at");
  const vList = vault || [];
  checks.push({
    id: "vault-count", category: "الأسرار", title: "خزنة الأسرار مُعدّة",
    severity: vList.length === 0 ? "warn" : "ok",
    detail: vList.length === 0
      ? "لم تُخزَّن مفاتيح API أو كلمات سرّية بعد"
      : `${vList.length} سر محفوظ`,
    fixUrl: "/vault",
  });

  const oldSecrets = vList.filter((v: any) => {
    const ref = v.last_rotated_at || v.created_at;
    return ref && (now - new Date(ref).getTime()) / 86400000 > 90;
  });
  if (vList.length > 0) {
    checks.push({
      id: "vault-rotate", category: "الأسرار", title: "تدوير الأسرار (أكثر من 90 يوم)",
      severity: oldSecrets.length === 0 ? "ok" : "warn",
      detail: `${oldSecrets.length} سر يحتاج تدويراً`,
      fixUrl: "/vault",
    });
  }

  // ----- NOTIFICATIONS -----
  const { data: channels } = await sb.from("notification_channels").select("*");
  const cList = channels || [];
  const activeChannels = cList.filter((c: any) => c.is_active);
  checks.push({
    id: "notif-channels", category: "الإشعارات", title: "قنوات إرسال مفعّلة",
    severity: activeChannels.length === 0 ? "error" : "ok",
    detail: activeChannels.length === 0
      ? "لا توجد قناة إرسال — لن تصلك تنبيهات الأعطال"
      : `${activeChannels.length} قناة فعّالة`,
    fixUrl: "/notifications",
  });

  const { data: critNotifs } = await sb.from("notifications")
    .select("id,severity,is_read")
    .eq("severity", "critical")
    .eq("is_read", false);
  if ((critNotifs?.length || 0) > 0) {
    checks.push({
      id: "notif-unread", category: "الإشعارات", title: "تنبيهات حرجة غير مقروءة",
      severity: "error",
      detail: `${critNotifs!.length} تنبيه حرج بحاجة لمراجعة`,
      fixUrl: "/notifications",
    });
  }

  // ----- ENV VARS -----
  const { data: envs } = await sb.from("website_env_vars").select("website_id,environment");
  const eList = envs || [];
  if (wsList.length > 0) {
    const sitesWithEnv = new Set(eList.map((e: any) => e.website_id));
    const sitesNoEnv = wsList.filter((w: any) => !sitesWithEnv.has(w.id));
    checks.push({
      id: "env-coverage", category: "متغيرات البيئة", title: "تكوين .env للمواقع",
      severity: sitesNoEnv.length === wsList.length ? "warn" : sitesNoEnv.length === 0 ? "ok" : "info",
      detail: sitesNoEnv.length === 0
        ? "كل موقع لديه متغيرات بيئة"
        : `${sitesNoEnv.length} موقع بدون متغيرات بيئة`,
      fixUrl: "/environment",
    });
  }

  // ----- ANDROID -----
  const androidEnabled = wsList.filter((w: any) => w.android_enabled);
  const androidNoApk = androidEnabled.filter((w: any) => !w.android_apk_url);
  if (androidEnabled.length > 0) {
    checks.push({
      id: "apk-missing", category: "تطبيقات Android", title: "APK مرفوع لكل تطبيق مفعّل",
      severity: androidNoApk.length === 0 ? "ok" : "warn",
      detail: androidNoApk.length === 0
        ? `${androidEnabled.length} تطبيق جاهز`
        : `${androidNoApk.length} تطبيق مفعّل بدون APK`,
      fixUrl: "/apk-manager",
    });
  }

  // ----- DATABASES & STORAGE -----
  const { data: dbs } = await sb.from("databases").select("id,status");
  const dbList = dbs || [];
  const dbInactive = dbList.filter((d: any) => d.status !== "active");
  if (dbList.length > 0) {
    checks.push({
      id: "db-status", category: "قواعد البيانات", title: "قواعد بيانات نشطة",
      severity: dbInactive.length === 0 ? "ok" : "warn",
      detail: dbInactive.length === 0 ? `${dbList.length} قاعدة نشطة` : `${dbInactive.length} قاعدة غير نشطة`,
    });
  } else {
    checks.push({
      id: "db-none", category: "قواعد البيانات", title: "تسجيل قواعد بيانات",
      severity: "warn", detail: "لم تُسجَّل قواعد بيانات بعد",
    });
  }

  const { data: storages } = await sb.from("storages").select("id,used_gb,size_gb");
  const stList = storages || [];
  const stFull = stList.filter((s: any) => s.size_gb > 0 && (Number(s.used_gb) / Number(s.size_gb)) > 0.9);
  if (stList.length > 0) {
    checks.push({
      id: "st-full", category: "التخزين", title: "مساحة تخزين كافية",
      severity: stFull.length === 0 ? "ok" : "error",
      detail: stFull.length === 0 ? "لا مخازن ممتلئة" : `${stFull.length} مخزن تجاوز 90%`,
    });
  }

  // ----- HEALTH CHECKS -----
  const { data: health } = await sb.from("site_health_checks")
    .select("website_id,status,checked_at")
    .order("checked_at", { ascending: false })
    .limit(500);
  const hList = health || [];
  if (wsList.length > 0 && hList.length === 0) {
    checks.push({
      id: "health-none", category: "المراقبة", title: "تشغيل فحوصات الصحة",
      severity: "warn",
      detail: "لم تُجرَ فحوصات صحة لأي موقع بعد",
      fixUrl: "/monitoring",
    });
  } else if (hList.length > 0) {
    const latestPerSite = new Map();
    hList.forEach((h: any) => { if (!latestPerSite.has(h.website_id)) latestPerSite.set(h.website_id, h); });
    const down = Array.from(latestPerSite.values()).filter((h: any) => h.status === "down" || h.status === "error");
    checks.push({
      id: "health-down", category: "المراقبة", title: "مواقع متوقفة حالياً",
      severity: down.length === 0 ? "ok" : "error",
      detail: down.length === 0 ? "جميع المواقع تعمل" : `${down.length} موقع متوقف`,
      fixUrl: "/monitoring",
    });
  }

  return checks;
}
