import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plug, Database, HardDrive, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: IntegrationsPage,
  head: () => ({ meta: [{ title: "التكاملات — TVCC" }] }),
});

function ServiceCard({
  name, description, icon: Icon, color,
}: { name: string; description: string; icon: any; color: string }) {
  const handleTest = () => toast.info("سيتم تفعيل الاختبار بعد ربط الأسرار في خطوة لاحقة");

  return (
    <Card className="ring-1 ring-border bg-card/60">
      <CardContent className="p-6 space-y-4" dir="rtl">
        <div className="flex items-start justify-between">
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
            غير مهيأ
          </Badge>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <h2 className="text-lg font-bold">{name}</h2>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs">API URL</Label>
            <Input placeholder="https://..." disabled className="mt-1 bg-muted/30" />
          </div>
          <div>
            <Label className="text-xs">API Token</Label>
            <Input type="password" placeholder="••••••••" disabled className="mt-1 bg-muted/30" />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" className="flex-1" onClick={handleTest}>
            اختبار الاتصال
          </Button>
          <Button variant="ghost" size="icon" title="فتح وثائق الخدمة">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
        <span>/</span>
        <Link to="/settings" className="hover:text-foreground">الإعدادات</Link>
        <span>/</span>
        <span className="text-foreground">التكاملات</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Plug className="w-7 h-7 text-primary" /> التكاملات الخارجية
        </h1>
        <p className="text-muted-foreground mt-1">
          ربط TVCC بخدمات قواعد البيانات والتخزين المستقلة
        </p>
      </div>

      <Card className="ring-1 ring-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">معمارية المنصة</p>
            <p className="text-muted-foreground">
              TVCC = مركز قيادة المواقع. إدارة قواعد البيانات تتم في <strong>HN-DB</strong>،
              وإدارة الملفات والتخزين في <strong>HN-Cloud</strong>. كلاهما مشروع مستقل وسيُربط هنا عبر API.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceCard
          name="HN-DB"
          description="مركز إدارة قواعد البيانات"
          icon={Database}
          color="bg-success/15 text-success"
        />
        <ServiceCard
          name="HN-Cloud"
          description="مركز التخزين والملفات والنسخ الاحتياطية"
          icon={HardDrive}
          color="bg-warning/15 text-warning"
        />
      </div>
    </div>
  );
}
