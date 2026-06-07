import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/subscriptions")({
  component: () => (
    <BulkEditor
      title="الاشتراكات"
      subtitle="ترقية أو تخفيض أو تمديد الاشتراكات على المواقع المحددة"
      icon={CreditCard}
      settingKey="subscription"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="العملية">
            <Select value={values.op || "upgrade"} onValueChange={(v) => setVal("op", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upgrade">ترقية الخطة</SelectItem>
                <SelectItem value="downgrade">تخفيض الخطة</SelectItem>
                <SelectItem value="extend">تمديد الاشتراك</SelectItem>
                <SelectItem value="cancel">إيقاف الاشتراك</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="الخطة الجديدة">
            <Select value={values.plan || ""} onValueChange={(v) => setVal("plan", v)}>
              <SelectTrigger><SelectValue placeholder="اختر الخطة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pro">باقة برو</SelectItem>
                <SelectItem value="Business">باقة الأعمال</SelectItem>
                <SelectItem value="Enterprise">باقة احترافية</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="مدة التمديد (شهر)"><Input type="number" value={values.months || ""} onChange={(e) => setVal("months", e.target.value)} placeholder="12" /></Field>
        </div>
      )}
    />
  ),
});
