export type ThemeId =
  | "neon"
  | "midnight"
  | "aurora"
  | "sunset"
  | "emerald"
  | "royal"
  | "crimson"
  | "ocean"
  | "graphite"
  | "cyberpunk"
  | "gold"
  | "daylight"
  | "sand";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  mode: "dark" | "light";
  swatch: [string, string, string];
};

export const THEMES: ThemeDef[] = [
  { id: "neon", name: "نيون المؤسسة", mode: "dark", swatch: ["#1b2030", "#4c8dff", "#e8ecf5"] },
  { id: "midnight", name: "منتصف الليل", mode: "dark", swatch: ["#161824", "#7c86ff", "#eceafd"] },
  { id: "aurora", name: "الشفق القطبي", mode: "dark", swatch: ["#12242a", "#2ee6c0", "#e6fbf6"] },
  { id: "sunset", name: "الغروب", mode: "dark", swatch: ["#291a15", "#ff9d4d", "#fdeade"] },
  { id: "emerald", name: "الزمرد", mode: "dark", swatch: ["#12241d", "#34d399", "#e6fbf1"] },
  { id: "royal", name: "البنفسج الملكي", mode: "dark", swatch: ["#1e1830", "#a855f7", "#f2e9ff"] },
  { id: "crimson", name: "القرمزي", mode: "dark", swatch: ["#261416", "#ef4444", "#ffe9ea"] },
  { id: "ocean", name: "المحيط", mode: "dark", swatch: ["#12212e", "#38bdf8", "#e6f5ff"] },
  { id: "graphite", name: "الجرافيت", mode: "dark", swatch: ["#1e1e1e", "#d4d4d4", "#f5f5f5"] },
  { id: "cyberpunk", name: "سايبربانك", mode: "dark", swatch: ["#1a0f24", "#ff4fd8", "#f4e9ff"] },
  { id: "gold", name: "الذهبي", mode: "dark", swatch: ["#221d12", "#e3b341", "#f7efdd"] },
  { id: "daylight", name: "النهار", mode: "light", swatch: ["#f7f8fb", "#3b6cf6", "#1b1f2a"] },
  { id: "sand", name: "الرمال", mode: "light", swatch: ["#f6f0e4", "#a26b3c", "#3a2c1e"] },
];

export const THEME_STORAGE_KEY = "tvcc-theme";
export const DEFAULT_THEME: ThemeId = "neon";

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id === DEFAULT_THEME) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
