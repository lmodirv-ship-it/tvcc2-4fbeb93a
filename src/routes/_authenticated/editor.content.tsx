import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/content")({
  component: () => (
    <BulkEditor
      title="Content Editor"
      subtitle="أضف إعلاناً، إشعاراً، Banner، Popup، أو رسالة صيانة لكل المواقع المختارة"
      icon={Megaphone}
      settingKey="content"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="النوع">
            <Select value={values.type || ""} onValueChange={(v) => setVal("type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">إعلان</SelectItem>
                <SelectItem value="notification">إشعار</SelectItem>
                <SelectItem value="banner">Banner</SelectItem>
                <SelectItem value="popup">Popup</SelectItem>
                <SelectItem value="maintenance">رسالة صيانة</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="العنوان"><Input value={values.title || ""} onChange={(e) => setVal("title", e.target.value)} /></Field>
          <Field label="النص"><Textarea rows={4} value={values.message || ""} onChange={(e) => setVal("message", e.target.value)} /></Field>
          <Field label="رابط الإجراء"><Input placeholder="https://..." value={values.cta_url || ""} onChange={(e) => setVal("cta_url", e.target.value)} /></Field>
          <Field label="تاريخ البداية"><Input type="date" value={values.start_at || ""} onChange={(e) => setVal("start_at", e.target.value)} /></Field>
          <Field label="تاريخ النهاية"><Input type="date" value={values.end_at || ""} onChange={(e) => setVal("end_at", e.target.value)} /></Field>
          <div className="flex items-center justify-between rounded border border-border/40 p-3">
            <Switch checked={!!values.active} onCheckedChange={(c) => setVal("active", c)} />
            <Label>مفعَّل الآن</Label>
          </div>
        </div>
      )}
    />
  ),
});
