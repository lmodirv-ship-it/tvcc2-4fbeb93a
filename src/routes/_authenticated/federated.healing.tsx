import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartPulse, ScrollText, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/healing")({
  component: HealingPage,
  head: () => ({ meta: [{ title: "الشفاء الذاتي والسجلات — TVCC" }] }),
});

function HealingPage() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <HeartPulse className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">الشفاء الذاتي والسجلات</h1>
          <p className="text-sm text-muted-foreground">سجلات تدقيق مركزية وبروتوكولات إعادة تشغيل آلي</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScrollText className="w-4 h-4 text-primary" /> سجل التدقيق المركزي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">كل عملية (أمر وكيل، تعديل إعداد، نشر قالب) مسجّلة في سجل العمليات مع المنفِّذ والنتيجة.</p>
            <Link to="/logs" className="text-sm text-primary hover:underline">مركز السجلات ←</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="w-4 h-4 text-primary" /> بروتوكولات الشفاء الذاتي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">قواعد تلقائية: عند توقف خدمة أو امتلاء قرص يُنفَّذ إجراء إعادة التشغيل ويُرسل تنبيه — تُدار من أتمتة السيرفرات.</p>
            <Link to="/automation" className="text-sm text-primary hover:underline">الأتمتة ←</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
