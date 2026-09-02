import { useEffect, useRef } from "react";

export function LighthouseScene({ active }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    };

    resize();
    window.addEventListener("resize", resize);

    const stars: { x: number; y: number; r: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.65,
        r: Math.random() * 1.5 + 0.5,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.03 + 0.01,
      });
    }

    const draw = () => {
      t += 0.01;
      ctx.clearRect(0, 0, w, h);

      // سماء ليلية
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "oklch(0.13 0.04 260)");
      sky.addColorStop(1, "oklch(0.22 0.06 260)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // نجوم وامضة
      stars.forEach((s) => {
        const alpha = 0.4 + 0.6 * Math.sin(t * s.speed * 60 + s.phase);
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });

      // ألوان المنارة المتغيرة
      const hue = (t * 8) % 360;
      const color1 = `oklch(0.75 0.18 ${(hue + 0) % 360})`;
      const color2 = `oklch(0.75 0.18 ${(hue + 120) % 360})`;
      const color3 = `oklch(0.75 0.18 ${(hue + 240) % 360})`;

      const cx = w / 2;
      const cy = h * 0.72;
      const base = h * 0.28;

      // توهج خارجي
      const glow = ctx.createRadialGradient(cx, cy, base * 0.2, cx, cy, base * 1.4);
      glow.addColorStop(0, color1);
      glow.addColorStop(0.5, color2);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // جسم المنارة
      ctx.fillStyle = "oklch(0.3 0.04 260)";
      ctx.beginPath();
      ctx.moveTo(cx - base * 0.18, cy + base * 0.5);
      ctx.lineTo(cx + base * 0.18, cy + base * 0.5);
      ctx.lineTo(cx + base * 0.1, cy - base * 0.35);
      ctx.lineTo(cx - base * 0.1, cy - base * 0.35);
      ctx.closePath();
      ctx.fill();

      // رأس المنارة
      const headGrad = ctx.createLinearGradient(cx - base * 0.12, cy - base * 0.35, cx + base * 0.12, cy - base * 0.6);
      headGrad.addColorStop(0, color1);
      headGrad.addColorStop(0.5, color2);
      headGrad.addColorStop(1, color3);
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - base * 0.42, base * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // شعاع دوار
      const beamAngle = t * 1.2;
      for (let i = 0; i < 3; i++) {
        const angle = beamAngle + (i * Math.PI * 2) / 3;
        ctx.save();
        ctx.translate(cx, cy - base * 0.42);
        ctx.rotate(angle);
        const beam = ctx.createLinearGradient(0, 0, base * 1.4, 0);
        beam.addColorStop(0, color2);
        beam.addColorStop(1, "transparent");
        ctx.strokeStyle = beam;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(base * 1.4, 0);
        ctx.stroke();
        ctx.restore();
      }

      // خطوط برقية
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = color3;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const y = h * (0.25 + i * 0.1);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w * 0.25, y + Math.sin(t * 3 + i) * 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w, y);
        ctx.lineTo(w * 0.75, y + Math.cos(t * 3 + i) * 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // حالة النشاط
      if (active) {
        ctx.shadowColor = color1;
        ctx.shadowBlur = 20;
        ctx.fillStyle = color1;
        ctx.beginPath();
        ctx.arc(cx, cy + base * 0.6, base * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-2xl"
      style={{ minHeight: 320 }}
      aria-label="منارة — مركز التوجيه الحي"
    />
  );
}
