import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicNav } from "@/components/site/PublicNav";
import { LiveBackdrop } from "@/components/visual/LiveScene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPost,
  head: ({ params }) => ({
    meta: [
      { title: `مقال ${params.slug} — مدونة TVCC` },
      { name: "description", content: "مقال من مدونة TVCC يشرح إحدى مزايا منصة إدارة المواقع والسيرفرات." },
      { property: "og:title", content: "مدونة TVCC" },
      { property: "og:description", content: "دلائل عملية لإدارة المواقع والسيرفرات من منصة TVCC." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function BlogPost() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen relative" dir="rtl">
      <LiveBackdrop className="opacity-50" />
      <PublicNav />

      <article className="container mx-auto px-6 py-14 max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="mb-6 gap-2">
          <Link to="/blog"><ArrowRight className="w-4 h-4" /> كل المقالات</Link>
        </Button>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : !data ? (
          <div className="py-20 text-center">
            <h1 className="text-2xl font-bold">المقال غير موجود</h1>
            <p className="text-muted-foreground mt-2">ربما تم حذفه أو لم يُنشر بعد.</p>
          </div>
        ) : (
          <>
            {data.category && <Badge variant="secondary" className="mb-4">{data.category}</Badge>}
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">{data.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{data.excerpt}</p>
            <div className="mt-3 text-xs text-muted-foreground">
              {data.published_at ? new Date(data.published_at).toLocaleDateString("ar-MA") : ""}
            </div>
            <div className="h-px bg-border my-8" />
            <Markdown source={data.content || ""} />
          </>
        )}
      </article>
    </div>
  );
}
