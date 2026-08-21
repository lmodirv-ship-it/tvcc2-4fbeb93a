import { useEffect, useRef, useState } from "react";

/** Animated depth background: moving grid, drifting orbs and a scan sweep. */
export function LiveBackdrop({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`} aria-hidden>
      <div className="absolute inset-0 live-grid opacity-70" />
      <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full bg-primary/20 blur-3xl float-slow" />
      <div className="absolute -bottom-20 right-0 w-64 h-64 rounded-full bg-accent/20 blur-3xl float-slow [animation-delay:1.5s]" />
      <div className="sweep-line" />
    </div>
  );
}

/** Card wrapper that tilts toward the pointer for a true 3D feel. */
export function Tilt3D({
  children,
  className = "",
  intensity = 10,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState("");

  return (
    <div className="scene-3d">
      <div
        ref={ref}
        className={`transition-transform duration-300 ease-out will-change-transform ${className}`}
        style={{ transform: t, transformStyle: "preserve-3d" }}
        onMouseMove={(e) => {
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          setT(
            `rotateY(${px * intensity}deg) rotateX(${-py * intensity}deg) translateZ(14px)`,
          );
        }}
        onMouseLeave={() => setT("")}
      >
        {children}
      </div>
    </div>
  );
}

/** Number that animates up to its value whenever it changes. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(a + (b - a) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{n.toLocaleString("ar-MA")}</>;
}

/** Pulsing status beacon. */
export function Beacon({ tone = "success" }: { tone?: "success" | "warning" | "destructive" | "muted" }) {
  const map = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    muted: "bg-muted-foreground",
  } as const;
  return (
    <span className="relative inline-flex w-2.5 h-2.5">
      <span className={`absolute inset-0 rounded-full ${map[tone]} pulse-ring opacity-60`} />
      <span className={`relative rounded-full w-2.5 h-2.5 ${map[tone]}`} />
    </span>
  );
}

/** Live sparkline that keeps sliding — reflects continuous activity. */
export function LivePulse({ seed = 1, className = "" }: { seed?: number; className?: string }) {
  const [pts, setPts] = useState<number[]>(() =>
    Array.from({ length: 28 }, (_, i) => 30 + Math.sin(i / 2 + seed) * 14 + Math.random() * 10),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPts((p) => [...p.slice(1), 22 + Math.random() * 34]);
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const d = pts
    .map((v, i) => `${(i / (pts.length - 1)) * 100},${60 - v}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className={`w-full h-12 ${className}`} aria-hidden>
      <polyline
        points={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}
