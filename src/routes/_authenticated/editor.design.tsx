import { createFileRoute } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { BulkEditor, Field, ColorField } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/design")({
  component: () => (
    <BulkEditor
      title="Design Editor"
      subtitle="غيّر الألوان، الخطوط، الثيم، الأزرار، الهيدر والفوتر لكل المواقع المحددة"
      icon={Palette}
      settingKey="design"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <ColorField label="Primary" value={values.primary || ""} onChange={(v) => setVal("primary", v)} />
          <ColorField label="Secondary" value={values.secondary || ""} onChange={(v) => setVal("secondary", v)} />
          <ColorField label="Background" value={values.background || ""} onChange={(v) => setVal("background", v)} />
          <Field label="Font Family"><Input placeholder="Inter, system-ui" value={values.font || ""} onChange={(e) => setVal("font", e.target.value)} /></Field>
          <Field label="الثيم">
            <Select value={values.theme || ""} onValueChange={(v) => setVal("theme", v)}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">فاتح</SelectItem>
                <SelectItem value="dark">داكن</SelectItem>
                <SelectItem value="auto">تلقائي</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="شكل الأزرار">
            <Select value={values.button_radius || ""} onValueChange={(v) => setVal("button_radius", v)}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">حادّة</SelectItem>
                <SelectItem value="8">مدوّرة</SelectItem>
                <SelectItem value="999">دائرية</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    />
  ),
});
