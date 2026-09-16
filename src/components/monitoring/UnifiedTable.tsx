import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, FileDown, Globe, Send, ShieldCheck, Signal } from "lucide-react";

function fmt(ts?: string | null) {
  return ts ? new Date(ts).toLocaleString("ar", { hour12: false }) : "—";
}

function ago(min?: number | null) {
  if (min == null) return "—";
  if (min < 1) return "الآن";
  if (min < 60) return `${min} د`;
  if (min < 1440) return `${Math.round(min / 60)} س`;
  return `${Math.round(min / 1440)} ي`;
}

function Dot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-muted-foreground/40"}`}
      aria-hidden
    />
  );
}

const PAGE = 40;

type SortKey = "code" | "name" | "server" | "beat" | "uptime" | "ms" | "schedules";

export function UnifiedTable({
  sites,
  servers,
  onProgram,
  onDeploy,
  onVerifyDns,
  busy,
}: {
  sites: any[];
  servers: any[];
  onProgram: (websiteId: string, kind: "php" | "node" | "badge") => void;
  onDeploy: (websiteId: string) => void;
  onVerifyDns: (websiteId: string) => void;
  busy?: boolean;
}) {
  const [q, setQ] = useState("");
  const [serverFilter, setServerFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [state, setState] = useState("all");
  const [sort, setSort] = useState<SortKey>("code");
  const [dir, setDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);

  const groupList = useMemo(
    () => Array.from(new Set(sites.map((s) => s.group).filter(Boolean))).sort() as string[],
    [sites],
  );

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = sites.filter((s) => {
      if (
        term &&
        ![s.site_code, s.name, s.domain, s.server_name, s.group].some((v) =>
          String(v ?? "").toLowerCase().includes(term),
        )
      )
        return false;
      if (serverFilter !== "all" && s.server_id !== serverFilter) return false;
      if (groupFilter !== "all" && s.group !== groupFilter) return false;
      if (state === "connected" && !s.connected) return false;
      if (state === "noprogram" && s.program) return false;
      if (state === "offline" && s.status === "online") return false;
      if (state === "ssl" && s.ssl_valid !== false) return false;
      return true;
    });
    const val = (s: any) => {
      switch (sort) {
        case "name":
          return String(s.name ?? "");
        case "server":
          return String(s.server_name ?? "");
        case "beat":
          return s.beat_age_min ?? 1e9;
        case "uptime":
          return s.uptime_pct ?? -1;
        case "ms":
          return s.response_time_ms ?? 1e9;
        case "schedules":
          return s.schedules ?? 0;
        default:
          return String(s.site_code ?? "");
      }
    };
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), "ar") * dir;
    });
  }, [sites, q, serverFilter, groupFilter, state, sort, dir]);

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir(dir === 1 ? -1 : 1);
    else {
      setSort(k);
      setDir(1);
    }
  };

  const Th = ({ k, children }: { k?: SortKey; children: React.ReactNode }) => (
    <TableHead className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
      {k ? (
        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
          {children} <ArrowUpDown className="size-3 opacity-50" />
        </button>
      ) : (
        children
      )}
    </TableHead>
  );

  const exportCsv = () => {
    const head = [
      "id",
      "name",
      "domain",
      "server",
      "server_online",
      "agent_version",
      "group",
      "services",
      "schedules",
      "schedule_status",
      "program",
      "deploy_status",
      "connected",
      "beacons",
      "beat_age_min",
      "last_beacon",
      "uptime_pct",
      "http",
      "ms",
      "ssl",
      "site_version",
      "key",
      "key_version",
      "last_event",
    ];
    const lines = rows.map((s) =>
      [
        s.site_code,
        s.name,
        s.domain,
        s.server_name ?? "",
        s.server_online,
        s.agent_version ?? "",
        s.group ?? "",
        (s.services ?? []).join("|"),
        s.schedules,
        s.lastScheduleStatus ?? "",
        s.program,
        s.deploy_status ?? "",
        s.connected,
        s.beacons,
        s.beat_age_min ?? "",
        s.last_beacon_at ?? "",
        s.uptime_pct ?? "",
        s.http_status ?? "",
        s.response_time_ms ?? "",
        s.ssl_valid ?? "",
        s.version ?? "",
        s.key_fingerprint ?? "",
        s.key_version ?? "",
        (s.last_event ?? "").replace(/[\n,]/g, " "),
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([`\uFEFF${head.join(",")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tvcc-monitoring.csv";
    a.click();
  };

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="size-4 text-primary" /> المواقع والسيرفرات
            <span className="text-[11px] font-normal text-muted-foreground">({rows.length} صف)</span>
          </CardTitle>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCsv}>
            <FileDown className="size-3.5" /> تصدير CSV
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="بحث بالمعرّف أو الاسم أو النطاق…"
            className="h-8 w-60 text-xs"
          />
          <Select value={serverFilter} onValueChange={(v) => { setServerFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="السيرفر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كل السيرفرات</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name ?? s.hostname}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="المجموعة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كل المجموعات</SelectItem>
              {groupList.map((g) => (
                <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={state} onValueChange={(v) => { setState(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كل الحالات</SelectItem>
              <SelectItem value="connected" className="text-xs">متصل بالبرنامج</SelectItem>
              <SelectItem value="noprogram" className="text-xs">بدون برنامج</SelectItem>
              <SelectItem value="offline" className="text-xs">غير متصل</SelectItem>
              <SelectItem value="ssl" className="text-xs">شهادة غير صالحة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <Th k="code">المعرّف</Th>
                <Th k="name">الموقع</Th>
                <Th k="server">السيرفر</Th>
                <Th>المجموعة / الخدمات</Th>
                <Th k="beat">الاتصال</Th>
                <Th k="uptime">التشغيل 24س</Th>
                <Th k="ms">HTTP / زمن</Th>
                <Th>SSL</Th>
                <Th k="schedules">المهام</Th>
                <Th>النسخ</Th>
                <Th>المفتاح</Th>
                <Th>آخر حدث</Th>
                <Th>إجراءات</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((s) => (
                <TableRow key={s.id} className="text-xs">
                  <TableCell className="whitespace-nowrap font-mono text-[11px] font-semibold" dir="ltr">
                    {s.site_code ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-48">
                    <div className="truncate font-medium">{s.name}</div>
                    <div dir="ltr" className="truncate text-[10px] text-muted-foreground">{s.domain}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Dot ok={!!s.server_online} />
                      <span className="truncate">{s.server_name ?? "غير مرتبط"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{fmt(s.server_last_seen)}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div>{s.group ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {s.activeServices}/{(s.services ?? []).length} خدمة
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Dot ok={!!s.connected} warn={!!s.program && !s.connected} />
                      <span>{s.connected ? "متصل" : s.program ? "بانتظار النبضة" : "بدون برنامج"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground" dir="ltr">
                      {ago(s.beat_age_min)} · {s.beacons ?? 0} نبضة
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[11px]" dir="ltr">
                    {s.uptime_pct == null ? "—" : `${s.uptime_pct}%`}
                    <div className="text-[10px] text-muted-foreground">{s.checks_count ?? 0} فحص</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[11px]" dir="ltr">
                    {s.http_status ?? "—"}
                    <div className="text-[10px] text-muted-foreground">{s.response_time_ms ?? "—"} ms</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.ssl_valid ? "default" : "secondary"} className="text-[10px]">
                      {s.ssl_valid == null ? "—" : s.ssl_valid ? "صالحة" : "غير صالحة"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div>{s.schedules}</div>
                    <div className="text-[10px] text-muted-foreground">{s.lastScheduleStatus ?? "—"}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[10px]" dir="ltr">
                    <div>site {s.version ?? "—"}</div>
                    <div className="text-muted-foreground">agent {s.agent_version ?? "—"}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[10px]" dir="ltr">
                    {s.key_fingerprint ?? "—"}
                    <div className="text-muted-foreground">v{s.key_version ?? 0}</div>
                  </TableCell>
                  <TableCell className="max-w-44">
                    <div className="truncate">{s.last_event ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{fmt(s.last_event_at)}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={busy} onClick={() => onDeploy(s.id)}>
                            <Send className="size-3" /> نشر
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>إرسال برنامج الموقع إلى السيرفر عبر الوكيل</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" disabled={busy} onClick={() => onVerifyDns(s.id)}>
                            <Signal className="size-3" /> DNS
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>التحقق من رمز الربط في DNS</TooltipContent>
                      </Tooltip>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onProgram(s.id, "php")}>PHP</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onProgram(s.id, "node")}>Node</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onProgram(s.id, "badge")}>
                        <ShieldCheck className="size-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!pageRows.length && (
                <TableRow>
                  <TableCell colSpan={13} className="py-6 text-center text-xs text-muted-foreground">
                    لا نتائج مطابقة.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-border p-2 text-[11px] text-muted-foreground">
          <span>
            صفحة {page + 1} من {Math.max(1, Math.ceil(rows.length / PAGE))}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={page === 0} onClick={() => setPage(page - 1)}>
              السابق
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={(page + 1) * PAGE >= rows.length}
              onClick={() => setPage(page + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
