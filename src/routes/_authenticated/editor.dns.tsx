import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/dns")({
  component: () => (
    <BulkEditor
      title="النطاقات DNS"
      subtitle="إدارة النطاقات وسجلات DNS على المواقع المحددة"
      icon={Globe}
      settingKey="dns"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="نوع العملية">
            <Select value={values.op || "update"} onValueChange={(v) => setVal("op", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="update">تحديث Domain</SelectItem>
                <SelectItem value="subdomain">تغيير Subdomain</SelectItem>
                <SelectItem value="check">فحص DNS</SelectItem>
                <SelectItem value="refresh">تحديث سجلات TVCC</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="النطاق الجديد"><Input dir="ltr" value={values.domain || ""} onChange={(e) => setVal("domain", e.target.value)} placeholder="example.com" /></Field>
          <Field label="Subdomain"><Input dir="ltr" value={values.subdomain || ""} onChange={(e) => setVal("subdomain", e.target.value)} placeholder="shop" /></Field>
          <Field label="نوع السجل">
            <Select value={values.record_type || "A"} onValueChange={(v) => setVal("record_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="AAAA">AAAA</SelectItem>
                <SelectItem value="CNAME">CNAME</SelectItem>
                <SelectItem value="MX">MX</SelectItem>
                <SelectItem value="TXT">TXT</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="قيمة السجل"><Input dir="ltr" value={values.record_value || ""} onChange={(e) => setVal("record_value", e.target.value)} /></Field>
        </div>
      )}
    />
  ),
});
