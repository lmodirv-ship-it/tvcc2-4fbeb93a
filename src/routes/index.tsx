import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe, Shield, Bell, Zap, Database, HardDrive,
  Activity, Layers, ArrowLeft, CheckCircle2, Sparkles, Users, BookOpen, Cloud,
} from "lucide-react";
import { PublicNav } from "@/components/site/PublicNav";
import { LiveBackdrop, Tilt3D } from "@/components/visual/LiveScene";
import tvccLogo from "@/assets/tvcc-logo.asset.json";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "TVCC — مركز قيادة المواقع" },
      { name: "description", content: "منصة موحّدة لإدارة جميع مشاريعك ومواقعك، مراقبة SSL والدومينات والتنبيهات من لوحة واحدة." },
    ],
  }),
});

function LandingPage() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSignedIn(!!session));
  }, []);

  const { data: brand } = useQuery({
    queryKey: ["brand"],
    queryFn: async () => (await supabase.from("brand_settings").select("*").maybeSingle()).data,
  });

  const logo = brand?.logo_url || tvccLogo.url;
  const name = brand?.name || "TVCC";
  const tagline = brand?.tagline || "SECURE • VERIFY • PROTECT";

  const features = [
    { icon: Globe, title: "إدارة المواقع", desc: "كل مواقعك في مكان واحد مع الحالة الحيّة والدومينات." },
    { icon: Shield, title: "مراقبة SSL", desc: "تتبّع شهادات SSL/TLS وتنبيهات قبل الانتهاء." },
    { icon: Bell, title: "تنبيهات فورية", desc: "إشعارات Realtime + قنوات Email و Telegram و Webhook." },
    { icon: Zap, title: "محرّر متقدّم", desc: "15 قسم لتحرير الموقع: SEO, محتوى, تصميم, سكربتات..." },
    { icon: Database, title: "HN-DB & HN-Cloud", desc: "تكامل أصلي مع قواعد البيانات والتخزين السحابي." },
    { icon: Activity, title: "مراقبة الأداء", desc: "Health checks، تقارير، وسجل عمليات كامل." },
  ];

  const services = [
    { icon: Cloud, title: "استضافة سحابية", desc: "من 2$ شهرياً مع تفعيل فوري" },
    { icon: Globe, title: "نطاقات ‎.HN‎", desc: "نطاق خاص يعمل على الإنترنت" },
    { icon: Database, title: "قواعد بيانات معزولة", desc: "عزل كامل وحماية RLS" },
    { icon: HardDrive, title: "تخزين ونسخ ثلاثي", desc: "نسخ احتياطي على 3 خوادم" },
  ];

  const stats = [
    { label: "مواقع مُدارة", value: "∞" },
    { label: "وقت تشغيل", value: "99.9%" },
    { label: "تكاملات", value: "12+" },
    { label: "لغات", value: "AR · FR · EN" },
  ];


  return (
    <div className="min-h-screen relative" dir="rtl">
      <LiveBackdrop className="opacity-70" />
      <PublicNav logo={logo} name={name} tagline={tagline} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{
          background: "radial-gradient(800px 400px at 80% 10%, oklch(0.7 0.18 245 / 0.18), transparent 60%), radial-gradient(700px 400px at 10% 50%, oklch(0.55 0.22 295 / 0.15), transparent 60%)",
        }} />
        <div className="container mx-auto px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            مركز قيادة موحّد لجميع مشاريعك
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight">
            <span className="bg-gradient-to-l from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              {name}
            </span>
            <br />
            <span className="text-foreground">مركز إدارة المواقع</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            منصة شخصية متكاملة لإدارة كل مشاريعك ومواقعك — المراقبة، الدومينات، SSL، التنبيهات، والتكامل مع HN-DB و HN-Cloud من لوحة واحدة.
          </p>
          <div className="mt-10 flex flex-col items-center gap-5">
            <Button
              size="lg"
              className="hn-cta-rainbow text-lg md:text-xl font-bold px-12 py-7 rounded-2xl border-0 hover:-translate-y-1 transition"
              asChild
            >
              <Link to="/pricing">
                <Sparkles className="w-6 h-6 ml-2" />
                أنشئ موقعك الآن
                <ArrowLeft className="w-6 h-6 mr-2" />
              </Link>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="hn-cta-glow text-base md:text-lg font-bold px-14 py-6 rounded-2xl border-2 border-primary/50 hover:-translate-y-0.5 transition"
              onClick={() => navigate({ to: signedIn ? "/dashboard" : "/auth" })}
            >
              <Layers className="w-5 h-5 ml-2" />
              مركز إدارة المواقع
            </Button>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button size="sm" variant="outline" className="rounded-xl gap-2" asChild>
                <Link to="/pricing"><Cloud className="w-4 h-4" /> الباقات والاستضافة</Link>
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl gap-2" asChild>
                <Link to="/blog"><BookOpen className="w-4 h-4" /> المدونة</Link>
              </Button>
              <Button size="sm" variant="ghost" className="rounded-xl" asChild>
                <a href="#features">استكشف المزايا</a>
              </Button>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" />Realtime</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" />RLS Secure</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" />Multi-language</div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="container mx-auto px-6 py-10">
        <h2 className="text-center text-2xl md:text-3xl font-bold mb-8">خدماتنا</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {services.map((s) => (
            <Card key={s.title} className="bg-card/70 ring-1 ring-primary/20 hover:ring-primary/50 transition">
              <CardContent className="p-5 text-center">
                <s.icon className="w-7 h-7 text-primary mx-auto mb-3" />
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* PLANS PREVIEW */}
      <section id="plans" className="container mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold">الباقات — تبدأ من 2$</h2>
          <p className="text-muted-foreground mt-2">استضافة + مساحة تخزين + نطاق ‎.HN‎ + قاعدة بيانات معزولة</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(plans ?? []).slice(0, 4).map((p: any, i: number) => (
            <Card key={p.id} className={`bg-card/70 ${i === 2 ? "ring-2 ring-primary" : "ring-1 ring-border"}`}>
              <CardContent className="p-6 space-y-3">
                <div className="font-bold text-lg">{p.name_ar || p.name}</div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-extrabold text-primary">${p.price_monthly}</span>
                  <span className="text-xs text-muted-foreground mb-1">/شهر</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>{p.storage_gb} جيجا تخزين</li>
                  <li>{p.sites_limit} موقع</li>
                  <li>{p.hn_domains_limit} نطاق ‎.HN‎</li>
                </ul>
                <Button asChild className="w-full"><Link to="/checkout" search={{ plan: p.id }}>اشترِ الآن</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="text-center mt-6">
          <Button variant="outline" asChild><Link to="/pricing">كل تفاصيل الباقات</Link></Button>
        </div>
      </section>


      {/* STATS */}
      <section id="stats" className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="bg-card/60 ring-1 ring-primary/20">
              <CardContent className="p-6 text-center">
                <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-l from-primary to-primary-glow bg-clip-text text-transparent">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-2">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">كل ما تحتاجه لإدارة مواقعك</h2>
          <p className="text-muted-foreground mt-3">منظومة متكاملة مبنية على أحدث التقنيات</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <Tilt3D key={f.title}>
            <Card className="h-full bg-card/60 ring-1 ring-border hover:ring-primary/40 transition">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
            </Tilt3D>
          ))}
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" className="container mx-auto px-6 py-20">
        <Card className="bg-gradient-to-bl from-primary/10 via-card/60 to-accent/10 ring-1 ring-primary/30">
          <CardContent className="p-10 md:p-14 text-center">
            <Layers className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold">تكامل أصلي مع HN-DB و HN-Cloud</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              تتبّع قواعد البيانات، التخزين السحابي، إصدارات APK، والاسترجاع — كلها مربوطة بمواقعك.
            </p>
            <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/80 ring-1 ring-border">
                <Database className="w-5 h-5 text-success" /><span className="font-medium">HN-DB</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/80 ring-1 ring-border">
                <HardDrive className="w-5 h-5 text-warning" /><span className="font-medium">HN-Cloud</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/80 ring-1 ring-border">
                <Users className="w-5 h-5 text-primary" /><span className="font-medium">Lovable</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold">جاهز لتنظيم كل شيء؟</h2>
        <p className="text-muted-foreground mt-3">ابدأ بإضافة موقعك الأول الآن.</p>
        <Button size="lg" className="mt-8 text-base px-10" onClick={() => navigate({ to: signedIn ? "/dashboard" : "/auth" })}>
          {signedIn ? "لوحة التحكم" : "إنشاء حساب"}
          <ArrowLeft className="w-5 h-5 mr-2" />
        </Button>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 mt-10">
        <div className="container mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt={name} className="w-6 h-6 rounded" />
            <span>© 2026 {name} — جميع الحقوق محفوظة</span>
          </div>
          <div className="flex gap-6">
            <Link to="/auth" className="hover:text-foreground">دخول</Link>
            <Link to="/pricing" className="hover:text-foreground">الباقات</Link>
            <Link to="/blog" className="hover:text-foreground">المدونة</Link>
            <a href="#features" className="hover:text-foreground">المزايا</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
