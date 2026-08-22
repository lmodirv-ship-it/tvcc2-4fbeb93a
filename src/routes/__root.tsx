import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import "@/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة التي تبحث عنها غير متوفرة.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">حاول إعادة تحميل الصفحة.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TVCC — مركز قيادة المواقع" },
      { name: "description", content: "منصة موحّدة لإدارة جميع مشاريعك ومواقعك، مراقبة SSL والدومينات والتنبيهات من لوحة واحدة." },
      { property: "og:title", content: "TVCC — مركز قيادة المواقع" },
      { name: "twitter:title", content: "TVCC — مركز قيادة المواقع" },
      { property: "og:description", content: "منصة موحّدة لإدارة جميع مشاريعك ومواقعك، مراقبة SSL والدومينات والتنبيهات من لوحة واحدة." },
      { name: "twitter:description", content: "منصة موحّدة لإدارة جميع مشاريعك ومواقعك، مراقبة SSL والدومينات والتنبيهات من لوحة واحدة." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e3facb8c-8ef1-4252-aefe-4846316c0cc9/id-preview-207d6b71--9b50cc0f-c6df-42a9-977c-c23b34cb99ba.lovable.app-1780877571617.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e3facb8c-8ef1-4252-aefe-4846316c0cc9/id-preview-207d6b71--9b50cc0f-c6df-42a9-977c-c23b34cb99ba.lovable.app-1780877571617.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/__l5e/assets-v1/cabd42ee-a07c-45eb-ac0f-021341b6d445/tvcc-logo.jpeg" },
      { rel: "apple-touch-icon", href: "/__l5e/assets-v1/cabd42ee-a07c-45eb-ac0f-021341b6d445/tvcc-logo.jpeg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    import("@/i18n").then(({ applyDirection, default: i18n }) => {
      applyDirection(i18n.language);
      const onChange = (lng: string) => applyDirection(lng);
      i18n.on("languageChanged", onChange);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1"><Outlet /></div>
        <footer className="border-t border-border/60 bg-background/60 py-4 text-center text-xs text-muted-foreground" dir="rtl">
          © 2026 جميع الحقوق محفوظة El Hassani Moulay Ismail · Groupe HN
        </footer>
      </div>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

