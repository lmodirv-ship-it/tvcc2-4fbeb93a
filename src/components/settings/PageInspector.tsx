import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Save, Trash2, Plus } from "lucide-react";
import {
  updatePlatformPage,
  addPageLink,
  removePageLink,
  type PlatformPage,
  type PlatformPageLink,
} from "@/lib/platform-pages.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";

export function PageInspector({
  page,
  links,
  open,
  onOpenChange,
  canEdit,
}: {
  page: PlatformPage | null;
  links: PlatformPageLink[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updatePlatformPage);
  const addLink = useServerFn(addPageLink);
  const dropLink = useServerFn(removePageLink);

  const [form, setForm] = useState<Partial<PlatformPage>>({});
  const [linkType, setLinkType] = useState("table");
  const [linkTarget, setLinkTarget] = useState("");

  useEffect(() => {
    if (page) setForm({ ...page });
  }, [page?.id]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-pages"] });

  const save = useMutation({
    mutationFn: async () => {
      if (!page) return;
      await update({ data: { id: page.id, patch: form } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم حفظ الصفحة");
    },
    onError: (e: any) => toast.error(e?.message || "تعذر الحفظ"),
  });

  const createLink = useMutation({
    mutationFn: async () => {
      if (!page || !linkTarget.trim()) return;
      await addLink({ data: { page_id: page.id, link_type: linkType, target_name: linkTarget.trim() } });
    },
    onSuccess: () => {
      setLinkTarget("");
      invalidate();
      toast.success("تمت إضافة الارتباط");
    },
    onError: (e: any) => toast.error(e?.message || "تعذر الربط"),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      await dropLink({ data: { id } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم حذف الارتباط");
    },
  });

  if (!page) return null;
  const pageLinks = links.filter((l) => l.page_id === page.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">{page.code}</Badge>
            {page.name_ar}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="preview" className="mt-4">
          <TabsList>
            <TabsTrigger value="preview">معاينة</TabsTrigger>
            <TabsTrigger value="edit">تعديل</TabsTrigger>
            <TabsTrigger value="links">الارتباطات ({pageLinks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-muted-foreground">{page.route_path}</span>
              <Button variant="outline" size="sm" asChild>
                <a href={page.route_path} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  فتح في تبويب
                </a>
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden bg-background">
              <iframe
                title={page.name_ar}
                src={page.route_path}
                className="w-full h-[60vh]"
                sandbox="allow-same-origin allow-scripts allow-forms"
              />
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="الاسم بالعربية" value={form.name_ar ?? ""} onChange={(v) => setForm((f) => ({ ...f, name_ar: v }))} disabled={!canEdit} />
              <Field label="الاسم بالفرنسية" value={form.name_fr ?? ""} onChange={(v) => setForm((f) => ({ ...f, name_fr: v }))} disabled={!canEdit} />
              <Field label="الاسم بالإنجليزية" value={form.name_en ?? ""} onChange={(v) => setForm((f) => ({ ...f, name_en: v }))} disabled={!canEdit} />
              <Field label="القسم" value={form.section ?? ""} onChange={(v) => setForm((f) => ({ ...f, section: v }))} disabled={!canEdit} />
              <Field label="المسار" value={form.route_path ?? ""} onChange={(v) => setForm((f) => ({ ...f, route_path: v }))} disabled={!canEdit} />
              <Field label="الترتيب" value={String(form.sort_order ?? 0)} onChange={(v) => setForm((f) => ({ ...f, sort_order: Number(v) || 0 }))} disabled={!canEdit} />
              <div className="space-y-2">
                <Label>الدور الأدنى</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.min_role ?? "viewer"}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, min_role: e.target.value as AppRole }))}
                >
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <Field label="الوصف" value={form.description_ar ?? ""} onChange={(v) => setForm((f) => ({ ...f, description_ar: v }))} disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between">
              <Label>مفعّلة</Label>
              <Switch checked={!!form.enabled} disabled={!canEdit} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>ظاهرة في القائمة</Label>
              <Switch checked={!!form.show_in_sidebar} disabled={!canEdit} onCheckedChange={(v) => setForm((f) => ({ ...f, show_in_sidebar: v }))} />
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                  <Save className="w-3.5 h-3.5 ml-1.5" />
                  حفظ
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="links" className="space-y-3 text-sm">
            {canEdit && (
              <div className="flex gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                >
                  <option value="table">جدول بيانات</option>
                  <option value="page">صفحة</option>
                  <option value="service">خدمة</option>
                </select>
                <Input value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} placeholder="اسم الجدول أو الصفحة أو الخدمة" />
                <Button size="sm" onClick={() => createLink.mutate()} disabled={createLink.isPending}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {pageLinks.length === 0 && <p className="text-muted-foreground">لا توجد ارتباطات بعد.</p>}
            {pageLinks.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{l.link_type}</Badge>
                  <span className="font-mono text-xs">{l.target_name}</span>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => deleteLink.mutate(l.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
