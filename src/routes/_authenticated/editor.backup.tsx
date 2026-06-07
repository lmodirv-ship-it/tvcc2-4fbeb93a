import { createFileRoute } from "@tanstack/react-router";
import { CloudUpload } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/editor/backup")({
  component: () => (
    <BulkEditor
      title="النسخ الاحتياطي"
      subtitle="جدولة وإدارة النسخ الاحتياطي للمواقع المحددة"
      icon={CloudUpload}
      settingKey="backup"
      actionLabel="حفظ إعدادات النسخ"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="تفعيل النسخ التلقائي">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">إنشاء نسخة تلقائية حسب الجدول</span>
              <Switch checked={!!values.enabled} onCheckedChange={(v) => setVal("enabled", v)} />
            </div>
          </Field>
          <Field label="التكرار">
            <Select value={values.frequency || "daily"} onValueChange={(v) => setVal("frequency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">كل ساعة</SelectItem>
                <SelectItem value="daily">يومي</SelectItem>
                <SelectItem value="weekly">أسبوعي</SelectItem>
                <SelectItem value="monthly">شهري</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="عدد النسخ المحفوظة"><Input type="number" value={values.retention || ""} onChange={(e) => setVal("retention", e.target.value)} placeholder="7" /></Field>
          <Field label="إجراء فوري">
            <Select value={values.action || ""} onValueChange={(v) => setVal("action", v)}>
              <SelectTrigger><SelectValue placeholder="لا شيء" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="run_now">تشغيل Backup الآن</SelectItem>
                <SelectItem value="restore_last">استعادة آخر نسخة</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    />
  ),
});
