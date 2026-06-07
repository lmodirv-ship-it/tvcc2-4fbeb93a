import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "الإعدادات — TVCC" }] }),
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
          <SettingsIcon className="w-6 h-6 text-white" />
        </span>
        <div>
          <h1 className="text-3xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground text-sm">إعدادات المنصة والشبكة والربط الموحد</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">إعدادات DNS Zone للربط الموحد</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            لربط أي موقع بشبكة TVCC، أضف أحد السجلات التالية إلى DNS Zone الخاص بالموقع:
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs space-y-1">
            <div><span className="text-primary">Type:</span> CNAME</div>
            <div><span className="text-primary">Host:</span> _tvcc</div>
            <div><span className="text-primary">Value:</span> network.tvcc.ma</div>
          </div>
          <p className="text-center text-xs text-muted-foreground">— أو —</p>
          <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs space-y-1">
            <div><span className="text-primary">Type:</span> TXT</div>
            <div><span className="text-primary">Host:</span> _tvcc</div>
            <div><span className="text-primary">Value:</span> tvcc-network=enabled</div>
          </div>
          <p className="text-xs text-muted-foreground">
            بمجرد اكتشاف السجل، يصبح الموقع متصلاً تلقائياً بكل خدمات TVCC: قواعد البيانات، التخزين، النسخ الاحتياطي، ونظام المستخدمين الموحد.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
