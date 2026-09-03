import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Palette, RotateCcw, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { saveDesignIdentity } from "@/lib/design.functions";
import {
  FONT_OPTIONS,
  PRESETS,
  RADIUS_OPTIONS,
  SHADOW_OPTIONS,
  applyDesignTokens,
  cacheDesignTokens,
  type DesignTokens,
} from "@/lib/design-studio";
import { THEMES } from "@/lib/themes";

const EMPTY: DesignTokens = {
  theme_id: "neon",
  primary_color: "#4c8dff",
  accent_color: "#8b5cf6",
  background_color: "",
  font_family: "Cairo",
  radius: "0.5rem",
  shadow: SHADOW_OPTIONS[2]!.value,
};

export function DesignStudio() {
  const [tokens, setTokens] = useState<DesignTokens>(EMPTY);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveDesignIdentity);

  const { data, isLoading } = useQuery({
    queryKey: ["brand_design"],
    queryFn: async () =>
      (await (supabase as any).from("brand_settings").select("*").maybeSingle()).data as DesignTokens | null,
  });

  useEffect(() => {
    if (data) setTokens({ ...EMPTY, ...data });
  }, [data]);

  const patch = (p: Partial<DesignTokens>) => {
    const next = { ...tokens, ...p };
    setTokens(next);
    applyDesignTokens(next);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ data: tokens });
      cacheDesignTokens(tokens);
      applyDesignTokens(tokens);
      toast.success("تم حفظ هوية التصميم وتطبيقها على كامل المنصة");
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setTokens(EMPTY);
    applyDesignTokens(EMPTY);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" /> استوديو التصميم
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="me-1 h-3.5 w-3.5" /> استرجاع
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <Save className="me-1 h-3.5 w-3.5" />}
              حفظ وتطبيق عام
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">قوالب جاهزة</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => patch(p.tokens)}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs hover:border-primary"
                >
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  {p.name}
                  <span className="flex gap-1">
                    <span className="h-3 w-3 rounded-full" style={{ background: p.tokens.primary_color! }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: p.tokens.accent_color! }} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="اللون الأساسي" value={tokens.primary_color || ""} onChange={(v) => patch({ primary_color: v })} />
            <ColorField label="اللون الثانوي" value={tokens.accent_color || ""} onChange={(v) => patch({ accent_color: v })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">الخط</Label>
              <Select value={tokens.font_family || "Cairo"} onValueChange={(v) => patch({ font_family: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">الاستدارة</Label>
              <Select value={tokens.radius || "0.5rem"} onValueChange={(v) => patch({ radius: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">الظل</Label>
              <Select value={tokens.shadow || "none"} onValueChange={(v) => patch({ shadow: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHADOW_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">الثيم الافتراضي للمنصة</Label>
            <Select value={tokens.theme_id || "neon"} onValueChange={(v) => patch({ theme_id: v })}>
              <SelectTrigger className="sm:w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">معاينة حيّة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="font-semibold">بطاقة لوحة التحكم</span>
              <Badge>نشط</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">هكذا ستظهر البطاقات والأزرار في كل صفحات المنصة.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm">إجراء أساسي</Button>
              <Button size="sm" variant="outline">ثانوي</Button>
            </div>
          </div>
          <div className="h-16 rounded-xl" style={{ background: "var(--gradient-primary)" }} />
        </CardContent>
      </Card>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="mb-2 block text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#4c8dff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border/60 bg-transparent"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#4c8dff" className="font-mono text-xs" />
      </div>
    </div>
  );
}
