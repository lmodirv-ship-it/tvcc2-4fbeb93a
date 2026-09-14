import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Archive, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/pitr")({
  component: PitrPage,
  head: () => ({ meta: [{ title: "النسخ والسفر عبر الزمن — TVCC" }] }),
});

function PitrPage() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <History className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">النسخ والسفر عبر الزمن (PITR)</h1>
          <p className="text-sm text-muted-foreground">استعادة نقطة زمنية وجداول النسخ الاحتياطي لكل قاعدة</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Archive className="w-4 h-4 text-primary" /> جداول النسخ الاحتياطي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">جدولة النسخ الاحتياطي لكل قاعدة وكل موقع مع سيرفر الوجهة وسجل التنفيذ، عبر مركز النسخ الموجود وأمر الوكيل <code dir="ltr">db_sync</code>.</p>
            <Link to="/backups" className="text-sm text-primary hover:underline">مركز النسخ الاحتياطي ←</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><RotateCcw className="w-4 h-4 text-primary" /> استعادة نقطة زمنية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">الاستعادة إلى نقطة زمنية عبر أمر الوكيل <code dir="ltr">pitr_restore</code> على السيرفر المستهدف — تُفعَّل من مركز الاستعادة.</p>
            <Link to="/recovery" className="text-sm text-primary hover:underline">مركز الاستعادة ←</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
