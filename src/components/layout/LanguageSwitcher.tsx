import { useTranslation } from "react-i18next";
import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, setLanguage, type AppLang } from "@/i18n";
import { toast } from "sonner";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.language?.slice(0, 2) as AppLang) || "ar";
  const active = LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 px-3 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center gap-2 text-xs font-medium"
          aria-label={t("header.language")}
        >
          <Languages className="w-4 h-4 text-muted-foreground" />
          <span>{active.flag}</span>
          <span className="hidden md:inline">{active.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>{t("header.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={async () => {
              await setLanguage(l.code);
              toast.success(t("toast.language_changed"));
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="text-base">{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {l.code === current && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
