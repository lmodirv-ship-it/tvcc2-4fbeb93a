import { createFileRoute } from "@tanstack/react-router";
import { Database as DbIcon } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/database")({
  component: () => (
    <BulkEditor
      title="Database Editor"
      subtitle="تعديل قاعدة البيانات المرتبطة، إعدادات الاتصال، ومزامنة البيانات"
      icon={DbIcon}
      settingKey="database"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="نوع القاعدة">
            <Select value={values.db_type || "postgres"} onValueChange={(v) => setVal("db_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Host"><Input placeholder="db.example.com" value={values.host || ""} onChange={(e) => setVal("host", e.target.value)} /></Field>
          <Field label="Port"><Input value={values.port || ""} onChange={(e) => setVal("port", e.target.value)} /></Field>
          <Field label="اسم القاعدة"><Input value={values.db_name || ""} onChange={(e) => setVal("db_name", e.target.value)} /></Field>
          <Field label="المستخدم"><Input value={values.db_user || ""} onChange={(e) => setVal("db_user", e.target.value)} /></Field>
          <div className="flex items-center justify-between rounded border border-border/40 p-3">
            <Switch checked={!!values.sync_now} onCheckedChange={(c) => setVal("sync_now", c)} />
            <Label>مزامنة البيانات بعد التطبيق</Label>
          </div>
        </div>
      )}
    />
  ),
});
