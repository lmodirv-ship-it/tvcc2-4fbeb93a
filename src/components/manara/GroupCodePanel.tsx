import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Link2, Radio, Search, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

/**
 * المعرّف العام لمنارة: أي موقع يحمل نفس الرمز يصبح متصلاً بباقي المواقع
 * الحاملة له عبر منارة (اكتشاف العناوين والتوجيه المشترك).
 */
export function GroupCodePanel() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: sites, isLoading } = useQuery({
    queryKey: ["manara-group-sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("websites")
        .select("id, name, domain, site_code, manara_code")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 300_000,
  });

  const groups = useMemo(() => {
    const m: Record<string, number> = {};
    (sites || []).forEach((s) => {
      const c = (s.manara_code || "").trim();
      if (c) m[c] = (m[c] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [sites]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = sites || [];
    if (!t) return base.slice(0, 40);
    return base
      .filter(
        (s) =>
          String(s.name || "").toLowerCase().includes(t) ||
          String(s.domain || "").toLowerCase().includes(t) ||
          String(s.site_code || "").toLowerCase().includes(t),
      )
      .slice(0, 40);
  }, [sites, q]);

  const apply = async (value: string | null) => {
    const ids = Array.from(picked);
    if (!ids.length) return toast.error("اختر موقعاً واحداً على الأقل");
    if (value !== null && !value.trim()) return toast.error("أدخل المعرّف العام");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("websites")
        .update({ manara_code: value ? value.trim() : null } as any)
        .in("id", ids);
      if (error) throw error;
      toast.success(value ? `تم ربط ${ids.length} موقع بالمعرّف ${value.trim()}` : `تم فك ارتباط ${ids.length} موقع`);
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["manara-group-sites"] });
      qc.invalidateQueries({ queryKey: ["websites"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => {
    const ns = new Set(picked);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setPicked(ns);
  };

  return (
    <section className="glass-card rounded-2xl p-4" dir="rtl">
      <div className="flex items-center gap-2 mb-1">
        <Radio className="w-4 h-4 text-primary" />
        <h2 className="font-bold text-sm">المعرّف العام للربط عبر منارة</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        أضف رمزاً عاماً واحداً لأي مجموعة مواقع؛ كل موقع يحمل نفس الرمز يتصل تلقائياً بمنارة وبباقي المواقع المرتبطة به.
      </p>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {groups.map(([g, n]) => (
            <button key={g} type="button" onClick={() => setCode(g)}>
              <Badge variant="outline" className="border-primary/40 text-primary gap-1 font-mono">
                <Link2 className="w-3 h-3" /> {g} · {n}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="المعرّف العام مثل HN-GROUPE"
          className="max-w-xs font-mono"
          dir="ltr"
        />
        <Button onClick={() => apply(code)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Link2 className="w-4 h-4 ml-1" />}
          ربط المحدد ({picked.size})
        </Button>
        <Button variant="outline" onClick={() => apply(null)} disabled={saving}>
          <Unlink className="w-4 h-4 ml-1" /> فك الارتباط
        </Button>
      </div>

      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute top-2.5 right-3 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن موقع…" className="pr-9" />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1">
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            <Loader2 className="w-4 h-4 animate-spin inline" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">لا توجد نتائج</div>
        ) : (
          filtered.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-background/40 border border-border/50 cursor-pointer"
            >
              <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {s.site_code || "—"}
              </span>
              <span className="text-xs font-medium flex-1 truncate">{s.name}</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[35%]" dir="ltr">{s.domain}</span>
              {s.manara_code && (
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                  {s.manara_code}
                </Badge>
              )}
            </label>
          ))
        )}
      </div>
    </section>
  );
}
