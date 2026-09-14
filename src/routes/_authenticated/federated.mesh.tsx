import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Radio, KeyRound, Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/mesh")({
  component: MeshPage,
  head: () => ({ meta: [{ title: "المزامنة والأمان المركزي — TVCC" }] }),
});

const blocks = [
  { icon: Radio, title: "البث اللحظي", desc: "قنوات Realtime الحالية تبث أحداث المواقع والسيرفرات لحظياً إلى كل الصفحات دون Redis.", to: "/publish-sync", cta: "مركز النشر والمزامنة" },
  { icon: KeyRound, title: "الصلاحيات المركزية", desc: "إدارة مفاتيح الاتصال والأسرار مركزياً من الخزنة المشفّرة، مع حقنها في السيرفرات عبر الوكيل.", to: "/vault", cta: "الخزنة" },
  { icon: Flame, title: "جدار الحماية", desc: "قواعد الجدار الناري لكل سيرفر تُدار من صفحة السيرفر وتُطبَّق عبر أوامر الوكيل المدرجة في القائمة البيضاء.", to: "/servers", cta: "السيرفرات" },
];

function MeshPage() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">المزامنة والأمان المركزي</h1>
          <p className="text-sm text-muted-foreground">بث لحظي، صلاحيات مركزية، وقواعد جدار حماية موحّدة</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {blocks.map((b) => (
          <Card key={b.title}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><b.icon className="w-4 h-4 text-primary" /> {b.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{b.desc}</p>
              <Link to={b.to} className="text-sm text-primary hover:underline">{b.cta} ←</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
