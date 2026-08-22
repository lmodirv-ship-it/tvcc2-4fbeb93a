import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Folder, FileText, Search, RefreshCw, Loader2, Plus, Trash2, CheckCircle2, ListTodo, CornerUpLeft,
} from "lucide-react";
import { listServers } from "@/lib/servers.functions";
import {
  browseServerPath, readServerFile, searchServerFiles,
  listAiTasks, saveAiTask, setAiTaskStatus, deleteAiTask,
} from "@/lib/workspace.functions";

type Entry = { name: string; dir: boolean };

function parseLs(output: string): Entry[] {
  return output
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/\s+/);
      const name = parts.slice(7).join(" ");
      return { name, dir: l.startsWith("d") };
    })
    .filter((e) => e.name && e.name !== "." && e.name !== "..");
}

export function WorkspacePanel({
  serverId, setServerId, selected, setSelected, activeTasks, setActiveTasks,
}: {
  serverId: string;
  setServerId: (v: string) => void;
  selected: string[];
  setSelected: (v: string[]) => void;
  activeTasks: string[];
  setActiveTasks: (v: string[]) => void;
}) {
  const qc = useQueryClient();
  const servers = useServerFn(listServers);
  const browse = useServerFn(browseServerPath);
  const readFile = useServerFn(readServerFile);
  const search = useServerFn(searchServerFiles);
  const tasksFn = useServerFn(listAiTasks);
  const saveTask = useServerFn(saveAiTask);
  const taskStatus = useServerFn(setAiTaskStatus);
  const removeTask = useServerFn(deleteAiTask);

  const [path, setPath] = useState("/home/ismail/hn");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");

  const { data: serverList } = useQuery({ queryKey: ["servers-list"], queryFn: () => servers() });
  const { data: tasks } = useQuery({ queryKey: ["ai-tasks"], queryFn: () => tasksFn() });
  const list = ((serverList as any)?.servers ?? (serverList as any) ?? []) as any[];

  const load = async (p: string) => {
    if (!serverId) return toast.error("اختر سيرفراً أولاً");
    setBusy("ls");
    try {
      const r: any = await browse({ data: { serverId, path: p } });
      setRaw(r.output ?? "");
      setEntries(parseLs(r.output ?? ""));
      setPath(p);
      if (r.status === "pending") toast.info("بانتظار نبضة الوكيل — أعد المحاولة بعد قليل");
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  const open = async (e: Entry) => {
    const full = `${path.replace(/\/+$/, "")}/${e.name}`;
    if (e.dir) return load(full);
    setBusy("read");
    try {
      const r: any = await readFile({ data: { serverId, path: full, limit: 300 } });
      setPreview(`${full}\n\n${r.output ?? ""}`);
    } catch (err) { toast.error((err as Error).message); }
    setBusy(null);
  };

  const toggle = (name: string) => {
    const full = `${path.replace(/\/+$/, "")}/${name}`;
    setSelected(selected.includes(full) ? selected.filter((s) => s !== full) : [...selected, full]);
  };

  const runSearch = async () => {
    if (!query) return;
    setBusy("grep");
    try {
      const r: any = await search({ data: { serverId, path, query } });
      setPreview(`نتائج البحث عن «${query}»\n\n${r.output ?? ""}`);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  const addTask = async () => {
    if (!title.trim()) return;
    try {
      await saveTask({ data: { title, instructions, filePaths: selected, serverId: serverId || null } });
      setTitle(""); setInstructions("");
      qc.invalidateQueries({ queryKey: ["ai-tasks"] });
      toast.success("أُضيفت المهمة");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardContent className="p-3 space-y-3 overflow-y-auto">
        <Select value={serverId} onValueChange={setServerId}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="سيرفر ورشة العمل" /></SelectTrigger>
          <SelectContent>
            {list.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Tabs defaultValue="files">
          <TabsList className="w-full">
            <TabsTrigger value="files" className="flex-1 text-xs"><Folder className="w-3 h-3 ml-1" /> الملفات</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1 text-xs"><ListTodo className="w-3 h-3 ml-1" /> المهام</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-2 mt-3">
            <div className="flex gap-1">
              <Input dir="ltr" value={path} onChange={(e) => setPath(e.target.value)} className="h-8 text-xs" />
              <Button size="sm" variant="outline" className="h-8" disabled={busy === "ls"} onClick={() => load(path)}>
                {busy === "ls" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-8"
                onClick={() => load(path.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/")}>
                <CornerUpLeft className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Input dir="ltr" placeholder="بحث داخل الملفات" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-xs" />
              <Button size="sm" variant="outline" className="h-8" disabled={busy === "grep"} onClick={runSearch}>
                {busy === "grep" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              </Button>
            </div>

            {entries.length === 0 && raw && <pre dir="ltr" className="text-[10px] whitespace-pre-wrap bg-muted rounded p-2 max-h-40 overflow-auto">{raw}</pre>}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {entries.map((e) => {
                const full = `${path.replace(/\/+$/, "")}/${e.name}`;
                return (
                  <div key={e.name} className="flex items-center gap-2 text-xs rounded px-1 py-1 hover:bg-muted">
                    <Checkbox checked={selected.includes(full)} onCheckedChange={() => toggle(e.name)} />
                    <button className="flex items-center gap-1 flex-1 text-start truncate" onClick={() => open(e)} dir="ltr">
                      {e.dir ? <Folder className="w-3 h-3 text-primary" /> : <FileText className="w-3 h-3 text-muted-foreground" />}
                      <span className="truncate">{e.name}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {selected.length > 0 && (
              <div className="rounded border p-2 space-y-1">
                <p className="text-[10px] text-muted-foreground">ملفات مرفقة للنموذج ({selected.length})</p>
                <div className="flex flex-wrap gap-1">
                  {selected.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px] cursor-pointer"
                      onClick={() => setSelected(selected.filter((x) => x !== s))} dir="ltr">
                      {s.split("/").pop()} ✕
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {preview && (
              <pre dir="ltr" className="text-[10px] whitespace-pre-wrap bg-muted rounded p-2 max-h-60 overflow-auto">{preview}</pre>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-2 mt-3">
            <Input placeholder="عنوان المهمة" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" />
            <Textarea placeholder="ما المطلوب إنجازه بالضبط؟" value={instructions}
              onChange={(e) => setInstructions(e.target.value)} className="text-xs min-h-[64px]" />
            <Button size="sm" className="w-full" onClick={addTask} disabled={!title.trim()}>
              <Plus className="w-3 h-3 ml-1" /> إضافة مهمة {selected.length ? `(${selected.length} ملف)` : ""}
            </Button>

            <div className="space-y-1 max-h-72 overflow-y-auto">
              {((tasks as any[]) ?? []).map((t) => (
                <div key={t.id} className={`rounded border p-2 space-y-1 ${activeTasks.includes(t.id) ? "border-primary" : ""}`}>
                  <div className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={activeTasks.includes(t.id)}
                      onCheckedChange={() =>
                        setActiveTasks(activeTasks.includes(t.id) ? activeTasks.filter((x) => x !== t.id) : [...activeTasks, t.id])
                      }
                    />
                    <span className="flex-1 truncate font-medium">{t.title}</span>
                    <Badge variant={t.status === "done" ? "default" : "outline"} className="text-[10px]">{t.status}</Badge>
                  </div>
                  {t.instructions && <p className="text-[10px] text-muted-foreground line-clamp-2">{t.instructions}</p>}
                  {t.file_paths?.length > 0 && (
                    <p dir="ltr" className="text-[10px] text-muted-foreground truncate">{t.file_paths.join(" · ")}</p>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                      onClick={async () => {
                        await taskStatus({ data: { id: t.id, status: t.status === "done" ? "pending" : "done" } });
                        qc.invalidateQueries({ queryKey: ["ai-tasks"] });
                      }}>
                      <CheckCircle2 className="w-3 h-3 ml-1" /> {t.status === "done" ? "إعادة فتح" : "إنهاء"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive"
                      onClick={async () => {
                        await removeTask({ data: { id: t.id } });
                        qc.invalidateQueries({ queryKey: ["ai-tasks"] });
                      }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {((tasks as any[]) ?? []).length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">لا توجد مهام بعد.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
