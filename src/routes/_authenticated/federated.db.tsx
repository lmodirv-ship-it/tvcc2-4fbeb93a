import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getFleetData } from "@/lib/federated.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, LayoutDashboard, Table2, TerminalSquare, Users, HardDrive, Zap, Radio, Plug, Activity, Settings, Sparkles, DatabaseZap, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/db")({
  component: FederatedDbPage,
  head: () => ({ meta: [{ title: "قواعد البيانات — TVCC" }] }),
});

const MENU = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "tables", label: "محرر الجداول", icon: Table2 },
  { id: "sql", label: "محرر SQL", icon: TerminalSquare },
  { id: "database", label: "قاعدة البيانات", icon: Database },
  { id: "auth", label: "المصادقة", icon: Users },
  { id: "storage", label: "التخزين", icon: HardDrive },
  { id: "functions", label: "دوال الحافة", icon: Zap },
  { id: "realtime", label: "Realtime", icon: Radio },
  { id: "advisors", label: "المستشارون", icon: Sparkles },
  { id: "observability", label: "المراقبة", icon: Activity },
  { id: "integrations", label: "التكاملات", icon: Plug },
  { id: "settings", label: "إعدادات المشروع", icon: Settings },
];

function FederatedDbPage() {
  const fetchFleet = useServerFn(getFleetData);
  const [tab, setTab] = useState("overview");
  const { data: fleet } = useQuery({ queryKey: ["federated-fleet"], queryFn: () => fetchFleet() });
  const { data: dbs } = useQuery({
    queryKey: ["site-databases-fed"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("site_databases").select("id, website_id, server_id, db_engine, db_name, host, port, connection_kind, status");
      return data ?? [];
    },
  });
  const { data: registered } = useQuery({
    queryKey: ["databases-fed"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("databases").select("id, name, engine, host, port, status");
      return data ?? [];
    },
  });

  const siteDomain = (id: string) => ((fleet?.websites ?? []) as any[]).find((w) => w.id === id)?.domain ?? "—";
  const serverName = (id: string) => ((fleet?.servers ?? []) as any[]).find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="flex min-h-screen" dir="rtl">
      <aside className="w-56 shrink-0 border-l border-border p-3 space-y-1">
        <div className="flex items-center gap-2 px-2 py-3">
          <DatabaseZap className="w-5 h-5 text-primary" />
          <span className="font-bold">قواعد البيانات</span>
        </div>
        {MENU.map((m) => (
          <button
            key={m.id}
            onClick={() => setTab(m.id)}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${tab === m.id ? "bg-primary/15 text-primary" : "hover:bg-accent text-muted-foreground"}`}
          >
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </aside>

      <main className="flex-1 p-6 space-y-4">
        {tab === "overview" && (
          <>
            <h1 className="text-xl font-bold">نظرة عامة على المشاريع (Control Plane)</h1>
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">قواعد بيانات المواقع</div><div className="text-2xl font-bold">{(dbs ?? []).length}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">قواعد مسجّلة</div><div className="text-2xl font-bold">{(registered ?? []).length}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">نشطة</div><div className="text-2xl font-bold text-success">{(dbs ?? []).filter((d: any) => d.status === "online" || d.status === "active").length}</div></CardContent></Card>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>القاعدة</TableHead><TableHead>المحرك</TableHead><TableHead>الموقع</TableHead><TableHead>السيرفر</TableHead><TableHead>المضيف</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(dbs ?? []).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium" dir="ltr">{d.db_name}</TableCell>
                      <TableCell>{d.db_engine}</TableCell>
                      <TableCell dir="ltr">{siteDomain(d.website_id)}</TableCell>
                      <TableCell>{serverName(d.server_id)}</TableCell>
                      <TableCell dir="ltr" className="text-xs">{d.host}:{d.port}</TableCell>
                      <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(dbs ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">لا قواعد بيانات مربوطة بعد — اربطها من صفحة الإعدادات</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </>
        )}

        {tab === "sql" && (
          <Card><CardContent className="p-6 space-y-3">
            <h2 className="font-bold">محرر SQL</h2>
            <p className="text-sm text-muted-foreground">التنفيذ يمر عبر الاستوديو الجماعي الفيدرالي مع Dry Run وحظر الأوامر المدمّرة.</p>
            <Link to="/federated/sql" className="text-primary text-sm hover:underline">فتح استوديو SQL الجماعي ←</Link>
          </CardContent></Card>
        )}

        {tab === "tables" && (
          <Card><CardContent className="p-6 space-y-3">
            <h2 className="font-bold">محرر الجداول</h2>
            <p className="text-sm text-muted-foreground">استعراض وتحرير الصفوف والأعمدة والمفاتيح الخارجية يتم عبر محرر SQL المرتبط بكل قاعدة، مع محرر جداول مقارن بين موقعين في المرحلة التالية.</p>
          </CardContent></Card>
        )}

        {tab === "database" && (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>المحرك</TableHead><TableHead>المضيف</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {(registered ?? []).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.engine}</TableCell>
                    <TableCell dir="ltr" className="text-xs">{d.host}:{d.port}</TableCell>
                    <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {(registered ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">لا قواعد مسجّلة — تُدار من تبويب قواعد البيانات في الإعدادات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}

        {["auth", "storage", "functions", "realtime", "advisors", "observability", "integrations", "settings"].includes(tab) && (
          <Card><CardContent className="p-6 space-y-3">
            <h2 className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> {MENU.find((m) => m.id === tab)?.label}</h2>
            <p className="text-sm text-muted-foreground">
              مكوّنات طبقة البيانات (المصادقة، التخزين المتوافق مع S3، الدوال، البث اللحظي، تجميع الاتصالات) تُركّب وتُدار على السيرفر المستهدف عبر أوامر الوكيل
              (<code dir="ltr">db_provision</code>، <code dir="ltr">pooler_config</code>) — لا اتصال مباشر من المتصفح. الإدارة الحالية متاحة من <Link to="/settings" className="text-primary hover:underline">الإعدادات ←</Link>.
            </p>
          </CardContent></Card>
        )}
      </main>
    </div>
  );
}
