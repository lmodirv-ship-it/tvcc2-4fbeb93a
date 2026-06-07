import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  component: Page,
  head: () => ({ meta: [{ title: "سجل العمليات — TVCC" }] }),
});

function Page() {
  const { data, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">سجل العمليات</h1>
        <p className="text-muted-foreground mt-1">آخر 100 عملية</p>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>العملية</TableHead><TableHead>النوع</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow> :
                !data?.length ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا يوجد نشاط</TableCell></TableRow> :
                data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.action}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.entity_type || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(a.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
