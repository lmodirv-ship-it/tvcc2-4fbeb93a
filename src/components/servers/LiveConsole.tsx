import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, Loader2 } from "lucide-react";
import { getCommandFeed, cancelAgentCommand } from "@/lib/agent-roles.functions";
import { COMMAND_LABELS } from "@/lib/server-commands";
import { toast } from "sonner";

type Cmd = {
  id: string; action: string; status: string; exit_code: number | null;
  output: string | null; progress: number | null; duration_ms: number | null;
  dry_run: boolean | null; created_at: string; started_at: string | null; finished_at: string | null;
};

const statusTone: Record<string, string> = {
  pending: "text-muted-foreground",
  running: "text-primary",
  done: "text-success",
  success: "text-success",
  failed: "text-destructive",
  error: "text-destructive",
  cancelled: "text-warning",
};

const statusLabel: Record<string, string> = {
  pending: "بالانتظار", running: "قيد التنفيذ", done: "تم", success: "تم",
  failed: "فشل", error: "فشل", cancelled: "أُلغي", timeout: "انتهت المهلة",
};

export function LiveConsole({ serverId }: { serverId: string }) {
  const feed = useServerFn(getCommandFeed);
  const cancel = useServerFn(cancelAgentCommand);
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["cmd-feed", serverId],
    queryFn: () => feed({ data: { serverId } }),
    refetchInterval: 4000,
  });

  // realtime push so results appear the moment the agent reports back
  useEffect(() => {
    const ch = supabase
      .channel(`cmds-${serverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "server_commands", filter: `server_id=eq.${serverId}` },
        () => qc.invalidateQueries({ queryKey: ["cmd-feed", serverId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serverId, qc]);

  const cancelM = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => { toast.success("تم إلغاء الأمر"); q.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الإلغاء"),
  });

  const cmds = (q.data?.commands ?? []) as Cmd[];
  const instance = q.data?.instance as any;
  const live = useMemo(() => cmds.filter((c) => c.status === "pending" || c.status === "running").length, [cmds]);

  useEffect(() => { boxRef.current?.scrollTo({ top: 0 }); }, [cmds.length]);

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" /> الطرفية الحيّة — نتائج الوكيل
          </h3>
          <div className="flex items-center gap-2 text-xs">
            {instance?.agent_version && <Badge variant="outline">الوكيل v{instance.agent_version}</Badge>}
            {instance?.last_poll_at && (
              <Badge variant="outline">
                آخر اتصال: {Math.max(0, Math.round((Date.now() - new Date(instance.last_poll_at).getTime()) / 1000))} ث
              </Badge>
            )}
            <Badge className={live ? "bg-primary/15 text-primary" : ""} variant={live ? "default" : "outline"}>
              {live ? `${live} قيد التنفيذ` : "خامل"}
            </Badge>
          </div>
        </div>

        <div ref={boxRef} className="max-h-[420px] overflow-y-auto rounded-md border border-border/60 bg-muted/30 divide-y divide-border/50">
          {q.isLoading && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> تحميل…</div>}
          {!q.isLoading && cmds.length === 0 && <p className="p-4 text-sm text-muted-foreground">لا توجد أوامر بعد. أرسل أمراً من تبويب المهام.</p>}
          {cmds.map((c) => (
            <div key={c.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{COMMAND_LABELS[c.action] ?? c.action}</span>
                <code className="text-[11px] text-muted-foreground">{c.action}</code>
                {c.dry_run && <Badge variant="outline" className="text-[10px]">محاكاة</Badge>}
                <span className={`text-xs font-semibold ${statusTone[c.status] ?? ""}`}>
                  {c.status === "running" && <Loader2 className="inline w-3 h-3 animate-spin ms-1" />} {statusLabel[c.status] ?? c.status}
                </span>
                {typeof c.duration_ms === "number" && <span className="text-[11px] text-muted-foreground">{c.duration_ms} م.ث</span>}
                {typeof c.exit_code === "number" && <span className="text-[11px] text-muted-foreground">exit={c.exit_code}</span>}
                <span className="text-[11px] text-muted-foreground ms-auto">{new Date(c.created_at).toLocaleTimeString("ar")}</span>
                {(c.status === "pending" || c.status === "running") && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancelM.mutate(c.id)}>إلغاء</Button>
                )}
                {c.output && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setOpen(open === c.id ? null : c.id)}>
                    {open === c.id ? "إخفاء" : "عرض المخرجات"}
                  </Button>
                )}
              </div>
              {open === c.id && c.output && (
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] leading-5 text-left" dir="ltr">{c.output}</pre>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
