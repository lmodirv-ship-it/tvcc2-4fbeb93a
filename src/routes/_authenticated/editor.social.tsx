import { createFileRoute } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/editor/social")({
  component: () => (
    <BulkEditor
      title="السوشيال ميديا"
      subtitle="حدّث روابط الشبكات الاجتماعية على جميع المواقع دفعة واحدة"
      icon={Share2}
      settingKey="social"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="Facebook URL"><Input dir="ltr" placeholder="https://facebook.com/..." value={values.facebook || ""} onChange={(e) => setVal("facebook", e.target.value)} /></Field>
          <Field label="Instagram URL"><Input dir="ltr" placeholder="https://instagram.com/..." value={values.instagram || ""} onChange={(e) => setVal("instagram", e.target.value)} /></Field>
          <Field label="TikTok URL"><Input dir="ltr" placeholder="https://tiktok.com/@..." value={values.tiktok || ""} onChange={(e) => setVal("tiktok", e.target.value)} /></Field>
          <Field label="WhatsApp"><Input dir="ltr" placeholder="+212600000000" value={values.whatsapp || ""} onChange={(e) => setVal("whatsapp", e.target.value)} /></Field>
          <Field label="Telegram"><Input dir="ltr" placeholder="https://t.me/..." value={values.telegram || ""} onChange={(e) => setVal("telegram", e.target.value)} /></Field>
          <Field label="YouTube"><Input dir="ltr" placeholder="https://youtube.com/@..." value={values.youtube || ""} onChange={(e) => setVal("youtube", e.target.value)} /></Field>
          <Field label="LinkedIn"><Input dir="ltr" placeholder="https://linkedin.com/company/..." value={values.linkedin || ""} onChange={(e) => setVal("linkedin", e.target.value)} /></Field>
          <Field label="X / Twitter"><Input dir="ltr" placeholder="https://x.com/..." value={values.twitter || ""} onChange={(e) => setVal("twitter", e.target.value)} /></Field>
        </div>
      )}
    />
  ),
});
