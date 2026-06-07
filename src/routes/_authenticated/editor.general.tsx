import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/editor/general")({
  component: () => (
    <BulkEditor
      title="General Editor"
      subtitle="تعديل الإعدادات العامة للموقع: الاسم، الوصف، الشعار، وبيانات التواصل"
      icon={SettingsIcon}
      settingKey="general"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="اسم الموقع"><Input value={values.name || ""} onChange={(e) => setVal("name", e.target.value)} /></Field>
          <Field label="رابط الشعار"><Input placeholder="https://..." value={values.logo_url || ""} onChange={(e) => setVal("logo_url", e.target.value)} /></Field>
          <Field label="وصف الموقع"><Textarea rows={3} value={values.description || ""} onChange={(e) => setVal("description", e.target.value)} /></Field>
          <Field label="اسم الشركة"><Input value={values.company || ""} onChange={(e) => setVal("company", e.target.value)} /></Field>
          <Field label="البريد الإلكتروني"><Input type="email" value={values.email || ""} onChange={(e) => setVal("email", e.target.value)} /></Field>
          <Field label="رقم الهاتف"><Input value={values.phone || ""} onChange={(e) => setVal("phone", e.target.value)} /></Field>
        </div>
      )}
    />
  ),
});
