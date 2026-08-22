import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zipSync } from "fflate";
import {
  UploadCloud, Server, FolderUp, Rocket, Terminal, RefreshCw, Trash2, Download, ExternalLink, Copy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listServers } from "@/lib/servers.functions";
import {
  createTransfer, startTransfer, syncTransfer, deleteTransfer, generatePowerShell,
} from "@/lib/transfer.functions";

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  uploading: "جارٍ الرفع",
  deploying: "جارٍ النشر على السيرفر",
  dry_run: "محاكاة",
  running: "يعمل ✓",
  unhealthy: "منشور — لا استجابة على المنفذ",
  failed: "فشل",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  failed: "destructive",
  unhealthy: "destructive",
};

function saveText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function TransferPanel() {
  const qc = useQueryClient();
  const fetchServers = useServerFn(listServers);
  const create = useServerFn(createTransfer);
  const start = useServerFn(startTransfer);
  const sync = useServerFn(syncTransfer);
  const remove = useServerFn(deleteTransfer);
  const genPs = useServerFn(generatePowerShell);

  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [serverId, setServerId] = useState("");
  const [name, setName] = useState("");
  const [targetPath, setTargetPath] = useState("/home/ismail/hn");
  const [port, setPort] = useState("3000");
  const [installCmd, setInstallCmd] = useState("");
  const [buildCmd, setBuildCmd] = useState("");
  const [startCmd, setStartCmd] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [psScript, setPsScript] = useState("");
  const [sshUser, setSshUser] = useState("root");
  const [sshPort, setSshPort] = useState("22");
  const [localPath, setLocalPath] = useState("");

  const { data: servers = [] } = useQuery({
    queryKey: ["transfer", "servers"],
    queryFn: () => fetchServers({}) as Promise<any[]>,
  });

  const { data: transfers = [], refetch } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("file_transfers" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as any[];
    },
    refetchInterval: 10000,
  });

  const target = useMemo(() => servers.find((s: any) => s.id === serverId), [servers, serverId]);
  const totalSize = files.reduce((a, f) => a + f.size, 0);

  const pickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const arr = Array.from(list);
    setFiles(arr);
    if (!name) {
      const rel = (arr[0] as any).webkitRelativePath as string | undefined;
      const guess = rel ? rel.split("/")[0] : arr[0].name.replace(/\.[^.]+$/, "");
      setName(guess ?? "site");
    }
  };

  const buildZip = async () => {
    const entries: Record<string, Uint8Array> = {};
    let done = 0;
    for (const f of files) {
      const rel = ((f as any).webkitRelativePath as string) || f.name;
      const path = rel.includes("/") ? rel.split("/").slice(1).join("/") || f.name : rel;
      if (/(^|\/)(node_modules|\.git|dist|\.next|\.output|\.cache)(\/|$)/.test(rel)) { done++; continue; }
      entries[path] = new Uint8Array(await f.arrayBuffer());
      done++;
      setProgress(Math.round((done / files.length) * 45));
    }
    if (!Object.keys(entries).length) throw new Error("لا توجد ملفات صالحة للرفع");
    return zipSync(entries, { level: 6 });
  };

  const runTransfer = async () => {
    if (!files.length) return toast.error("اختر ملفات أو مجلداً من الحاسوب");
    if (!serverId) return toast.error("اختر السيرفر الهدف");
    setBusy(true);
    setProgress(3);
    try {
      const zipped = await buildZip();
      setProgress(50);

      const row: any = await create({
        data: {
          serverId,
          name: name || "site",
          targetPath,
          port: Number(port) || 3000,
          installCmd,
          buildCmd,
          startCmd,
          outputDir,
          mode: "agent",
          fileCount: files.length,
          sizeBytes: zipped.byteLength,
        },
      });
      setProgress(60);

      const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
      const { error: upErr } = await supabase.storage
        .from("site-uploads")
        .upload(row.storage_path, blob, { upsert: true, contentType: "application/zip" });
      if (upErr) throw new Error(upErr.message);
      setProgress(85);

      await start({ data: { transferId: row.id, dryRun } });
      setProgress(100);
      toast.success(dryRun ? "تم جدولة محاكاة النشر" : "تم رفع الملفات — الوكيل يبني الآن على السيرفر");
      qc.invalidateQueries({ queryKey: ["transfers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت العملية");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  const makePs = async () => {
    if (!name) return toast.error("اكتب اسم المشروع");
    const host = target?.ip_address || target?.hostname || "";
    if (!host && !localPath) return toast.error("اختر سيرفراً أو اكتب عنوان IP");
    try {
      const res: any = await genPs({
        data: {
          name,
          host: host || "SERVER_IP",
          sshUser,
          sshPort: Number(sshPort) || 22,
          localPath: localPath || "C:\\path\\to\\project",
          targetPath,
          port: Number(port) || 3000,
          installCmd, buildCmd, startCmd, outputDir,
        },
      });
      setPsScript(res.script);
      toast.success("تم توليد سكربت PowerShell");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التوليد");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" /> نقل ملفات من الحاسوب إلى السيرفر وبناؤها وتشغيلها
          </CardTitle>
          <CardDescription>
            تُضغط الملفات في المتصفح، تُرفع إلى تخزين خاص، ثم يسحبها وكيل السيرفر إلى المسار المحدد، يبنيها، يفتح المنفذ،
            وينشئ خدمة دائمة (systemd) تعمل تلقائياً بعد إعادة التشغيل.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>الملفات / المجلد من الحاسوب</Label>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => pickFiles(e.target.files)}
                />
                <input
                  id="tvcc-folder"
                  type="file"
                  multiple
                  className="hidden"
                  // @ts-expect-error non-standard directory attributes
                  webkitdirectory="true"
                  directory="true"
                  onChange={(e) => pickFiles(e.target.files)}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <FolderUp className="me-2 h-4 w-4" /> اختيار ملفات
                </Button>
                <Button variant="outline" onClick={() => document.getElementById("tvcc-folder")?.click()}>
                  <FolderUp className="me-2 h-4 w-4" /> اختيار مجلد كامل
                </Button>
              </div>
              {!!files.length && (
                <p className="text-xs text-muted-foreground">
                  {files.length} ملف — {(totalSize / 1024 / 1024).toFixed(1)} MB
                  {" "}(يُستثنى node_modules و .git و dist تلقائياً)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>السيرفر الهدف</Label>
              <Select value={serverId} onValueChange={setServerId}>
                <SelectTrigger><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
                <SelectContent>
                  {servers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.ip_address ? `— ${s.ip_address}` : ""} {s.status === "online" ? "🟢" : "⚪"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>اسم المشروع (اسم المجلد على السيرفر)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-site" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>المسار على السيرفر</Label>
              <Input value={targetPath} onChange={(e) => setTargetPath(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>المنفذ</Label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} dir="ltr" placeholder="3000" />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={dryRun} onCheckedChange={setDryRun} id="dry" />
                <Label htmlFor="dry">محاكاة (Dry Run)</Label>
              </div>
            </div>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="adv">
              <AccordionTrigger className="text-sm">إعدادات متقدمة (التثبيت / البناء / التشغيل)</AccordionTrigger>
              <AccordionContent className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>أمر التثبيت</Label>
                  <Input value={installCmd} onChange={(e) => setInstallCmd(e.target.value)} placeholder="npm install (تلقائي)" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>أمر البناء</Label>
                  <Input value={buildCmd} onChange={(e) => setBuildCmd(e.target.value)} placeholder="npm run build (تلقائي)" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>أمر التشغيل</Label>
                  <Input value={startCmd} onChange={(e) => setStartCmd(e.target.value)} placeholder="npm run start (تلقائي)" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>مجلد المخرجات (للمواقع الثابتة)</Label>
                  <Input value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder="dist (تلقائي)" dir="ltr" />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {busy && <Progress value={progress} />}

          <div className="flex flex-wrap gap-2">
            <Button onClick={runTransfer} disabled={busy}>
              <Rocket className="me-2 h-4 w-4" /> {busy ? "جارٍ التنفيذ..." : dryRun ? "تشغيل المحاكاة" : "رفع وبناء وتشغيل"}
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="me-2 h-4 w-4" /> تحديث الحالة
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            يتطلب وكيل TVCC مثبتاً على السيرفر (تبويب «وكيل السيرفر»). إن لم يكن مثبتاً، استخدم سكربت PowerShell بالأسفل.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" /> بديل: سكربت PowerShell (SSH مباشر)</CardTitle>
          <CardDescription>
            يرفع مجلداً من حاسوبك عبر SSH/SCP، يبني المشروع على السيرفر، يفتح المنفذ، وينشئ خدمة دائمة — دون وكيل.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>مسار المجلد على الحاسوب</Label>
              <Input value={localPath} onChange={(e) => setLocalPath(e.target.value)} placeholder="C:\\projects\\my-site" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>مستخدم SSH</Label>
              <Input value={sshUser} onChange={(e) => setSshUser(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>منفذ SSH</Label>
              <Input value={sshPort} onChange={(e) => setSshPort(e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={makePs}>
              <Terminal className="me-2 h-4 w-4" /> توليد سكربت PowerShell
            </Button>
            {psScript && (
              <>
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(psScript); toast.success("تم النسخ"); }}>
                  <Copy className="me-2 h-4 w-4" /> نسخ
                </Button>
                <Button variant="outline" onClick={() => saveText(`tvcc-deploy-${name || "site"}.ps1`, psScript)}>
                  <Download className="me-2 h-4 w-4" /> تنزيل .ps1
                </Button>
              </>
            )}
          </div>
          {psScript && (
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs" dir="ltr">{psScript}</pre>
          )}
          <p className="text-xs text-muted-foreground">
            كلمة مرور السيرفر تُدخل في نافذة SSH عند التنفيذ ولا تُخزَّن في المنصة إطلاقاً.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> عمليات النقل الأخيرة</CardTitle>
          <CardDescription>حالة كل عملية، المنفذ، الخدمة، وسجل البناء.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!transfers.length && <p className="text-sm text-muted-foreground">لا توجد عمليات بعد.</p>}
          {transfers.map((t: any) => {
            const srv = servers.find((s: any) => s.id === t.server_id);
            const host = srv?.ip_address || srv?.hostname;
            return (
              <div key={t.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium" dir="ltr">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground" dir="ltr">
                      {t.target_path}/{t.name} · {srv?.name ?? "—"} · :{t.port}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                    {host && t.status === "running" && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`http://${host}:${t.port}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await sync({ data: { transferId: t.id } });
                        qc.invalidateQueries({ queryKey: ["transfers"] });
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await remove({ data: { transferId: t.id } });
                        qc.invalidateQueries({ queryKey: ["transfers"] });
                        toast.success("تم الحذف");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {t.log && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]" dir="ltr">{t.log}</pre>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
