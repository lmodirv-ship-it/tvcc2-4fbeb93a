import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, CheckCircle2, AlertTriangle, XCircle, Clock, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/backups")({
  component: BackupsPage,
  head: () => ({ meta: [{ title: "النسخ الاحتياطية — TVCC" }] }),
});

const stats = [
  { label: "إجمالي النسخ", value: "128", icon: CloudUpload, color: "primary" },
  { label: "النجاح", value: "112", sub: "87.5% من الإجمالي", icon: CheckCircle2, color: "success" },
  { label: "التحذيرات", value: "8", sub: "6.3% من الإجمالي", icon: AlertTriangle, color: "warning" },
  { label: "الفشل", value: "8", sub: "6.3% من الإجمالي", icon: XCircle, color: "destructive" },
  { label: "آخر نسخة ناجحة", value: "منذ 45 دقيقة", sub: "future.com", icon: Clock, color: "primary-glow" },
];

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  primary: { bg: "bg-primary/15", text: "text-primary", ring: "ring-primary/40" },
  success: { bg: "bg-success/15", text: "text-success", ring: "ring-success/40" },
  warning: { bg: "bg-warning/15", text: "text-warning", ring: "ring-warning/40" },
  destructive: { bg: "bg-destructive/15", text: "text-destructive", ring: "ring-destructive/40" },
  "primary-glow": { bg: "bg-primary/10", text: "text-primary-glow", ring: "ring-primary/40" },
};

function BackupsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="text-right">
          <h1 className="text-3xl font-bold flex items-center gap-3 justify-end">
            النسخ الاحتياطي
            <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <CloudUpload className="w-6 h-6 text-white" />
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">إدارة جميع النسخ الاحتياطية للمواقع وقواعد البيانات والملفات</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => {
          const c = colorMap[s.color];
          return (
            <Card key={s.label} className={`relative overflow-hidden ring-1 ${c.ring}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs ${c.text}`}>{s.label}</p>
                    <p className="text-2xl font-bold mt-2">{s.value}</p>
                    {s.sub && <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>}
                  </div>
                  <div className={`w-11 h-11 rounded-full ${c.bg} flex items-center justify-center`}>
                    <s.icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <CloudUpload className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">لا توجد نسخ احتياطية بعد</h3>
          <p className="text-sm text-muted-foreground">
            ابدأ بإنشاء نسخة احتياطية لأحد مواقعك أو قواعد بياناتك. ستظهر السجلات هنا تلقائياً.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button><CloudUpload className="w-4 h-4 ml-1" /> نسخة احتياطية جديدة</Button>
            <Button variant="outline"><Download className="w-4 h-4 ml-1" /> استعادة</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
