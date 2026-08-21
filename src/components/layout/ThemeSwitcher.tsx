import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY, applyTheme, type ThemeId } from "@/lib/themes";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const found = THEMES.find((t) => t.id === saved);
    if (found) {
      setTheme(found.id);
      applyTheme(found.id);
    }
  }, []);

  const pick = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="تغيير ثيم المنصة"
        title="ثيمات المنصة"
        className="flex items-center gap-2 h-9 px-3 rounded-lg bg-secondary/60 hover:bg-secondary text-sm font-medium transition"
      >
        <Palette className="w-4 h-4 text-primary" />
        <span className="hidden lg:inline">الثيمات</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>اختر مظهر المنصة</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => pick(t.id)} className="gap-3 cursor-pointer">
            <span className="flex items-center gap-1">
              {t.swatch.map((c) => (
                <span
                  key={c}
                  className="w-3.5 h-3.5 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="flex-1">{t.name}</span>
            <span className="text-[10px] text-muted-foreground">{t.mode === "light" ? "فاتح" : "داكن"}</span>
            {theme === t.id && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
