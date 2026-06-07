import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/users")({
  component: () => (
    <BulkEditor
      title="إدارة المستخدمين"
      subtitle="إضافة أو حذف أو تعديل صلاحيات المستخدمين على المواقع المحددة"
      icon={Users}
      settingKey="users"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="نوع العملية">
            <Select value={values.op || "add"} onValueChange={(v) => setVal("op", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">إضافة مستخدم</SelectItem>
                <SelectItem value="remove">حذف مستخدم</SelectItem>
                <SelectItem value="role">تغيير الصلاحيات</SelectItem>
                <SelectItem value="suspend">إيقاف الحساب</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="البريد الإلكتروني"><Input dir="ltr" type="email" value={values.email || ""} onChange={(e) => setVal("email", e.target.value)} placeholder="user@example.com" /></Field>
          <Field label="الصلاحية">
            <Select value={values.role || "viewer"} onValueChange={(v) => setVal("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    />
  ),
});
