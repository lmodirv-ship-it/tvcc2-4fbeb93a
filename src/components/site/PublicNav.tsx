import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { BookOpen, LogIn, LayoutDashboard, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import tvccLogo from "@/assets/tvcc-logo.asset.json";

export function PublicNav({ logo, name, tagline }: { logo?: string; name?: string; tagline?: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSignedIn(!!session));
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img
            src={logo || tvccLogo.url}
            alt={name || "TVCC"}
            className="w-10 h-10 rounded-xl object-cover"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          />
          <div className="leading-tight hidden sm:block">
            <div className="font-bold text-lg">{name || "TVCC"}</div>
            <div className="text-[10px] text-muted-foreground tracking-widest">
              {tagline || "SECURE • VERIFY • PROTECT"}
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition">الرئيسية</Link>
          <Link to="/blog" className="hover:text-foreground transition">المدونة</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/blog"><BookOpen className="w-4 h-4" />المدونة</Link>
          </Button>
          <LanguageSwitcher />
          {signedIn ? (
            <Button asChild size="sm" className="gap-2">
              <Link to="/dashboard"><LayoutDashboard className="w-4 h-4" />لوحة التحكم<ArrowLeft className="w-4 h-4" /></Link>
            </Button>
          ) : (
            <Button asChild size="sm" className="gap-2">
              <Link to="/auth"><LogIn className="w-4 h-4" />تسجيل الدخول</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
