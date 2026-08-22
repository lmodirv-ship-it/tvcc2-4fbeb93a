import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Terminal, Copy, HardDrive, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { listServers, getAgentInstall } from "@/lib/servers.functions";
import { exportDashboardHtml } from "@/lib/html-export";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({
    meta: [
      { title: "مركز التحميل — TVCC" },
      { name: "description", content: "تحميل وكيل السيرفر والأدلة والنسخ المحلية لمنصة TVCC." },
      { property: "og:title", content: "مركز التحميل — TVCC" },
      { property: "og:description", content: "وكيل السيرفر، الأدلة التقنية، والنسخ المحلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadsPage,
});

// Documentation bundled at build time so downloads work on the edge runtime.
const DOCS = import.meta.glob("/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const DOC_LABELS: Record<string, string> = {
  "README.md": "دليل المشروع العام",
  "INSTALLATION.md": "دليل التثبيت",
  "SETUP_GUIDE_AR.md": "دليل الإعداد بالعربية",
  "DEPLOYMENT.md": "دليل النشر",
  "ARCHITECTURE.md": "البنية التقنية",
  "ANDROID_STUDIO_AR.md": "نسخة أندرويد (Android Studio)",
  "DESKTOP_APP_AR.md": "نسخة الحاسوب (Desktop / PWA)",
  "PROJECT_STATUS_AR.md": "سجل حالة المنصة",
  "ROADMAP_AR.md": "خطة التطوير",
  "FINAL_REPORT.md": "التقرير النهائي",
};

function saveFile(name: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`تم تنزيل ${name}`);
}

function DownloadsPage() {
  const fetchServers = useServerFn(listServers);
  const fetchInstall = useServerFn(getAgentInstall);
  const [serverId, setServerId] = useState<string>("");
  const [install, setInstall] = useState<{ command: string; scriptUrl: string; script?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: servers = [] } = useQuery({
    queryKey: ["downloads", "servers"],
    queryFn: () => fetchServers({}) as Promise<any[]>,
  });

  const buildInstall = async () => {
    if (!serverId) return toast.error("اختر سيرفراً أولاً");
    setLoading(true);
    try {
      const res: any = await fetchInstall({ data: { serverId } });
      setInstall({ command: res.install ?? res.command, scriptUrl: res.scriptUrl ?? "", script: res.script });
      toast.success("تم توليد أمر التثبيت");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر توليد الأمر");
    } finally {
      setLoading(false);
    }
  };

  const docEntries = Object.entries(DOCS)
    .map(([path, content]) => ({ name: path.replace(/^\//, ""), content }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Download className="h-6 w-6 text-primary" /> مركز التحميل
        </h1>
        <p className="text-sm text-muted-foreground">
          وكيل السيرفر، الأدلة التقنية، ونسخ المنصة المحلية — كل ما تحتاجه للتشغيل خارج المتصفح.
        </p>
      </header>

      <Tabs defaultValue="agent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agent">وكيل السيرفر</TabsTrigger>
          <TabsTrigger value="docs">الأدلة</TabsTrigger>
          <TabsTrigger value="apps">النسخ المحلية</TabsTrigger>
        </TabsList>

        <TabsContent value="agent">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" /> سكربت الوكيل (tvcc-agent)
              </CardTitle>
              <CardDescription>
                اختر السيرفر لتوليد أمر تثبيت موقّع خاص به، ثم نفّذه على السيرفر بصلاحيات root.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger className="w-72"><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.ip_address ? `— ${s.ip_address}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={buildInstall} disabled={loading}>
                  {loading ? "جارٍ التوليد..." : "توليد أمر التثبيت"}
                </Button>
              </div>

              {install && (
                <div className="space-y-3">
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs" dir="ltr">
                    {install.command}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(install.command);
                        toast.success("تم نسخ الأمر");
                      }}
                    >
                      <Copy className="me-2 h-4 w-4" /> نسخ الأمر
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        saveFile("tvcc-agent-install.sh", `#!/usr/bin/env bash\nset -e\n${install.command}\n`, "text/x-shellscript")
                      }
                    >
                      <Download className="me-2 h-4 w-4" /> تنزيل ملف التثبيت
                    </Button>
                    {install.scriptUrl && (
                      <Button variant="ghost" asChild>
                        <a href={install.scriptUrl} target="_blank" rel="noreferrer">فتح السكربت الكامل</a>
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    التوكن داخل الأمر سرّي وخاص بهذا السيرفر — لا تشاركه.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> الأدلة والتقارير</CardTitle>
              <CardDescription>ملفات Markdown جاهزة للتنزيل والقراءة دون اتصال.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              {docEntries.map((d) => (
                <div key={d.name} className="flex items-center justify-between rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{DOC_LABELS[d.name] ?? d.name}</div>
                    <div className="truncate text-xs text-muted-foreground" dir="ltr">{d.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{Math.max(1, Math.round(d.content.length / 1024))} KB</Badge>
                    <Button size="sm" variant="outline" onClick={() => saveFile(d.name, d.content, "text/markdown;charset=utf-8")}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apps">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> نسخة الحاسوب / PWA</CardTitle>
                <CardDescription>ثبّت المنصة كتطبيق سطح مكتب من المتصفح، أو اتبع دليل Tauri.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => saveFile("DESKTOP_APP_AR.md", DOCS["/DESKTOP_APP_AR.md"] ?? "", "text/markdown;charset=utf-8")}
                >
                  <Download className="me-2 h-4 w-4" /> دليل نسخة الحاسوب
                </Button>
                <p className="text-xs text-muted-foreground">
                  في Chrome/Edge: القائمة ← «تثبيت التطبيق» لإنشاء نسخة سطح مكتب فوراً.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> نسخة أندرويد</CardTitle>
                <CardDescription>خطوات توليد APK عبر Android Studio.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => saveFile("ANDROID_STUDIO_AR.md", DOCS["/ANDROID_STUDIO_AR.md"] ?? "", "text/markdown;charset=utf-8")}
                >
                  <Download className="me-2 h-4 w-4" /> دليل أندرويد
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> تصدير لوحة التحكم</CardTitle>
                <CardDescription>نسخة HTML ثابتة من حالة اللوحة الحالية.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => exportDashboardHtml()}>
                  <Download className="me-2 h-4 w-4" /> تنزيل HTML
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
