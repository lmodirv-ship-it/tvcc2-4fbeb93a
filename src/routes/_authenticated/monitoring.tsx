import { createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { MonitoringHub } from "@/components/monitoring/MonitoringHub";

export const Route = createFileRoute("/_authenticated/monitoring")({
  component: MonitoringPage,
  head: () => ({ meta: [{ title: "مركز المراقبة — TVCC" }] }),
});

function MonitoringPage() {
  return (
    <div className="space-y-4" dir="rtl">
      <div className="text-right">
        <h1 className="flex items-center justify-end gap-2 text-3xl font-bold">
          <Radio className="size-7 text-primary" /> مركز المراقبة
        </h1>
        <p className="mt-1 text-muted-foreground">
          جدول موحّد للمواقع والسيرفرات، المحرّكات الدائمة، المزامنة، المفاتيح والأمان، والمخططات الحيّة.
        </p>
      </div>
      <MonitoringHub />
    </div>
  );
}
