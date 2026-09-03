/**
 * المشهد المركزي لصفحة منارة — بصري بالكامل، بدون أي كتابة.
 * كرة شبكية متوهجة ثلاثية الأبعاد، مدارات دوّارة، ومنارة ذهبية في النواة.
 */
export function LighthouseScene({ active }: { active?: boolean }) {
  return (
    <div className="relative w-full h-full min-h-[420px] overflow-hidden rounded-3xl bg-[oklch(0.13_0.04_260)]">
      {/* توهج محيط */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, oklch(0.45 0.16 260 / 0.35) 0%, transparent 70%)",
        }}
      />

      {/* نجوم */}
      <div className="absolute inset-0 manara-stars" />

      {/* خطوط الربط الضوئية من/إلى النواة */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 450" preserveAspectRatio="none">
        <defs>
          <linearGradient id="manaraLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.7 0.16 250 / 0)" />
            <stop offset="50%" stopColor="oklch(0.75 0.18 250 / 0.6)" />
            <stop offset="100%" stopColor="oklch(0.7 0.16 250 / 0)" />
          </linearGradient>
        </defs>
        {[
          "M0 150 L350 215",
          "M0 300 L350 235",
          "M800 150 L450 215",
          "M800 300 L450 235",
        ].map((d) => (
          <path key={d} d={d} stroke="url(#manaraLine)" strokeWidth="1.5" fill="none" className="manara-flow" />
        ))}
      </svg>

      {/* النواة */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center manara-hue">
          <div className="absolute inset-0 rounded-full border border-primary/25 animate-[spin_18s_linear_infinite]" />
          <div className="absolute inset-4 rounded-full border border-primary/35 animate-[spin_26s_linear_infinite_reverse]" />
          <div className="absolute inset-10 rounded-full border border-primary/20 rotate-45" />
          <div className="absolute inset-6 rounded-full border border-primary/15 scale-y-50" />
          <div className="absolute inset-6 rounded-full border border-primary/15 scale-x-50" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: "inset 0 0 70px oklch(0.6 0.18 260 / 0.45)",
              background: "radial-gradient(circle, transparent 60%, oklch(0.6 0.18 260 / 0.14) 100%)",
            }}
          />

          {/* المنارة الذهبية داخل الكرة */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className="absolute -top-6 w-40 h-40 rounded-full blur-3xl"
              style={{ background: "oklch(0.82 0.15 85 / 0.22)" }}
            />
            <div className="relative w-14">
              <div
                className={`absolute -top-3 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full blur-xl ${active ? "animate-pulse" : ""}`}
                style={{ background: "oklch(0.88 0.16 85)" }}
              />
              <div className="w-8 h-2 mx-auto rounded-t-sm" style={{ background: "oklch(0.62 0.13 70)" }} />
              <div
                className="w-6 h-4 mx-auto"
                style={{ background: "oklch(0.93 0.1 95)", boxShadow: "0 0 18px oklch(0.9 0.15 90 / 0.8)" }}
              />
              <div
                className="w-10 h-20 mx-auto manara-tower"
                style={{ background: "linear-gradient(to bottom, oklch(0.7 0.14 75), oklch(0.42 0.09 65))" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
