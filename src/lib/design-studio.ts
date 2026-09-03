export type DesignTokens = {
  theme_id?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  font_family?: string | null;
  radius?: string | null;
  shadow?: string | null;
};

export const DESIGN_STORAGE_KEY = "tvcc-design";

export const FONT_OPTIONS = [
  { value: "Cairo", label: "Cairo — عربي عصري" },
  { value: "Tajawal", label: "Tajawal — عربي ناعم" },
  { value: "system-ui", label: "System UI — النظام" },
];

export const RADIUS_OPTIONS = [
  { value: "0.25rem", label: "حاد" },
  { value: "0.5rem", label: "افتراضي" },
  { value: "0.75rem", label: "ناعم" },
  { value: "1.25rem", label: "دائري" },
];

export const SHADOW_OPTIONS = [
  { value: "none", label: "بدون ظل" },
  { value: "0 4px 16px -6px rgba(0,0,0,.35)", label: "خفيف" },
  { value: "0 10px 30px -10px rgba(0,0,0,.45)", label: "أنيق" },
  { value: "0 22px 60px -18px rgba(0,0,0,.6)", label: "عميق" },
];

export const PRESETS: { id: string; name: string; tokens: DesignTokens }[] = [
  {
    id: "hn-corporate",
    name: "HN مؤسسي",
    tokens: { primary_color: "#4c8dff", accent_color: "#8b5cf6", font_family: "Cairo", radius: "0.5rem", shadow: SHADOW_OPTIONS[2]!.value },
  },
  {
    id: "hn-emerald",
    name: "HN زمردي",
    tokens: { primary_color: "#34d399", accent_color: "#22d3ee", font_family: "Cairo", radius: "0.75rem", shadow: SHADOW_OPTIONS[1]!.value },
  },
  {
    id: "hn-gold",
    name: "HN ذهبي",
    tokens: { primary_color: "#e3b341", accent_color: "#c98b3a", font_family: "Tajawal", radius: "1.25rem", shadow: SHADOW_OPTIONS[3]!.value },
  },
];

function hexToTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return `srgb ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
}

function setColor(root: HTMLElement, cssVar: string, value?: string | null) {
  if (!value) {
    root.style.removeProperty(cssVar);
    return;
  }
  const triplet = hexToTriplet(value);
  root.style.setProperty(cssVar, triplet ? `color(${triplet})` : value);
}

export function applyDesignTokens(
  tokens: DesignTokens | null | undefined,
  opts: { skipColors?: boolean } = {},
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!tokens) return;

  if (!opts.skipColors) {
    setColor(root, "--primary", tokens.primary_color);
    setColor(root, "--ring", tokens.primary_color);
    setColor(root, "--sidebar-primary", tokens.primary_color);
    setColor(root, "--accent", tokens.accent_color);
    setColor(root, "--background", tokens.background_color);

    if (tokens.primary_color && tokens.accent_color) {
      root.style.setProperty(
        "--gradient-primary",
        `linear-gradient(135deg, ${tokens.primary_color}, ${tokens.accent_color})`,
      );
    }
  }

  if (tokens.font_family) root.style.setProperty("--font-sans", `${tokens.font_family}, system-ui, sans-serif`);
  else root.style.removeProperty("--font-sans");

  if (tokens.radius) root.style.setProperty("--radius", tokens.radius);
  else root.style.removeProperty("--radius");

  if (tokens.shadow) {
    root.style.setProperty("--shadow-card", tokens.shadow);
    root.style.setProperty("--shadow-elegant", tokens.shadow);
  } else {
    root.style.removeProperty("--shadow-card");
    root.style.removeProperty("--shadow-elegant");
  }
}

export function cacheDesignTokens(tokens: DesignTokens) {
  try {
    window.localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    /* ignore */
  }
}

export function readCachedDesignTokens(): DesignTokens | null {
  try {
    const raw = window.localStorage.getItem(DESIGN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DesignTokens) : null;
  } catch {
    return null;
  }
}
