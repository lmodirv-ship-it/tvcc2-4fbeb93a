import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { getToolsForPage } from "@/lib/tools.functions";

/** بطاقات الأدوات المرتبطة بهذه الصفحة مع حالتها ورابط صفحة كل أداة. */
export function PageTools({ pagePath }: { pagePath: string }) {
  const fetchTools = useServerFn(getToolsForPage);
  const { data } = useQuery({
    queryKey: ["page-tools", pagePath],
    queryFn: () => fetchTools({ data: { pagePath } }),
    staleTime: 60_000,
  });

  if (!data?.length) return null;

  return (
    <Card dir="rtl">
      <CardContent className="flex flex-wrap items-center gap-2 p-3">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Wrench className="h-4 w-4" /> أدوات هذه الصفحة
        </span>
        {data.map((l: any) => (
          <Link key={l.id} to="/tools/$toolId" params={{ toolId: l.tool?.slug ?? "" }}>
            <Badge variant={l.installedCount ? "default" : "outline"} className="cursor-pointer">
              {l.tool?.name}
              {l.installedCount ? ` · ${l.installedCount}` : ""}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
