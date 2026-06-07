import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Save, X, Pencil, Bell, Globe, Shield, Mail } from "lucide-react";

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

          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-warning" />
              <h3 className="text-sm font-semibold text-warning">ملاحظة عند نقل الموقع إلى استضافة جديدة</h3>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pr-5">
              <li>عند تغيير الاستضافة، عادةً يتم تحديث سجلات <span className="font-mono text-foreground">A</span> و <span className="font-mono text-foreground">NS</span> فقط — وليس سجل <span className="font-mono text-foreground">_tvcc</span>.</li>
              <li>إذا انتقلت إلى مزود DNS مختلف (Cloudflare، Route53…)، يجب إعادة إضافة سجل <span className="font-mono text-foreground">_tvcc</span> في DNS Zone الجديد بنفس القيم أعلاه.</li>
              <li>بعد التغيير، اضغط زر <span className="text-foreground font-medium">"تحقق"</span> في صفحة المواقع لإعادة التأكد من الاتصال.</li>
              <li>سجل <span className="font-mono text-foreground">_tvcc</span> مستقل عن عنوان IP الخاص بالاستضافة، لذا يبقى صالحاً حتى لو تغير الـ IP.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
