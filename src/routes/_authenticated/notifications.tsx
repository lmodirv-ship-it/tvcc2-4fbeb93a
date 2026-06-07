import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bell, Plus, Trash2, Check, CheckCheck, Mail, Send, Search,
  AlertOctagon, AlertTriangle, CircleCheck, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — TVCC" }] }),
});

const sevIcon = (sev: string) => {
  if (sev === "critical") return <AlertOctagon className="w-4 h-4 text-destructive" />;
  if (sev === "warning") return <AlertTriangle className="w-4 h-4 text-warning" />;
  if (sev === "success") return <CircleCheck className="w-4 h-4 text-success" />;
  return <Info className="w-4 h-4 text-primary" />;
};

function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [chOpen, setChOpen] = useState(false);
  const [ch, setCh] = useState({ channel_type: "email", target: "" });
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: channels } = useQuery({
    queryKey: ["notif-channels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notification_channels").select("*").order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    let list = notifs || [];
    if (tab === "unread") list = list.filter((n) => !n.is_read);
    else if (tab !== "all") list = list.filter((n) => n.severity === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.message?.toLowerCase().includes(q) ||
          n.type?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [notifs, tab, search]);

  const counts = useMemo(() => {
    const list = notifs || [];
    return {
      all: list.length,
      unread: list.filter((n) => !n.is_read).length,
      critical: list.filter((n) => n.severity === "critical").length,
      warning: list.filter((n) => n.severity === "warning").length,
      info: list.filter((n) => n.severity === "info").length,
      success: list.filter((n) => n.severity === "success").length,
    };
  }, [notifs]);

  const markRead = async (id: string) => {
    await (supabase as any).from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAll = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("owner_id", u.user.id)
      .eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    toast.success(t("notifications.all_marked"));
  };

  const del = async (id: string) => {
    await (supabase as any).from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const addCh = async () => {
    if (!ch.target) return toast.error("Target required");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("notification_channels").insert({
      owner_id: u.user!.id, channel_type: ch.channel_type, target: ch.target,
    });
    if (error) return toast.error(error.message);
    toast.success("Channel added");
    setCh({ channel_type: "email", target: "" });
    setChOpen(false);
    qc.invalidateQueries({ queryKey: ["notif-channels"] });
  };

  const delCh = async (id: string) => {
    await (supabase as any).from("notification_channels").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notif-channels"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" /> {t("notifications.center")}
            {counts.unread > 0 && (
              <Badge className="bg-destructive text-destructive-foreground">{counts.unread}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">{t("notifications.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {counts.unread > 0 && (
            <Button variant="outline" onClick={markAll}>
              <CheckCheck className="w-4 h-4 mr-2" /> {t("notifications.mark_all_read")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 ring-1 ring-border bg-card/60">
          <CardContent className="p-4 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("notifications.search_placeholder") as string}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full grid grid-cols-6">
                <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                <TabsTrigger value="unread">Unread ({counts.unread})</TabsTrigger>
                <TabsTrigger value="critical">Critical ({counts.critical})</TabsTrigger>
                <TabsTrigger value="warning">Warning ({counts.warning})</TabsTrigger>
                <TabsTrigger value="info">Info ({counts.info})</TabsTrigger>
                <TabsTrigger value="success">Success ({counts.success})</TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-4">
                {filtered.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">{t("notifications.empty")}</div>
                ) : (
                  <div className="divide-y divide-border/40 -mx-4">
                    {filtered.map((n: any) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 flex items-start gap-3 hover:bg-secondary/30 ${!n.is_read ? "bg-primary/5" : ""}`}
                      >
                        <div className="mt-1">{sevIcon(n.severity)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{n.title}</span>
                            <Badge variant="outline" className="text-[10px]">{n.type}</Badge>
                          </div>
                          {n.message && (
                            <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {!n.is_read && (
                            <Button size="icon" variant="ghost" onClick={() => markRead(n.id)} title="Mark read">
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => del(n.id)} title="Delete">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t("notifications.channels")}</h3>
                <Button size="sm" variant="outline" onClick={() => setChOpen(!chOpen)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {chOpen && (
                <div className="space-y-2 p-3 bg-secondary/30 rounded-md">
                  <Select value={ch.channel_type} onValueChange={(v) => setCh({ ...ch, channel_type: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input dir="ltr" placeholder="email@example.com / chat_id / url"
                    className="bg-background" value={ch.target}
                    onChange={(e) => setCh({ ...ch, target: e.target.value })} />
                  <Button size="sm" onClick={addCh} className="w-full">Add</Button>
                </div>
              )}
              {!channels?.length ? (
                <p className="text-xs text-muted-foreground">{t("notifications.no_channels")}</p>
              ) : (
                <div className="space-y-2">
                  {channels.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                      <div className="flex items-center gap-2">
                        {c.channel_type === "email" ? <Mail className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        <span className="text-xs" dir="ltr">{c.target}</span>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => delCh(c.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
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
