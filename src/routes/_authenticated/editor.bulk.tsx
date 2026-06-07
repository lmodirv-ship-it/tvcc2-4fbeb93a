import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/bulk")({
  component: () => (
    <BulkEditor
      title="Bulk Operations"
      subtitle="أهم صفحة في النظام — نفّذ إجراءً واحداً على 1 أو 10 أو 100 موقع دفعة واحدة"
      icon={Layers}
      settingKey="bulk_operation"
      actionLabel="تنفيذ على المواقع المختارة"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="نوع الإجراء">
            <Select value={values.operation || ""} onValueChange={(v) => setVal("operation", v)}>
              <SelectTrigger><SelectValue placeholder="اختر الإجراء..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restart">إعادة تشغيل المواقع</SelectItem>
                <SelectItem value="clear_cache">مسح الذاكرة المؤقتة</SelectItem>
                <SelectItem value="rebuild">إعادة البناء</SelectItem>
                <SelectItem value="enable">تفعيل المواقع</SelectItem>
                <SelectItem value="disable">إيقاف المواقع</SelectItem>
                <SelectItem value="backup">إنشاء نسخة احتياطية</SelectItem>
                <SelectItem value="update_ssl">تجديد شهادة SSL</SelectItem>
                <SelectItem value="purge_cdn">تفريغ CDN</SelectItem>
                <SelectItem value="custom">أمر مخصص</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="ملاحظة العملية (اختياري)">
            <Textarea rows={3} placeholder="سبب التنفيذ أو ملاحظة للسجل" value={values.note || ""} onChange={(e) => setVal("note", e.target.value)} />
          </Field>
          {values.operation === "custom" && (
            <Field label="الأمر المخصص">
              <Input className="font-mono text-xs" placeholder="bash command" value={values.command || ""} onChange={(e) => setVal("command", e.target.value)} />
            </Field>
          )}
          <div className="flex items-center justify-between rounded border border-warning/40 bg-warning/5 p-3">
            <Switch checked={!!values.confirmed} onCheckedChange={(c) => setVal("confirmed", c)} />
            <Label className="text-xs">أؤكد فهمي بأن هذا الإجراء سيُنفَّذ على كل المواقع المختارة</Label>
          </div>
        </div>
      )}
    />
  ),
});
