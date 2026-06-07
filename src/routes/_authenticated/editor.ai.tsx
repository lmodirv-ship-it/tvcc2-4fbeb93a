import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/ai")({
  component: () => (
    <BulkEditor
      title="الذكاء الاصطناعي"
      subtitle="فعّل أو عطّل ميزات الذكاء الاصطناعي على المواقع المحددة"
      icon={Sparkles}
      settingKey="ai"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="Chatbot">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">مساعد دردشة مباشر</span>
              <Switch checked={!!values.chatbot} onCheckedChange={(v) => setVal("chatbot", v)} />
            </div>
          </Field>
          <Field label="AI Search">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">بحث ذكي داخل الموقع</span>
              <Switch checked={!!values.ai_search} onCheckedChange={(v) => setVal("ai_search", v)} />
            </div>
          </Field>
          <Field label="AI Assistant">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">مساعد ذكي للزوار</span>
              <Switch checked={!!values.ai_assistant} onCheckedChange={(v) => setVal("ai_assistant", v)} />
            </div>
          </Field>
          <Field label="AI Recommendations">
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">توصيات منتجات / محتوى</span>
              <Switch checked={!!values.ai_recommendations} onCheckedChange={(v) => setVal("ai_recommendations", v)} />
            </div>
          </Field>
          <Field label="النموذج المستخدم">
            <Select value={values.model || "google/gemini-2.5-flash"} onValueChange={(v) => setVal("model", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="رسالة الترحيب"><Input value={values.welcome || ""} onChange={(e) => setVal("welcome", e.target.value)} placeholder="مرحباً، كيف يمكنني مساعدتك؟" /></Field>
        </div>
      )}
    />
  ),
});
