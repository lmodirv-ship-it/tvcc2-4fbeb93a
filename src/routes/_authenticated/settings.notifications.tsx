import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bell, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotifSettings,
  head: () => ({ meta: [{ title: "Notification Settings — TVCC" }] }),
});

const EVENT_TYPES = [
  "website_offline", "website_online", "dns_error", "ssl_expiring",
  "database_error", "database_offline", "storage_full",
  "backup_failed", "backup_completed",
  "deployment_completed", "deployment_failed",
  "new_user", "subscription_expired", "security_alert",
];

type Pref = {
  id?: string;
  event_type: string;
  in_app: boolean;
  email: boolean;
  telegram: boolean;
  webhook: boolean;
  min_severity: string;
};

function NotifSettings() {
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["notif-prefs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notification_preferences").select("*");
      if (error) throw error;
      return data as Pref[];
    },
  });

  useEffect(() => {
    const map: Record<string, Pref> = {};
    for (const ev of EVENT_TYPES) {
      const e = existing?.find((p) => p.event_type === ev);
      map[ev] = e
        ? { ...e }
        : { event_type: ev, in_app: true, email: false, telegram: false, webhook: false, min_severity: "info" };
    }
    setPrefs(map);
  }, [existing]);

  const update = (ev: string, patch: Partial<Pref>) => {
    setPrefs((p) => ({ ...p, [ev]: { ...p[ev], ...patch } }));
    setDirty(true);
  };

  const saveAll = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const rows = Object.values(prefs).map((p) => ({
      owner_id: u.user!.id,
      event_type: p.event_type,
      in_app: p.in_app,
      email: p.email,
      telegram: p.telegram,
      webhook: p.webhook,
      min_severity: p.min_severity,
    }));
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert(rows, { onConflict: "owner_id,event_type" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["notif-prefs"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" /> Notification Preferences
          </h1>
          <p className="text-muted-foreground mt-1">Choose where each event type is delivered.</p>
        </div>
        <Button onClick={saveAll} disabled={!dirty || saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      {dirty && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
          You have unsaved changes.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-event delivery</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 gap-2 px-4 py-2 text-[11px] font-medium text-muted-foreground border-b">
            <div className="col-span-2">Event</div>
            <div className="text-center">In-App</div>
            <div className="text-center">Email</div>
            <div className="text-center">Telegram</div>
            <div className="text-center">Webhook</div>
            <div className="text-center">Min severity</div>
          </div>
          <div className="divide-y">
            {EVENT_TYPES.map((ev) => {
              const p = prefs[ev];
              if (!p) return null;
              return (
                <div key={ev} className="grid grid-cols-7 gap-2 px-4 py-3 items-center">
                  <Label className="col-span-2 text-sm">{ev.replace(/_/g, " ")}</Label>
                  <div className="flex justify-center"><Switch checked={p.in_app} onCheckedChange={(v) => update(ev, { in_app: v })} /></div>
                  <div className="flex justify-center"><Switch checked={p.email} onCheckedChange={(v) => update(ev, { email: v })} /></div>
                  <div className="flex justify-center"><Switch checked={p.telegram} onCheckedChange={(v) => update(ev, { telegram: v })} /></div>
                  <div className="flex justify-center"><Switch checked={p.webhook} onCheckedChange={(v) => update(ev, { webhook: v })} /></div>
                  <div>
                    <Select value={p.min_severity} onValueChange={(v) => update(ev, { min_severity: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
