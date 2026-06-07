import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, FolderOpen, Globe, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
  head: () => ({ meta: [{ title: "المجموعات — TVCC" }] }),
});

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#64748b"];

function GroupsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [linkOpen, setLinkOpen] = useState<any>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ["site_groups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("site_groups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["wgm"],
    queryFn: async () => (await (supabase as any).from("website_group_members").select("*")).data || [],
  });

  const countFor = (gid: string) => members?.filter((m: any) => m.group_id === gid).length || 0;

  const del = async (id: string) => {
    if (!confirm("حذف المجموعة؟")) return;
    const { error } = await (supabase as any).from("site_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["site_groups"] });
    qc.invalidateQueries({ queryKey: ["wgm"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-primary" /> المجموعات
          </h1>
          <p className="text-muted-foreground mt-1">نظّم مواقعك ضمن مجموعات لتطبيق التغييرات دفعة واحدة</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary"><Plus className="w-4 h-4 ml-1" /> مجموعة جديدة</Button>
          </DialogTrigger>
          <GroupDialog
            initial={editing}
            onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["site_groups"] }); }}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
      ) : !groups?.length ? (
        <Card><CardContent className="p-16 text-center text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
          لا توجد مجموعات بعد. أنشئ مجموعتك الأولى لبدء التنظيم.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g: any) => (
            <Card key={g.id} className="ring-1 ring-border hover:ring-primary/40 transition">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between" dir="rtl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${g.color}25`, color: g.color }}>
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-lg">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{g.description || "—"}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Globe className="w-3 h-3" /> {countFor(g.id)}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border/40">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setLinkOpen(g)}>
                    <Settings2 className="w-3.5 h-3.5 ml-1" /> ربط المواقع
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(g); setOpen(true); }}>تعديل</Button>
                  <Button size="sm" variant="ghost" onClick={() => del(g.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {linkOpen && (
        <LinkSitesDialog group={linkOpen} onClose={() => { setLinkOpen(null); qc.invalidateQueries({ queryKey: ["wgm"] }); }} />
      )}
    </div>
  );
}

function GroupDialog({ initial, onDone }: { initial: any; onDone: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [color, setColor] = useState(initial?.color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("غير مصرح"); }
    const payload = { name, description, color, owner_id: user.id };
    const op = initial
      ? (supabase as any).from("site_groups").update(payload).eq("id", initial.id)
      : (supabase as any).from("site_groups").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "تم التحديث" : "تم الإنشاء");
    onDone();
  };

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{initial ? "تعديل مجموعة" : "مجموعة جديدة"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>الاسم</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: المتاجر، الأخبار..." />
        </div>
        <div>
          <Label>الوصف</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>اللون</Label>
          <div className="flex gap-2 mt-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}حفظ</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LinkSitesDialog({ group, onClose }: { group: any; onClose: () => void }) {
  const { data: websites } = useQuery({
    queryKey: ["websites-pick"],
    queryFn: async () => (await supabase.from("websites").select("id,name,domain")).data || [],
  });
  const { data: existing } = useQuery({
    queryKey: ["wgm", group.id],
    queryFn: async () => (await (supabase as any).from("website_group_members").select("website_id").eq("group_id", group.id)).data || [],
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  if (existing && !initialized) {
    setSelected(new Set(existing.map((e: any) => e.website_id)));
    setInitialized(true);
  }

  const toggle = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("غير مصرح");
    await (supabase as any).from("website_group_members").delete().eq("group_id", group.id);
    const rows = Array.from(selected).map((wid) => ({ group_id: group.id, website_id: wid, owner_id: user.id }));
    if (rows.length) {
      const { error } = await (supabase as any).from("website_group_members").insert(rows);
      if (error) return toast.error(error.message);
    }
    toast.success(`تم ربط ${rows.length} موقع`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>ربط المواقع بـ {group.name}</DialogTitle></DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {websites?.length ? websites.map((w: any) => (
            <label key={w.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/40 cursor-pointer">
              <Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggle(w.id)} />
              <div className="flex-1">
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-muted-foreground">{w.domain}</div>
              </div>
            </label>
          )) : <div className="text-center text-muted-foreground py-8">لا توجد مواقع</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save}>حفظ ({selected.size})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
