import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMonitoringSeries } from "@/lib/monitoring.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
];

export function MonitoringCharts() {
  const series = useServerFn(getMonitoringSeries);
  const { data, isLoading } = useQuery({
    queryKey: ["monitoring-series"],
    queryFn: () => series(),
    refetchInterval: 60000,
  });

  if (isLoading || !data) return <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل المخططات…</div>;

  const daily = (data.daily as any[]).map((d) => ({
    day: String(d.day).slice(5),
    محلي: Number(d.local_rows ?? 0),
    مرآة: Number(d.mirror_rows ?? 0),
    متصلة: Number(d.connected_sites ?? 0),
    نبضات: Number(d.beacons ?? 0),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2" dir="rtl">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">مواقع المجموعة حسب الحالة</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.statuses as any[]} dataKey="value" nameKey="name" outerRadius={80} label>
                {(data.statuses as any[]).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">مهام المحرّكات الدائمة</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.engines as any[]}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="engine" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="runs" name="تشغيلات" fill={COLORS[0]} />
              <Bar dataKey="ok" name="ناجحة" fill={COLORS[1]} />
              <Bar dataKey="failed" name="فاشلة" fill={COLORS[3]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">الصفوف المحلية مقابل المرآة عبر الزمن</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {daily.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="محلي" stroke={COLORS[0]} dot={false} />
                <Line type="monotone" dataKey="مرآة" stroke={COLORS[1]} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">
              لا لقطات بعد — اضغط «تسجيل العلاقات في قاعدة البيانات» لإنشاء أول لقطة يومية.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">نبضات المواقع والمواقع المتصلة</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {daily.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="متصلة" stroke={COLORS[2]} dot={false} />
                <Line type="monotone" dataKey="نبضات" stroke={COLORS[4]} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">لا بيانات زمنية بعد.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
