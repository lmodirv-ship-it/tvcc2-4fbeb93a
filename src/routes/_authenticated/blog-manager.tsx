import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, Pencil, ExternalLink, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/blog-manager")({
  component: BlogAdmin,
  head: () => ({ meta: [{ title: "إدارة المدونة — TVCC" }] }),
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  category: string | null;
  published: boolean;
  published_at: string | null;
};

const empty = { id: "", slug: "", title: "", excerpt: "", content: "", category: "", published: true };

function BlogAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["blog-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("published_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  const edit = (p: Post) => {
    setForm({
      id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt ?? "",
      content: p.content ?? "", category: p.category ?? "", published: p.published,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.slug.trim()) { toast.error("العنوان والرابط مطلوبان"); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      excerpt: form.excerpt || null,
      content: form.content,
      category: form.category || null,
      published: form.published,
      published_at: form.published ? new Date().toISOString() : null,
      author_id: u.user?.id ?? null,
    };
    const res = form.id
      ? await supabase.from("blog_posts").update(payload).eq("id", form.id)
      : await supabase.from("blog_posts").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(form.id ? "تم تحديث المقال" : "تم نشر المقال");
    setOpen(false);
    setForm({ ...empty });
    qc.invalidateQueries({ queryKey: ["blog-admin"] });
    qc.invalidateQueries({ queryKey: ["blog-public"] });
  };

  const togglePublish = async (p: Post) => {
    const { error } = await supabase
      .from("blog_posts")
      .update({ published: !p.published, published_at: !p.published ? new Date().toISOString() : null })
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(!p.published ? "تم النشر" : "تم إخفاء المقال");
    qc.invalidateQueries({ queryKey: ["blog-admin"] });
    qc.invalidateQueries({ queryKey: ["blog-public"] });
  };

  const remove = async (p: Post) => {
    const { error } = await supabase.from("blog_posts").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["blog-admin"] });
    qc.invalidateQueries({ queryKey: ["blog-public"] });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> إدارة المدونة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">أنشئ المقالات وانشرها مباشرة على /blog</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <a href="/blog" target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /> عرض المدونة</a>
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm({ ...empty }); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> مقال جديد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" dir="rtl">
              <DialogHeader><DialogTitle>{form.id ? "تعديل المقال" : "مقال جديد"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="العنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Input placeholder="الرابط (slug) مثال: idarat-almawaqi" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                <Input placeholder="التصنيف" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <Textarea placeholder="المقتطف" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
                <Textarea placeholder="المحتوى (Markdown مبسّط: ## عنوان، - قائمة، **عريض**)" rows={12} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                <div className="flex items-center gap-2">
                  <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
                  <span className="text-sm">منشور</span>
                </div>
                <Button onClick={save} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">المقالات ({data?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (data ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-secondary/30 transition flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">/blog/{p.slug}</div>
              </div>
              {p.category && <Badge variant="secondary">{p.category}</Badge>}
              <Badge variant={p.published ? "default" : "outline"}>{p.published ? "منشور" : "مسودة"}</Badge>
              <Button size="sm" variant="ghost" onClick={() => togglePublish(p)}>{p.published ? "إخفاء" : "نشر"}</Button>
              <Button size="sm" variant="ghost" onClick={() => edit(p)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
