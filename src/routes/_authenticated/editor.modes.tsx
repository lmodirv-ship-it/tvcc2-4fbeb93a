import { createFileRoute } from "@tanstack/react-router";
import { Power } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/editor/modes")({
  component: () => (
    <BulkEditor
      title="أوضاع الموقع"
      subtitle="تبديل أوضاع التشغيل على المواقع المحددة بضغطة واحدة"
      icon={Power}
      settingKey="mode"
      actionLabel="تطبيق الوضع"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="الوضع">
            <Select value={values.mode || ""} onValueChange={(v) => setVal("mode", v)}>
              <SelectTrigger><SelectValue placeholder="اختر الوضع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="live">تشغيل الموقع</SelectItem>
                <SelectItem value="offline">إيقاف الموقع</SelectItem>
                <SelectItem value="maintenance">وضع الصيانة</SelectItem>
                <SelectItem value="staging">وضع الاختبار</SelectItem>
                <SelectItem value="emergency">وضع الطوارئ</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="رسالة معروضة للزوار"><Textarea rows={3} value={values.message || ""} onChange={(e) => setVal("message", e.target.value)} placeholder="نعمل على تحسين الموقع، نعود قريباً." /></Field>
        </div>
      )}
    />
  ),
});
