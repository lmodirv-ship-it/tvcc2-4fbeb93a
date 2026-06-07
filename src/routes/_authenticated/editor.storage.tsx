import { createFileRoute } from "@tanstack/react-router";
import { HardDrive } from "lucide-react";
import { BulkEditor, Field } from "@/components/editor/BulkEditor";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/editor/storage")({
  component: () => (
    <BulkEditor
      title="Storage Editor"
      subtitle="إدارة مساحات التخزين، ربط الملفات، وتغيير Storage Provider"
      icon={HardDrive}
      settingKey="storage"
      renderForm={({ values, setVal }) => (
        <div className="space-y-3">
          <Field label="مزود التخزين">
            <Select value={values.provider || ""} onValueChange={(v) => setVal("provider", v)}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="s3">Amazon S3</SelectItem>
                <SelectItem value="r2">Cloudflare R2</SelectItem>
                <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                <SelectItem value="local">Local (VPS)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bucket Name"><Input value={values.bucket || ""} onChange={(e) => setVal("bucket", e.target.value)} /></Field>
          <Field label="Region"><Input placeholder="eu-west-1" value={values.region || ""} onChange={(e) => setVal("region", e.target.value)} /></Field>
          <Field label="حد الحجم (GB)"><Input type="number" value={values.size_gb || ""} onChange={(e) => setVal("size_gb", Number(e.target.value))} /></Field>
          <Field label="CDN Endpoint"><Input placeholder="https://cdn..." value={values.cdn || ""} onChange={(e) => setVal("cdn", e.target.value)} /></Field>
          <div className="flex items-center justify-between rounded border border-border/40 p-3">
            <Switch checked={!!values.sync_files} onCheckedChange={(c) => setVal("sync_files", c)} />
            <Label>مزامنة الملفات بعد التطبيق</Label>
          </div>
        </div>
      )}
    />
  ),
});
