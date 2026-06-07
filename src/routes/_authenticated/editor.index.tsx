import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Settings as SettingsIcon, Search, Palette, Megaphone, Code2,
  Database as DbIcon, HardDrive, Layers, Wand2, ArrowLeft,
  Share2, Sparkles, CloudUpload, Users, CreditCard, ShieldCheck,
  Globe, Power,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/editor/")({
  component: EditorHub,
  head: () => ({ meta: [{ title: "مركز التحرير — TVCC" }] }),
});

type Tool = { to: string; label: string; desc: string; icon: any; tone: "primary" | "success" | "warning" | "destructive" | "info" };

const groups: { title: string; tools: Tool[] }[] = [
  {
    title: "المحتوى والهوية",
    tools: [
      { to: "/editor/general", label: "عام", desc: "الاسم، الشعار، الوصف، بيانات الشركة", icon: SettingsIcon, tone: "primary" },
      { to: "/editor/seo", label: "SEO", desc: "Title · Meta · Open Graph · Twitter", icon: Search, tone: "success" },
      { to: "/editor/design", label: "التصميم", desc: "الألوان، الخطوط، الثيم، الأزرار", icon: Palette, tone: "warning" },
      { to: "/editor/content", label: "الإعلانات والبانرات", desc: "Banner · Popup · شرائط علوية", icon: Megaphone, tone: "primary" },
      { to: "/editor/social", label: "السوشيال ميديا", desc: "FB · IG · TikTok · WhatsApp · YouTube", icon: Share2, tone: "primary" },
    ],
  },
  {
    title: "البنية التقنية",
    tools: [
      { to: "/editor/scripts", label: "السكربتات", desc: "GA · Pixel · GTM · Custom JS", icon: Code2, tone: "destructive" },
      { to: "/editor/ai", label: "الذكاء الاصطناعي", desc: "Chatbot · AI Search · توصيات", icon: Sparkles, tone: "primary" },
      { to: "/editor/database", label: "قواعد البيانات", desc: "اتصال، مزامنة، نقل قاعدة", icon: DbIcon, tone: "success" },
      { to: "/editor/storage", label: "التخزين والملفات", desc: "Storage Provider · Region · مزامنة", icon: HardDrive, tone: "warning" },
      { to: "/editor/backup", label: "النسخ الاحتياطي", desc: "تشغيل، جدولة، استعادة Backup", icon: CloudUpload, tone: "primary" },
    ],
  },
  {
    title: "الإدارة والأمان",
    tools: [
      { to: "/editor/users", label: "المستخدمون", desc: "إضافة، حذف، صلاحيات، إيقاف", icon: Users, tone: "primary" },
      { to: "/editor/subscriptions", label: "الاشتراكات", desc: "ترقية، تخفيض، تمديد، إيقاف", icon: CreditCard, tone: "success" },
      { to: "/editor/security", label: "الأمان", desc: "2FA · CAPTCHA · IP · HTTPS", icon: ShieldCheck, tone: "destructive" },
      { to: "/editor/dns", label: "النطاقات DNS", desc: "Domain · Subdomain · سجلات DNS", icon: Globe, tone: "primary" },
      { to: "/editor/modes", label: "أوضاع الموقع", desc: "تشغيل · إيقاف · صيانة · طوارئ", icon: Power, tone: "warning" },
      { to: "/editor/bulk", label: "العمليات الجماعية", desc: "تنفيذ إجراءات على 1 أو 100 موقع", icon: Layers, tone: "primary" },
    ],
  },
];

const toneMap: Record<string, { ring: string; text: string; bg: string }> = {
  primary: { ring: "ring-primary/40", text: "text-primary", bg: "bg-primary/15" },
  success: { ring: "ring-success/40", text: "text-success", bg: "bg-success/15" },
  warning: { ring: "ring-warning/40", text: "text-warning", bg: "bg-warning/15" },
  destructive: { ring: "ring-destructive/40", text: "text-destructive", bg: "bg-destructive/15" },
};

function EditorHub() {
  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
          <span>/</span>
          <span className="text-foreground">مركز التحرير</span>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <h1 className="text-3xl font-bold">مركز التحرير (Editor Center)</h1>
            <Wand2 className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">نظام تحكم مركزي — 16 أداة لإدارة عشرات المواقع من مكان واحد</p>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground text-right border-r-2 border-primary pr-3">{g.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {g.tools.map((t) => {
              const c = toneMap[t.tone];
              return (
                <Link key={t.to} to={t.to} className="group">
                  <Card className={`relative overflow-hidden ring-1 ${c.ring} bg-card/60 backdrop-blur transition hover:bg-card hover:-translate-y-0.5 h-full`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                          <t.icon className={`w-5 h-5 ${c.text}`} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{t.label}</div>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{t.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
