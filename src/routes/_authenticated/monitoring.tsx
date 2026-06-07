import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/monitoring")({
  component: () => (
    <div className="space-y-6">
      <div dir="rtl">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Radio className="w-7 h-7 text-primary" /> المراقبة
        </h1>
        <p className="text-muted-foreground mt-1">حالة فورية لجميع مواقعك في مكان واحد</p>
      </div>
      <Card><CardContent className="p-16 text-center text-muted-foreground" dir="rtl">
        <Radio className="w-12 h-12 mx-auto mb-3 opacity-40" />
        قيد التطوير — يأتي ضمن الدفعة B
      </CardContent></Card>
    </div>
  ),
  head: () => ({ meta: [{ title: "المراقبة — TVCC" }] }),
});
