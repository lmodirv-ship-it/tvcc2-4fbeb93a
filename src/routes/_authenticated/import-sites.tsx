import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DownloadCloud, Globe, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { bulkImportWebsites } from "@/lib/supabase-import.functions";
import { syncLovableProjects } from "@/lib/lovable-sync.functions";

export const Route = createFileRoute("/_authenticated/import-sites")({
  component: ImportSitesPage,
  head: () => ({
    meta: [
      { title: "استيراد المواقع — TVCC" },
      { name: "description", content: "استيراد جماعي لكل مواقعك إلى المنصة مع منح رقم تعريف ثابت لكل موقع." },
      { property: "og:title", content: "استيراد المواقع — TVCC" },
      { property: "og:description", content: "الصق قائمة نطاقاتك واستوردها دفعة واحدة مع رمز IDXXXXX لكل موقع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Result = {
  ok: boolean;
  total: number;
  imported: number;
  skipped: number;
  codes: string[];
  error?: string;
  errors?: string[];
};

function ImportSitesPage() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [syncing, setSyncing] = useState(false);
  const run = useServerFn(bulkImportWebsites);
  const syncLovableFn = useServerFn(syncLovableProjects);

  const mut = useMutation({
    mutationFn: () => run({ data: { raw } }) as Promise<Result>,
    onSuccess: (r) => {
      setResult(r);
      if (r.error) toast.error(r.error);
      else toast.success(`تم استيراد ${r.imported} موقعاً (تم تجاهل ${r.skipped} مكرراً)`);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاستيراد"),
  });

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await syncLovableFn({ data: { attachToTvcc: true, pushToHnHub: true } });
      if (!r.ok) toast.error(r.errors?.[0] || "فشلت المزامنة");
      else toast.success(`تم استيراد ${r.imported} موقع من Lovable وربط ${r.tvcc?.linked ?? 0} بـ TVCC`);
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ غير معروف");
    } finally {
      setSyncing(false);
    }
  };

  const lines = raw.split(/[\r\n,]+/).filter((l) => l.trim()).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DownloadCloud className="w-6 h-6 text-primary" /> استيراد المواقع
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            الصق كل نطاقاتك (سطر لكل موقع). يقبل الصيغة <code>الاسم | النطاق</code> أو النطاق فقط.
            كل موقع جديد يحصل تلقائياً على رمز <b>IDXXXXX</b>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" disabled={syncing} onClick={runSync}>
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            مزامنة Lovable
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/websites"><Globe className="w-4 h-4" /> المواقع</Link>
          </Button>
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/connect"><Link2 className="w-4 h-4" /> Connect</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">القائمة ({lines} سطر)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            dir="ltr"
            rows={16}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"my-shop | my-shop.lovable.app\nanother-project.lovable.app\nhttps://example.com"}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button disabled={!raw.trim() || mut.isPending} onClick={() => mut.mutate()} className="gap-2">
              <DownloadCloud className="w-4 h-4" />
              {mut.isPending ? "جارٍ الاستيراد…" : "استيراد الآن"}
            </Button>
            <span className="text-xs text-muted-foreground">بدون فحص HTTP — استيراد فقط، والمكرر يُتجاهل.</span>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">النتيجة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">الإجمالي: {result.total}</Badge>
              <Badge className="bg-success/15 text-success">مُضاف: {result.imported}</Badge>
              <Badge variant="outline">متجاهَل (مكرر): {result.skipped}</Badge>
            </div>
            {!!result.codes?.length && (
              <div className="max-h-72 overflow-auto rounded-md border p-3 text-xs font-mono space-y-1" dir="ltr">
                {result.codes.map((c) => <div key={c}>{c}</div>)}
              </div>
            )}
            {!!result.errors?.length && (
              <div className="text-xs text-destructive space-y-1">
                {result.errors.map((e) => <div key={e}>{e}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
