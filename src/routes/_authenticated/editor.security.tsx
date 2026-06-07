import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/editor/security")({
  component: () => (
    <BulkEditor
      title="الأمان"
      subtitle="تطبيق إعدادات الحماية على المواقع المحددة"
      icon={ShieldCheck}
      settingKey="security"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="تفعيل 2FA">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">المصادقة الثنائية للوحة الإدارة</span>
              <Switch checked={!!values.two_fa} onCheckedChange={(v) => setVal("two_fa", v)} />
            </div>
          </Field>
          <Field label="CAPTCHA على النماذج">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">حماية ضد البوتات</span>
              <Switch checked={!!values.captcha} onCheckedChange={(v) => setVal("captcha", v)} />
            </div>
          </Field>
          <Field label="فرض HTTPS">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">إعادة توجيه HTTP → HTTPS</span>
              <Switch checked={!!values.force_https} onCheckedChange={(v) => setVal("force_https", v)} />
            </div>
          </Field>
          <Field label="IPs محظورة (مفصولة بفواصل)"><Input dir="ltr" value={values.blocked_ips || ""} onChange={(e) => setVal("blocked_ips", e.target.value)} placeholder="1.2.3.4, 5.6.7.8" /></Field>
          <Field label="IPs مسموحة"><Input dir="ltr" value={values.allowed_ips || ""} onChange={(e) => setVal("allowed_ips", e.target.value)} placeholder="10.0.0.0/24" /></Field>
        </div>
      )}
    />
  ),
});
