import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/editor/seo")({
  component: () => (
    <BulkEditor
      title="SEO Editor"
      subtitle="تعديل جماعي لبيانات SEO على موقع واحد أو عدة مواقع"
      icon={Search}
      settingKey="seo"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="Page Title"><Input value={values.title || ""} onChange={(e) => setVal("title", e.target.value)} /></Field>
          <Field label="Meta Description"><Textarea rows={3} value={values.description || ""} onChange={(e) => setVal("description", e.target.value)} /></Field>
          <Field label="Keywords"><Input placeholder="kw1, kw2, kw3" value={values.keywords || ""} onChange={(e) => setVal("keywords", e.target.value)} /></Field>
          <Field label="OG Title"><Input value={values.og_title || ""} onChange={(e) => setVal("og_title", e.target.value)} /></Field>
          <Field label="OG Image URL"><Input placeholder="https://..." value={values.og_image || ""} onChange={(e) => setVal("og_image", e.target.value)} /></Field>
          <Field label="Twitter Card"><Input placeholder="summary_large_image" value={values.twitter_card || ""} onChange={(e) => setVal("twitter_card", e.target.value)} /></Field>
        </div>
      )}
    />
  ),
});
