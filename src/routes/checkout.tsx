import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCheckoutPaymentAccount } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, ShieldCheck, Wallet, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PublicNav } from "@/components/site/PublicNav";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  validateSearch: (s: Record<string, unknown>) => ({ plan: (s.plan as string) || "" }),
  head: () => ({
    meta: [
      { title: "إتمام الشراء — TVCC عبر HNPay" },
      { name: "description", content: "أتمم شراء باقة الاستضافة عبر التحويل البنكي أو منصة HNPay للدفع الخاصة بمجموعة HN." },
      { property: "og:title", content: "إتمام الشراء — TVCC عبر HNPay" },
      { property: "og:description", content: "الدفع عبر التحويل البنكي أو بوابة HNPay مع تأكيد فوري لطلبك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CheckoutPage() {
  const { plan: planId } = Route.useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ reference: string } | null>(null);

  const { data: plan } = useQuery({
    queryKey: ["checkout-plan", planId],
    enabled: !!planId,
    queryFn: async () =>
      (await supabase.from("hosting_plans").select("*").eq("id", planId).maybeSingle()).data as any,
  });

  const loadAccount = useServerFn(getCheckoutPaymentAccount);
  const { data: account, isLoading } = useQuery({
    queryKey: ["payment-account-default"],
    queryFn: async () => {
      try {
        const r: any = await loadAccount({});
        return r?.account ?? null;
      } catch {
        return null;
      }
    },
  });

  const amount = plan ? (cycle === "yearly" ? plan.price_yearly || plan.price_monthly * 12 : plan.price_monthly) : 0;

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("تم النسخ");
  };

  const submit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("سجّل الدخول أولاً لإتمام الطلب");
      return;
    }
    if (!plan?.id) {
      toast.error("اختر باقة أولاً");
      return;
    }
    setSaving(true);
    try {
      const r: any = await createOrder({
        data: {
          planId: plan.id as string,
          cycle,
          buyerName: name || null,
          buyerEmail: email || user.email || null,
        },
      });
      setDone({ reference: r?.reference ?? "" });
      toast.success("تم تسجيل طلبك");
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تسجيل الطلب");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <PublicNav />
      <div className="container mx-auto px-6 py-12 max-w-5xl space-y-8">
        <div className="text-center">
          <Badge className="mb-3">HNPay — بوابة الدفع لمجموعة HN</Badge>
          <h1 className="text-3xl md:text-4xl font-bold">إتمام الشراء</h1>
          <p className="text-muted-foreground mt-2">
            {plan ? `الباقة: ${plan.name_ar || plan.name}` : "اختر باقة من صفحة الباقات"}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 font-semibold"><Wallet className="w-5 h-5 text-primary" /> حساب استقبال الدفع</div>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : !account ? (
                <p className="text-sm text-muted-foreground">لم يتم إعداد حساب دفع بعد.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <Row label="البنك" value={account.bank_name} onCopy={copy} />
                  <Row label="صاحب الحساب" value={account.holder} onCopy={copy} />
                  <Row label="رقم الحساب" value={account.account_number} onCopy={copy} />
                  <Row label="RIB" value={account.rib} onCopy={copy} />
                  <Row label="IBAN" value={account.iban} onCopy={copy} />
                  <Button asChild variant="outline" className="w-full mt-2 gap-2">
                    <a href={account.gateway_url || "https://hnpay.live/"} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4" /> الدفع عبر HNPay
                    </a>
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                بعد التحويل أرسل رقم المرجع لتفعيل الباقة خلال دقائق.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              {done ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                  <h3 className="font-bold text-lg">تم تسجيل طلبك</h3>
                  <p className="text-sm text-muted-foreground">رقم المرجع</p>
                  <div className="font-mono text-xl">{done.reference}</div>
                  <Button asChild variant="outline"><Link to="/my-hosting">استضافتي</Link></Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">المبلغ</span>
                    <span className="text-2xl font-bold text-primary">${amount}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant={cycle === "monthly" ? "default" : "outline"} className="flex-1" onClick={() => setCycle("monthly")}>شهري</Button>
                    <Button variant={cycle === "yearly" ? "default" : "outline"} className="flex-1" onClick={() => setCycle("yearly")}>سنوي</Button>
                  </div>
                  <div className="space-y-2"><Label>الاسم الكامل</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <Button className="w-full" disabled={saving || !plan} onClick={submit}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} تأكيد الطلب
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    ليس لديك حساب؟ <Link to="/auth" className="text-primary">سجّل الدخول</Link>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, onCopy }: { label: string; value?: string | null; onCopy: (v: string) => void }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-mono text-xs">
        {value}
        <button onClick={() => onCopy(value)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
      </span>
    </div>
  );
}
