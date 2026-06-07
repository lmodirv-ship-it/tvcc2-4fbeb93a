import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Settings as SettingsIcon, Search, Palette, Megaphone, Code2,
  Database as DbIcon, HardDrive, Layers, Wand2, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/editor/")({
  component: EditorHub,
  head: () => ({ meta: [{ title: "مركز التحرير — TVCC" }] }),
});

const tools = [
  { to: "/editor/general", label: "General Editor", desc: "الاسم، الشعار، الوصف، بيانات الشركة", icon: SettingsIcon, tone: "primary" },
  { to: "/editor/seo", label: "SEO Editor", desc: "Title · Meta · Open Graph · Twitter", icon: Search, tone: "success" },
  { to: "/editor/design", label: "Design Editor", desc: "الألوان، الخطوط، الثيم، الأزرار", icon: Palette, tone: "warning" },
  { to: "/editor/content", label: "Content Editor", desc: "إعلان · إشعار · Banner · Popup", icon: Megaphone, tone: "primary" },
  { to: "/editor/scripts", label: "Script Manager", desc: "GA · Pixel · GTM · Custom JS", icon: Code2, tone: "destructive" },
  { to: "/editor/database", label: "Database Editor", desc: "اتصال، مزامنة، تغيير قاعدة البيانات", icon: DbIcon, tone: "success" },
  { to: "/editor/storage", label: "Storage Editor", desc: "Storage Provider · Region · مزامنة", icon: HardDrive, tone: "warning" },
  { to: "/editor/bulk", label: "Bulk Operations", desc: "تنفيذ إجراءات على 1 أو 100 موقع دفعة", icon: Layers, tone: "primary" },
] as const;

const toneMap: Record<string, { ring: string; text: string; bg: string }> = {
  primary: { ring: "ring-primary/40", text: "text-primary", bg: "bg-primary/15" },
  success: { ring: "ring-success/40", text: "text-success", bg: "bg-success/15" },
  warning: { ring: "ring-warning/40", text: "text-warning", bg: "bg-warning/15" },
  destructive: { ring: "ring-destructive/40", text: "text-destructive", bg: "bg-destructive/15" },
};

function EditorHub() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
          <span>/</span>
          <span className="text-foreground">مركز التحرير</span>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <h1 className="text-3xl font-bold">مركز التحرير</h1>
            <Wand2 className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">نظام تحكم مركزي — أدِر عشرات المواقع من مكان واحد</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map((t) => {
          const c = toneMap[t.tone];
          return (
            <Link key={t.to} to={t.to} className="group">
              <Card className={`relative overflow-hidden ring-1 ${c.ring} bg-card/60 backdrop-blur transition hover:bg-card hover:-translate-y-0.5`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                    <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center`}>
                      <t.icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">{t.label}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
