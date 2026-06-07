import { createFileRoute } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/scripts")({
  component: () => (
    <BulkEditor
      title="Script Manager"
      subtitle="أضِف أو أزل سكربتات التتبع على جميع المواقع دفعة واحدة"
      icon={Code2}
      settingKey="scripts"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="موقع الإدراج">
            <Select value={values.placement || "head"} onValueChange={(v) => setVal("placement", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="head">Head</SelectItem>
                <SelectItem value="footer">Footer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Google Analytics (G-XXX)"><Input value={values.ga_id || ""} onChange={(e) => setVal("ga_id", e.target.value)} /></Field>
          <Field label="Google Tag Manager (GTM-XXX)"><Input value={values.gtm_id || ""} onChange={(e) => setVal("gtm_id", e.target.value)} /></Field>
          <Field label="Facebook Pixel ID"><Input value={values.fb_pixel || ""} onChange={(e) => setVal("fb_pixel", e.target.value)} /></Field>
          <Field label="TikTok Pixel ID"><Input value={values.tt_pixel || ""} onChange={(e) => setVal("tt_pixel", e.target.value)} /></Field>
          <Field label="Custom JavaScript">
            <Textarea rows={6} className="font-mono text-xs" placeholder="<script>...</script>" value={values.custom_js || ""} onChange={(e) => setVal("custom_js", e.target.value)} />
          </Field>
        </div>
      )}
    />
  ),
});
