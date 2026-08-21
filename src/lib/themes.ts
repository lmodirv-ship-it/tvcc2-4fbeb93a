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
  { id: "neon", name: "نيون المؤسسة", mode: "dark", swatch: ["#1b2030", "#4c8dff", "#8b5cf6"] },
  { id: "midnight", name: "منتصف الليل", mode: "dark", swatch: ["#161824", "#7c86ff", "#a855f7"] },
  { id: "aurora", name: "الشفق القطبي", mode: "dark", swatch: ["#12242a", "#2ee6c0", "#22d3ee"] },
  { id: "sunset", name: "الغروب", mode: "dark", swatch: ["#291a15", "#ff9d4d", "#f43f5e"] },
  { id: "emerald", name: "الزمرد", mode: "dark", swatch: ["#12241d", "#34d399", "#22d3ee"] },
  { id: "royal", name: "البنفسج الملكي", mode: "dark", swatch: ["#1e1830", "#a855f7", "#f472b6"] },
  { id: "crimson", name: "القرمزي", mode: "dark", swatch: ["#261416", "#ef4444", "#fb7185"] },
  { id: "ocean", name: "المحيط", mode: "dark", swatch: ["#12212e", "#38bdf8", "#22d3ee"] },
  { id: "graphite", name: "الجرافيت", mode: "dark", swatch: ["#1e1e1e", "#d4d4d4", "#8a8a8a"] },
  { id: "cyberpunk", name: "سايبربانك", mode: "dark", swatch: ["#1a0f24", "#ff4fd8", "#25f4ee"] },
  { id: "gold", name: "الذهبي", mode: "dark", swatch: ["#221d12", "#e3b341", "#c98b3a"] },
  { id: "daylight", name: "النهار", mode: "light", swatch: ["#f7f8fb", "#3b6cf6", "#8b5cf6"] },
  { id: "sand", name: "الرمال", mode: "light", swatch: ["#f6f0e4", "#a26b3c", "#c2562f"] },
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
