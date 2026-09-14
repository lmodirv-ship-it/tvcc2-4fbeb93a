import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, HardDrive, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/assets")({
  component: AssetsPage,
  head: () => ({ meta: [{ title: "الأصول المركزية — TVCC" }] }),
});

function AssetsPage() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Package className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">الأصول المركزية</h1>
          <p className="text-sm text-muted-foreground">مستودع وسائط موحّد وتحكم بالتخزين المؤقت</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HardDrive className="w-4 h-4 text-primary" /> مستودع الوسائط</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">التخزينات والحصص والمزامنة بين السيرفرات تُدار من مركز التخزين مع سجل الأحداث.</p>
            <Link to="/connect" className="text-sm text-primary hover:underline">مركز الربط والتخزين ←</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gauge className="w-4 h-4 text-primary" /> التخزين المؤقت</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">سياسات الكاش لكل موقع تُحقن في إعدادات Nginx عبر الوكيل من صفحة «قواعد البيانات / الوكيل».</p>
            <Link to="/federated/agents" className="text-sm text-primary hover:underline">صفحة الوكيل ←</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
