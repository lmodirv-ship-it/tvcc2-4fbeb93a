import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, Wallet, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment-accounts")({
  component: PaymentAccountsPage,
  head: () => ({ meta: [{ title: "حسابات الدفع — TVCC" }] }),
});

function PaymentAccountsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["payment-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["payment-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_orders").select("*").order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as any[];
    },
  });

  const toggle = async (id: string, field: string, value: boolean) => {
    await (supabase as any).from("payment_accounts").update({ [field]: value }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["payment-accounts"] });
  };

  const del = async (id: string) => {
    if (!confirm("حذف الحساب؟")) return;
    await supabase.from("payment_accounts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["payment-accounts"] });
  };

  const setStatus = async (id: string, status: string) => {
    await (supabase as any).from("payment_orders").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["payment-orders"] });
    toast.success("تم التحديث");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Wallet className="w-7 h-7 text-primary" /> حسابات الدفع — HNPay</h1>
          <p className="text-muted-foreground mt-1">
            الحسابات المرتبطة بمنصة <a className="text-primary" href="https://hnpay.live/" target="_blank" rel="noreferrer">hnpay.live <ExternalLink className="w-3 h-3 inline" /></a> لاستقبال مدفوعات الباقات.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> حساب جديد</Button></DialogTrigger>
          <AddAccount onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["payment-accounts"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التسمية</TableHead>
                <TableHead>البنك</TableHead>
                <TableHead>RIB / IBAN</TableHead>
                <TableHead>مفعّل</TableHead>
                <TableHead>افتراضي</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
              ) : !accounts?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد حسابات</TableCell></TableRow>
              ) : accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.label}</TableCell>
                  <TableCell>{a.bank_name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.rib}<br />{a.iban}</TableCell>
                  <TableCell><Switch checked={a.is_active} onCheckedChange={(v) => toggle(a.id, "is_active", v)} /></TableCell>
                  <TableCell><Switch checked={a.is_default} onCheckedChange={(v) => toggle(a.id, "is_default", v)} /></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => del(a.id)}><Trash2 className="w-3 h-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold mb-3">طلبات الشراء</h2>
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المرجع</TableHead>
                  <TableHead>الباقة</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>المشتري</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!orders?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد طلبات</TableCell></TableRow>
                ) : orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                    <TableCell>{o.plan_name}</TableCell>
                    <TableCell>${o.amount} / {o.billing_cycle === "yearly" ? "سنوي" : "شهري"}</TableCell>
                    <TableCell className="text-xs">{o.buyer_email}</TableCell>
                    <TableCell><Badge variant={o.status === "paid" ? "default" : "secondary"}>{o.status}</Badge></TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "paid")}>تأكيد الدفع</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, "cancelled")}>إلغاء</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AddAccount({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    label: "", bank_name: "", holder: "", account_number: "", rib: "", iban: "", swift: "",
    gateway_url: "https://hnpay.live/",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("payment_accounts").insert({ ...f, owner_id: user?.id ?? null });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تمت الإضافة");
    onDone();
  };

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>حساب دفع جديد</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        {[
          ["label", "التسمية"], ["bank_name", "اسم البنك"], ["holder", "صاحب الحساب"],
          ["account_number", "رقم الحساب"], ["rib", "RIB"], ["iban", "IBAN"], ["swift", "SWIFT"],
          ["gateway_url", "رابط بوابة الدفع"],
        ].map(([k, lbl]) => (
          <div className="space-y-1" key={k}>
            <Label>{lbl}</Label>
            <Input required={k === "label"} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
