import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNav } from "@/components/site/PublicNav";
import { LiveBackdrop, Tilt3D } from "@/components/visual/LiveScene";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
  head: () => ({
    meta: [
      { title: "مدونة TVCC — دلائل إدارة المواقع والسيرفرات" },
      { name: "description", content: "مقالات تشرح منصة TVCC: إدارة المواقع، توثيق النطاقات، SSL، السيرفرات، المنافذ، والذكاء الاصطناعي." },
      { property: "og:title", content: "مدونة TVCC" },
      { property: "og:description", content: "دلائل عملية لإدارة المواقع والسيرفرات والخدمات من منصة TVCC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://tvcc.hnpay.live/blog" },
    ],
    links: [{ rel: "canonical", href: "https://tvcc.hnpay.live/blog" }],
  }),
});

function BlogIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ["blog-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id,slug,title,excerpt,category,cover_url,published_at")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen relative" dir="rtl">
      <LiveBackdrop className="opacity-60" />
      <PublicNav />

      <section className="container mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs mb-5">
          <BookOpen className="w-3.5 h-3.5" /> مدونة TVCC
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold">
          <span className="bg-gradient-to-l from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            كل ما تحتاج معرفته عن TVCC
          </span>
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          دلائل عملية تشرح كل ميزة في المنصة خطوة بخطوة.
        </p>
      </section>

      <section className="container mx-auto px-6 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(data ?? []).map((p) => (
              <Tilt3D key={p.id}>
                <Link to="/blog/$slug" params={{ slug: p.slug }} className="block h-full">
                  <Card className="h-full bg-card/60 ring-1 ring-border hover:ring-primary/50 transition">
                    <CardContent className="p-6 flex flex-col h-full">
                      {p.category && <Badge variant="secondary" className="w-fit mb-3">{p.category}</Badge>}
                      <h2 className="font-bold text-lg mb-2 leading-snug">{p.title}</h2>
                      <p className="text-sm text-muted-foreground flex-1">{p.excerpt}</p>
                      <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.published_at ? new Date(p.published_at).toLocaleDateString("ar-MA") : ""}</span>
                        <span className="inline-flex items-center gap-1 text-primary">اقرأ المقال <ArrowLeft className="w-3.5 h-3.5" /></span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </Tilt3D>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
