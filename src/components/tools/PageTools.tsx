import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Wrench } from "lucide-react";
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
          <span key={l.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
            <Badge variant={l.installedCount ? "default" : "outline"}>
              {l.tool?.name}
              {l.installedCount ? ` · ${l.installedCount}` : ""}
            </Badge>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" asChild>
              <Link to="/tools/$toolId" params={{ toolId: l.tool?.slug ?? "" }}>
                <ExternalLink className="me-1 h-3 w-3" /> فتح
              </Link>
            </Button>
          </span>
        ))}
      </CardContent>
    </Card>
  );
}
