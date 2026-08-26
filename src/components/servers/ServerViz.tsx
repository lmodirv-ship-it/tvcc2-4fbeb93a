/** Lightweight SVG visualisations for the servers command center. */

type Tone = "primary" | "success" | "warning" | "destructive";

const toneClass: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function Sparkline({
  data,
  height = 32,
  tone = "primary",
  className = "",
}: {
  data: Array<number | null>;
  height?: number;
  tone?: Tone;
  className?: string;
}) {
  const pts = data.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  const vals = pts.filter((v): v is number => v !== null);
  if (vals.length < 2) {
    return <div style={{ height }} className={`w-full rounded bg-muted/20 ${className}`} />;
  }
  const w = 100;
  const h = 100;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = w / Math.max(pts.length - 1, 1);
  const coords = pts
    .map((v, i) => (v === null ? null : ([i * step, h - ((v - min) / span) * 80 - 10] as const)))
    .filter((c): c is readonly [number, number] => c !== null);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ height }}
      className={`w-full ${toneClass[tone]} ${className}`}
      aria-hidden
    >
      <polygon points={area} fill="currentColor" opacity={0.12} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function HealthRing({ score, size = 56 }: { score: number | null; size?: number }) {
  if (score === null || score === undefined) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-border/60 text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        —
      </div>
    );
  }
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone: Tone = score >= 90 ? "success" : score >= 75 ? "primary" : score >= 60 ? "warning" : "destructive";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`درجة الصحة ${score}%`}>
      <svg width={size} height={size} className={`-rotate-90 ${toneClass[tone]}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted/30" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{score}%</div>
    </div>
  );
}
