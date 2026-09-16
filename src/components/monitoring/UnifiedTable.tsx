import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, ShieldCheck, FileDown } from "lucide-react";

function fmt(ts?: string | null) {
  return ts ? new Date(ts).toLocaleString("ar", { hour12: false }) : "—";
}

const PAGE = 40;

export function UnifiedTable({
  sites,
  servers,
  onProgram,
}: {
  sites: any[];
  servers: any[];
  onProgram: (websiteId: string, kind: "php" | "node" | "badge") => void;
}) {
  const [q, setQ] = useState("");
  const [serverFilter, setServerFilter] = useState("all");
  const [state, setState] = useState("all");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return sites.filter((s) => {
      if (term && ![s.name, s.domain, s.site_code, s.server_name, s.group].some((v) => String(v ?? "").toLowerCase().includes(term)))
        return false;
      if (serverFilter !== "all" && s.server_id !== serverFilter) return false;
      if (state === "connected" && !s.connected) return false;
      if (state === "noprogram" && s.program) return false;
      if (state === "offline" && s.status === "online") return false;
      return true;
    });
  }, [sites, q, serverFilter, state]);

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);

  const exportCsv = () => {
    const head = [
      "code",
      "name",
      "domain",
      "server",
      "server_online",
      "group",
      "services",
      "schedules",
      "program",
      "connected",
      "beacons",
      "last_beacon",
      "http",
      "ms",
      "ssl",
      "key",
    ];
    const lines = rows.map((s) =>
      [
        s.site_code,
        s.name,
        s.domain,
        s.server_name ?? "",
        s.server_online,
        s.group ?? "",
        (s.services ?? []).join("|"),
        s.schedules,
        s.program,
        s.connected,
        s.beacons,
        s.last_beacon_at ?? "",
        s.http_status ?? "",
        s.response_time_ms ?? "",
        s.ssl_valid ?? "",
        s.key_fingerprint ?? "",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tvcc-monitoring.csv";
    a.click();
  };

  return (
    <Card dir="rtl">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="size-4" /> المواقع والسيرفرات ({rows.length})
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 w-52 text-xs"
            placeholder="بحث بالموقع أو السيرفر أو المجموعة…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          <Select
            value={serverFilter}
            onValueChange={(v) => {
              setServerFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="كل السيرفرات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                كل السيرفرات
              </SelectItem>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name ?? s.hostname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={state}
            onValueChange={(v) => {
              setState(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                كل الحالات
              </SelectItem>
              <SelectItem value="connected" className="text-xs">
                متصل بالبرنامج
              </SelectItem>
              <SelectItem value="noprogram" className="text-xs">
                بدون برنامج
              </SelectItem>
              <SelectItem value="offline" className="text-xs">
                غير متصل
              </SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={exportCsv}>
            <FileDown className="size-3.5" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-xs">الموقع</TableHead>
                <TableHead className="text-xs">السيرفر</TableHead>
                <TableHead className="text-xs">المجموعة</TableHead>
                <TableHead className="text-xs">الخدمات</TableHead>
                <TableHead className="text-xs">المهام</TableHead>
                <TableHead className="text-xs">البرنامج</TableHead>
                <TableHead className="text-xs">الفحص</TableHead>
                <TableHead className="text-xs">المفتاح</TableHead>
                <TableHead className="text-xs">تنزيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((s) => (
                <TableRow key={s.id} className="text-xs">
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div dir="ltr" className="text-[10px] text-muted-foreground">
                      {s.site_code} · {s.domain}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.server_name ? (
                      <span className="inline-flex items-center gap-1">
                        <span className={`inline-block size-2 rounded-full ${s.server_online ? "bg-success" : "bg-destructive"}`} />
                        {s.server_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">بدون سيرفر</span>
                    )}
                    <div className="text-[10px] text-muted-foreground">{fmt(s.server_last_seen)}</div>
                  </TableCell>
                  <TableCell>{s.group ?? "—"}</TableCell>
                  <TableCell>
                    {(s.services ?? []).length ? (
                      <span>
                        {s.activeServices}/{s.services.length}
                        <div className="text-[10px] text-muted-foreground">{s.services.slice(0, 2).join("، ")}</div>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {s.schedules}
                    {s.lastScheduleStatus && <div className="text-[10px] text-muted-foreground">{s.lastScheduleStatus}</div>}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`inline-block size-2 rounded-full ${s.connected ? "bg-success" : s.program ? "bg-warning" : "bg-muted-foreground"}`}
                      />
                      {s.connected ? "متصل" : s.program ? "مسجّل" : "بدون برنامج"}
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      {s.beacons} نبضة · {fmt(s.last_beacon_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {s.ssl_valid === true && <ShieldCheck className="size-3.5 text-success" />}
                      {s.http_status ?? "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {s.response_time_ms ? `${s.response_time_ms} ms` : "—"} · {fmt(s.checked_at)}
                    </div>
                  </TableCell>
                  <TableCell dir="ltr" className="text-[10px]">
                    {s.key_fingerprint ? (
                      <>
                        {s.key_fingerprint}
                        <Badge variant="secondary" className="ms-1 text-[9px]">
                          v{s.key_version}
                        </Badge>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 space-x-reverse whitespace-nowrap">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onProgram(s.id, "php")}>
                      PHP
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onProgram(s.id, "node")}>
                      Node
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onProgram(s.id, "badge")}>
                      الشارة
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!pageRows.length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-xs text-muted-foreground">
                    لا نتائج.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {rows.length > PAGE && (
          <div className="flex items-center justify-between p-2 text-xs">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              السابق
            </Button>
            <span className="text-muted-foreground">
              صفحة {page + 1} من {Math.ceil(rows.length / PAGE)}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={(page + 1) * PAGE >= rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
