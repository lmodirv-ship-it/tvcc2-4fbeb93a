import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Bell, Search, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, []);

  const initial = (email || "A").charAt(0).toUpperCase();

  return (
    <header className="h-16 flex items-center gap-4 border-b border-border bg-card/40 backdrop-blur px-5 sticky top-0 z-10">
      {/* Admin profile (right side in RTL) */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ background: "var(--gradient-primary)" }}
        >
          {initial}
        </div>
        <div className="hidden md:block">
          <div className="text-sm font-semibold leading-tight">Admin</div>
          <div className="text-[11px] text-muted-foreground">مدير النظام</div>
        </div>
      </div>

      <button className="relative w-9 h-9 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center justify-center">
        <SettingsIcon className="w-4 h-4 text-muted-foreground" />
      </button>
      <button className="relative w-9 h-9 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center justify-center">
        <Bell className="w-4 h-4 text-muted-foreground" />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
          5
        </span>
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xl mx-auto relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث..." className="pr-9 bg-secondary/40 border-border/50 h-10" />
      </div>

      <SidebarTrigger className="ml-auto" />
    </header>
  );
}
