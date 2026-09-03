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
import { THEMES, DEFAULT_THEME, applyTheme, readStoredTheme, type ThemeId } from "@/lib/themes";
import { loadUserPreferences, saveUserPreferences } from "@/lib/user-preferences";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const saved = readStoredTheme();
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    }
    // الحساب هو المصدر النهائي: يستعيد نفس المظهر على أي جهاز
    loadUserPreferences()
      .then((prefs) => {
        const id = prefs?.theme_id as ThemeId | undefined;
        if (id && THEMES.some((t) => t.id === id) && id !== saved) {
          setTheme(id);
          applyTheme(id);
        }
      })
      .catch(() => undefined);
  }, []);

  const pick = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    void saveUserPreferences({ theme_id: id }).catch(() => undefined);
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
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>اختر مظهر المنصة</DropdownMenuLabel>
        <div className="px-2 pb-1 text-[10px] text-muted-foreground">
          يمين: الخلفية · الوسط: الأزرار · يسار: الكتابة
        </div>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => pick(t.id)} className="gap-3 cursor-pointer">
            {/* RTL row: first swatch renders on the right = background, then buttons, then text */}
            <span className="flex items-center gap-1">
              <span
                className="w-3.5 h-3.5 rounded-full border border-border"
                style={{ backgroundColor: t.swatch[0] }}
                title="الخلفية"
              />
              <span
                className="w-3.5 h-3.5 rounded-full border border-border"
                style={{ backgroundColor: t.swatch[1] }}
                title="الأزرار"
              />
              <span
                className="w-3.5 h-3.5 rounded-full border border-border"
                style={{ backgroundColor: t.swatch[2] }}
                title="الكتابة"
              />
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
