import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, AlertTriangle, Info, CircleCheck, AlertOctagon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Notif = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  severity: string;
  is_read: boolean;
  created_at: string;
};

const sevIcon = (sev: string) => {
  if (sev === "critical") return <AlertOctagon className="w-4 h-4 text-destructive" />;
  if (sev === "warning") return <AlertTriangle className="w-4 h-4 text-warning" />;
  if (sev === "success") return <CircleCheck className="w-4 h-4 text-success" />;
  return <Info className="w-4 h-4 text-primary" />;
};

export function NotificationBell() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Notif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15);
    setItems((data as Notif[]) || []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      if (data.user) load();
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `owner_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 15));
          const fn =
            n.severity === "critical" ? toast.error : n.severity === "warning" ? toast.warning : toast.info;
          fn(n.title, { description: n.message ?? undefined });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `owner_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = items.filter((n) => !n.is_read).length;

  const markOne = async (id: string) => {
    await (supabase as any).from("notifications").update({ is_read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAll = async () => {
    if (!userId) return;
    await (supabase as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("owner_id", userId)
      .eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success(t("notifications.all_marked"));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={t("header.notifications")}
          className="relative w-9 h-9 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center justify-center"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">{t("notifications.title")}</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} className="text-xs h-7">
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              {t("notifications.mark_all_read")}
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("notifications.empty")}</div>
          ) : (
            <div className="divide-y">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 flex gap-3 items-start ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  <div className="mt-0.5">{sevIcon(n.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.message && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markOne(n.id)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Link
            to="/notifications"
            className="block text-center text-xs text-primary hover:underline py-1"
          >
            {t("notifications.view_all")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
