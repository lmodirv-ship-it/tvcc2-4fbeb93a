import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ar from "./ar.json";
import fr from "./fr.json";
import en from "./en.json";

export type AppLang = "ar" | "fr" | "en";

export const LANGUAGES: { code: AppLang; label: string; flag: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", label: "العربية", flag: "🇲🇦", dir: "rtl" },
  { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "en", label: "English", flag: "🇺🇸", dir: "ltr" },
];

export const STORAGE_KEY = "tvcc.lang";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        ar: { translation: ar },
        fr: { translation: fr },
        en: { translation: en },
      },
      fallbackLng: "ar",
      supportedLngs: ["ar", "fr", "en"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: STORAGE_KEY,
        caches: ["localStorage"],
      },
    });
}

export function applyDirection(lang: string) {
  if (typeof document === "undefined") return;
  const def = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  document.documentElement.lang = def.code;
  document.documentElement.dir = def.dir;
}

export async function setLanguage(lang: AppLang) {
  await i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  applyDirection(lang);
}

export function formatNumber(value: number, lang?: string) {
  const l = lang ?? i18n.language ?? "ar";
  const locale = l === "ar" ? "ar-MA" : l === "fr" ? "fr-FR" : "en-US";
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(value: Date | string | number, lang?: string) {
  const l = lang ?? i18n.language ?? "ar";
  const locale = l === "ar" ? "ar-MA" : l === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default i18n;
