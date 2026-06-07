import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bell, Plus, Trash2, Check, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "الإشعارات — TVCC" }] }),
});

function NotificationsPage() {
  const qc = useQueryClient();
  const [chOpen, setChOpen] = useState(false);
  const [ch, setCh] = useState({ channel_type: "email", target: "" });

  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: channels } = useQuery({
    queryKey: ["notif-channels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("notification_channels").select("*").order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const markRead = async (id: string) => {
    await (supabase as any).from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const addCh = async () => {
    if (!ch.target) return toast.error("الهدف مطلوب");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("notification_channels").insert({
      owner_id: u.user!.id, channel_type: ch.channel_type, target: ch.target,
    });
    if (error) return toast.error(error.message);
    toast.success("أُضيفت قناة");
    setCh({ channel_type: "email", target: "" });
    setChOpen(false);
    qc.invalidateQueries({ queryKey: ["notif-channels"] });
  };

  const delCh = async (id: string) => {
    await (supabase as any).from("notification_channels").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notif-channels"] });
  };

  const unread = (notifs || []).filter((n: any) => !n.is_read).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" /> مركز الإشعارات
            {unread > 0 && <Badge className="bg-destructive text-destructive-foreground">{unread}</Badge>}
          </h1>
          <p className="text-muted-foreground mt-1">جميع التنبيهات وقنوات الإرسال (Email / Telegram / WhatsApp)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 ring-1 ring-border bg-card/60">
          <CardContent className="p-0">
            {!notifs?.length ? (
              <div className="p-12 text-center text-muted-foreground">لا إشعارات</div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifs.map((n: any) => (
                  <div key={n.id} className={`p-4 flex items-start gap-3 ${!n.is_read ? "bg-primary/5" : ""}`}>
                    <div className={`w-2 h-2 rounded-full mt-2 ${n.severity === "critical" ? "bg-destructive" : n.severity === "warning" ? "bg-warning" : "bg-primary"}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{n.title}</span>
                        <Badge variant="outline" className="text-[10px]">{n.type}</Badge>
                      </div>
                      {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString("ar")}</p>
                    </div>
                    {!n.is_read && <Button size="icon" variant="ghost" onClick={() => markRead(n.id)}><Check className="w-4 h-4" /></Button>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">قنوات الإرسال</h3>
                <Button size="sm" variant="outline" onClick={() => setChOpen(!chOpen)}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              {chOpen && (
                <div className="space-y-2 p-3 bg-secondary/30 rounded-md">
                  <Select value={ch.channel_type} onValueChange={(v) => setCh({ ...ch, channel_type: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input dir="ltr" placeholder="email@example.com / chat_id" className="bg-background" value={ch.target} onChange={(e) => setCh({ ...ch, target: e.target.value })} />
                  <Button size="sm" onClick={addCh} className="w-full bg-primary">إضافة</Button>
                </div>
              )}
              {!channels?.length ? (
                <p className="text-xs text-muted-foreground">لم تُضف قنوات بعد</p>
              ) : (
                <div className="space-y-2">
                  {channels.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                      <div className="flex items-center gap-2">
                        {c.channel_type === "email" ? <Mail className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        <span className="text-xs" dir="ltr">{c.target}</span>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => delCh(c.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
