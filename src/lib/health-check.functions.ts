import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function tryFetch(url: string, method: "HEAD" | "GET", timeoutMs = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, signal: ac.signal, redirect: "follow" });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function pingDomain(domain: string): Promise<{ status: "online" | "offline" | "warning"; latency_ms: number; http_status: number | null; used_url: string }> {
  const started = Date.now();
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const candidates = clean.startsWith("www.")
    ? [`https://${clean}`, `https://${clean.slice(4)}`, `http://${clean}`]
    : [`https://${clean}`, `https://www.${clean}`, `http://${clean}`];

  for (const url of candidates) {
    // HEAD first, fallback to GET (many hosts reject HEAD).
    let code = await tryFetch(url, "HEAD");
    if (code == null || code === 405 || code === 501) code = await tryFetch(url, "GET");
    if (code == null) continue;
    const latency = Date.now() - started;
    if (code >= 500) return { status: "offline", latency_ms: latency, http_status: code, used_url: url };
    if (code >= 400) return { status: "warning", latency_ms: latency, http_status: code, used_url: url };
    return { status: "online", latency_ms: latency, http_status: code, used_url: url };
  }
  return { status: "offline", latency_ms: Date.now() - started, http_status: null, used_url: candidates[0] };
}

export const runHealthCheckAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sites, error } = await supabase
      .from("websites")
      .select("id, domain, name")
      .limit(500);
    if (error) throw new Error(error.message);

    const results = await Promise.all(
      (sites ?? []).map(async (s) => {
        const r = await pingDomain(s.domain);
        await supabase.from("websites").update({ status: r.status, last_checked_at: new Date().toISOString() }).eq("id", s.id);
        await supabase.from("site_health_checks").insert({
          owner_id: userId,
          website_id: s.id,
          status: r.status,
          response_time_ms: r.latency_ms,
          http_status: r.http_status,
        });
        return { id: s.id, domain: s.domain, name: (s as any).name, ...r };
      }),
    );

    const summary = {
      total: results.length,
      online: results.filter((r) => r.status === "online").length,
      offline: results.filter((r) => r.status === "offline").length,
      warning: results.filter((r) => r.status === "warning").length,
    };
    return { summary, checked_at: new Date().toISOString() };
  });

export const autoFixAndReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sites, error } = await supabase
      .from("websites")
      .select("id, domain, name, status")
      .limit(500);
    if (error) throw new Error(error.message);

    const results = await Promise.all(
      (sites ?? []).map(async (s) => {
        const before = s.status;
        const r = await pingDomain(s.domain);
        await supabase.from("websites").update({
          status: r.status,
          last_checked_at: new Date().toISOString(),
        }).eq("id", s.id);
        await supabase.from("site_health_checks").insert({
          owner_id: userId,
          website_id: s.id,
          status: r.status,
          response_time_ms: r.latency_ms,
          http_status: r.http_status,
        });
        return { id: s.id, name: (s as any).name, domain: s.domain, before, after: r.status, http_status: r.http_status, latency_ms: r.latency_ms, used_url: r.used_url };
      }),
    );

    const summary = {
      total: results.length,
      online: results.filter((r) => r.after === "online").length,
      offline: results.filter((r) => r.after === "offline").length,
      warning: results.filter((r) => r.after === "warning").length,
      fixed: results.filter((r) => r.before !== "online" && r.after === "online").length,
      still_offline: results.filter((r) => r.after === "offline").map((r) => ({ name: r.name, domain: r.domain, http_status: r.http_status })),
    };

    const report = {
      source: "hn-tvcc",
      type: "site.health.autofix.report",
      generated_at: new Date().toISOString(),
      owner_id: userId,
      summary,
      details: results,
    };

    // Send report to hn-nawat (fire-and-forget with short timeout).
    const targets = [
      "https://hn-nawat.lovable.app/api/public/reports.ingest",
      "https://hn-nawat.lovable.app/api/public/core.ingest",
    ];
    const deliveries = await Promise.all(targets.map(async (url) => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 6000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-hn-source": "hn-tvcc" },
          body: JSON.stringify(report),
          signal: ac.signal,
        });
        return { url, ok: res.ok, status: res.status };
      } catch (e: any) {
        return { url, ok: false, status: 0, error: e?.message || "fetch failed" };
      } finally {
        clearTimeout(t);
      }
    }));

    await supabase.from("activity_log").insert({
      owner_id: userId,
      action: "sites.autofix.report",
      entity_type: "monitoring",
      details: { summary, deliveries } as any,
    });

    return { summary, deliveries, checked_at: report.generated_at };
  });

const FOOTER_HTML = `<footer id="hn-group-footer" style="border-top:1px solid rgba(148,163,184,.25);padding:14px 12px;text-align:center;font:500 12px/1.6 system-ui,'Cairo',sans-serif;color:#64748b;background:transparent" dir="rtl">© 2026 جميع الحقوق محفوظة El Hassani Moulay Ismail · Groupe HN</footer>`;
const FOOTER_TEXT = "© 2026 جميع الحقوق محفوظة El Hassani Moulay Ismail · Groupe HN";

export const broadcastGroupFooter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sites } = await supabase
      .from("websites")
      .select("id, name, domain")
      .limit(500);

    const payload = {
      source: "hn-tvcc",
      type: "site.footer.set",
      selector: "body",
      position: "append",
      element_id: "hn-group-footer",
      html: FOOTER_HTML,
      text: FOOTER_TEXT,
      issued_at: new Date().toISOString(),
    };

    const endpoints = ["/api/public/directives/ingest", "/api/public/core.ingest", "/api/public/footer.set"];

    const deliveries = await Promise.all((sites ?? []).map(async (s) => {
      const clean = s.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      for (const ep of endpoints) {
        const url = `https://${clean}${ep}`;
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 6000);
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-hn-source": "hn-tvcc" },
            body: JSON.stringify(payload),
            signal: ac.signal,
          });
          clearTimeout(t);
          if (res.ok) return { website_id: s.id, domain: s.domain, ok: true, status: res.status, endpoint: ep };
        } catch {
          clearTimeout(t);
        }
      }
      return { website_id: s.id, domain: s.domain, ok: false, status: 0, endpoint: null };
    }));

    const delivered = deliveries.filter((d) => d.ok).length;
    const failed = deliveries.length - delivered;

    await supabase.from("activity_log").insert({
      owner_id: userId,
      action: "sites.footer.broadcast",
      entity_type: "monitoring",
      details: { total: deliveries.length, delivered, failed, footer_text: FOOTER_TEXT, deliveries } as any,
    });

    // Notify hn-nawat
    try {
      await fetch("https://hn-nawat.lovable.app/api/public/reports.ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hn-source": "hn-tvcc" },
        body: JSON.stringify({
          source: "hn-tvcc",
          type: "site.footer.broadcast.report",
          generated_at: new Date().toISOString(),
          summary: { total: deliveries.length, delivered, failed },
          footer: FOOTER_TEXT,
          deliveries,
        }),
      });
    } catch {}

    return { total: deliveries.length, delivered, failed, footer: FOOTER_TEXT };
  });