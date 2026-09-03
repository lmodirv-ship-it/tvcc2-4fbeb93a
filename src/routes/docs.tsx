import { createFileRoute } from "@tanstack/react-router";
import { PublicNav } from "@/components/site/PublicNav";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "التوثيق — منصة TVCC لإدارة المواقع والخوادم" },
      { name: "description", content: "دليل استخدام منصة TVCC: منارة، الخوادم، الوكيل، النطاقات، النسخ الاحتياطي، والنشر الموحد." },
      { property: "og:title", content: "التوثيق — منصة TVCC" },
      { property: "og:description", content: "دليل استخدام منصة TVCC ووكيل الخوادم ومنارة." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocsPage,
});

const SECTIONS = [
  {
    title: "منارة — مركز التوجيه الحي",
    body: "المصدر الوحيد للحقيقة لعناوين المشاريع: تسجيل عنوان جديد، التحقق، النشر، وتصحيح التوجيه تلقائياً عبر Nginx وDNS.",
  },
  {
    title: "وكيل TVCC على الخوادم",
    body: "يُثبَّت على كل خادم، يرسل نبضاً دورياً بحالة المعالج والذاكرة والقرص والمنافذ، ويستقبل المهام والأدوار من قاعدة البيانات لتنفيذها بصلاحيات محددة.",
  },
  {
    title: "إجراءات المواقع",
    body: "فتح الموقع، اختبار الهوية والتوجيه، عرض المسار الكامل Domain → DNS → TVCC → Server:Port → Project، السجلات، إعادة التشغيل، وضع الصيانة، والرجوع لإصدار سابق.",
  },
  {
    title: "الإجراءات الجماعية",
    body: "فحص هوية جميع المواقع، مزامنة العناوين مع منارة، فحص دوري كل 3 دقائق، تجديد شهادات SSL القريبة من الانتهاء، وتصدير التقارير.",
  },
  {
    title: "النطاقات والاستضافة",
    body: "إنشاء نطاقات ‎.HN‎، ربطها بالخوادم المحلية وVPS، وإصدار شهادات HN-TLS بعد التحقق من الملكية.",
  },
];

function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <h1 className="text-3xl font-black mb-2">التوثيق</h1>
        <p className="text-muted-foreground mb-8">
          دليل مختصر لاستخدام منصة TVCC في إدارة المواقع والخوادم والنطاقات.
        </p>
        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.title} className="glass-card rounded-2xl p-5">
              <h2 className="font-bold mb-2">{s.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
