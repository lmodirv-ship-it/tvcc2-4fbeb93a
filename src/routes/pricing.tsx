import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlans } from "@/lib/hosting.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Server, ShieldCheck, Database, HardDrive, Globe } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "باقات الاستضافة والنطاقات .HN — TVCC" },
      { name: "description", content: "استضافة سحابية على شبكة TVCC: مساحة تخزين، قاعدة بيانات معزولة، نطاق .HN عام، ونسخ احتياطي ثلاثي — تبدأ من 2$ شهرياً." },
      { property: "og:title", content: "باقات الاستضافة والنطاقات .HN — TVCC" },
      { property: "og:description", content: "استضافة، تخزين، قواعد بيانات معزولة ونطاقات .HN تبدأ من 2$ شهرياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://tvcc.hnpay.live/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://tvcc.hnpay.live/pricing" }],
  }),
});

const ISO_AR: Record<string, string> = {
  shared: "قاعدة مشتركة معزولة بـ RLS",
  schema: "Schema خاص بك",
  stack: "Stack مستقل كامل",
  dedicated: "خادم مخصّص",
};

function PricingPage() {
  const fn = useServerFn(listPlans);
  const { data, isLoading } = useQuery({ queryKey: ["public-plans"], queryFn: () => fn({}) });
  const plans = data?.plans ?? [];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between py-4">
          <Link to="/" className="font-bold text-xl">TVCC</Link>
          <Button asChild variant="outline"><Link to="/auth">تسجيل الدخول</Link></Button>
        </div>
      </header>

      <section className="container mx-auto py-14 text-center">
        <Badge className="mb-4">شبكة TVCC — 9 خوادم</Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">استضافة، تخزين، ونطاقات ‎.HN‎</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          كل موقع يحصل على مساحة تخزين، قاعدة بيانات معزولة على Supabase الخاصة بنا، نطاق ‎.HN‎ يعمل على الإنترنت العام،
          وثلاث نسخ من كل ملف مهم. تبدأ من <span className="text-primary font-bold">2$</span> شهرياً.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> شهادة HN-TLS + HN.RLS</span>
          <span className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> عزل بيانات كامل</span>
          <span className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" /> نسخ ثلاثي للملفات</span>
          <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> نطاق ‎.HN‎ عام</span>
        </div>
      </section>

      <section className="container mx-auto pb-20">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p: any, i: number) => (
              <Card key={p.id} className={i === 2 ? "border-primary shadow-lg relative" : "relative"}>
                {i === 2 && <Badge className="absolute -top-3 right-4">الأكثر طلباً</Badge>}
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">{p.name_ar || p.name}</h3>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="text-4xl font-bold text-primary">${p.price_monthly}</span>
                      <span className="text-muted-foreground text-sm mb-1">/شهر</span>
                    </div>
                    {p.price_yearly ? (
                      <p className="text-xs text-muted-foreground mt-1">أو ${p.price_yearly} سنوياً</p>
                    ) : null}
                  </div>
                  <ul className="space-y-2 text-sm">
                    <Feat>{p.storage_gb} جيجا مساحة تخزين</Feat>
                    <Feat>{p.sites_limit} موقع</Feat>
                    <Feat>{p.hn_domains_limit} نطاق ‎.HN‎ مجاني</Feat>
                    <Feat>{p.external_domains_limit} نطاق خارجي</Feat>
                    <Feat>{p.transfer_gb} جيجا نقل بيانات</Feat>
                    <Feat>{ISO_AR[p.db_isolation] ?? p.db_isolation} — {p.db_quota_mb} م.ب</Feat>
                    <Feat>نسخ احتياطي: {p.backup_policy}</Feat>
                    {(p.features?.list ?? []).map((f: string) => <Feat key={f}>{f}</Feat>)}
                  </ul>
                  <Button asChild className="w-full"><Link to="/checkout" search={{ plan: p.id }}>اشترِ الآن</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="border-t bg-muted/30">
        <div className="container mx-auto py-14 grid gap-6 md:grid-cols-3">
          <Info icon={Server} title="بنية 9 خوادم">
            تحكم، قاعدة أساسية ونسخة متزامنة، خوادم ويب، تخزين، نسخ احتياطي ومراقبة — توزيع تلقائي حسب باقتك.
          </Info>
          <Info icon={ShieldCheck} title="حماية وسرية">
            مفاتيح مشفّرة AES-256، لا يُمنح أي موقع مفتاح service_role، وعزل مستأجرين صارم عبر RLS.
          </Info>
          <Info icon={Globe} title="نطاق ‎.HN‎ عام">
            نطاقك يعمل داخل الشبكة المحلية وعلى الإنترنت عبر بوابة HTTPS مع شهادة موقّعة.
          </Info>
        </div>
      </section>
    </div>
  );
}

function Feat({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function Info({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Icon className="w-6 h-6 text-primary" />
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
