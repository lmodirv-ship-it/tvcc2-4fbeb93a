import { supabase } from "@/integrations/supabase/client";

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function exportDashboardHtml() {
  const [websitesRes, clientsRes, subsRes] = await Promise.all([
    supabase.from("websites").select("name,domain,status,verified,is_active,created_at"),
    supabase.from("clients").select("full_name,email,phone,created_at"),
    supabase.from("subscriptions").select("plan_name,price,currency,status,starts_at,expires_at"),
  ]);

  const websites = websitesRes.data || [];
  const clients = clientsRes.data || [];
  const subs = subsRes.data || [];

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      online: "#22c55e", offline: "#ef4444", warning: "#f59e0b",
      pending: "#94a3b8", active: "#22c55e", expired: "#ef4444",
    };
    return `<span style="background:${colors[s] || "#64748b"};color:#fff;padding:2px 10px;border-radius:9999px;font-size:11px">${esc(s)}</span>`;
  };

  const today = new Date().toISOString().slice(0, 10);

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TVCC — تصدير ${today}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',sans-serif;background:#1a1a2e;color:#f1f5f9;padding:24px;line-height:1.6}
  .container{max-width:1200px;margin:0 auto}
  header{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid #2d2d4a;margin-bottom:24px}
  .logo{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#a78bfa);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
  h1{font-size:22px}
  .meta{color:#94a3b8;font-size:13px;margin-top:4px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:32px}
  .card{background:#252548;padding:20px;border-radius:12px;border:1px solid #2d2d4a}
  .card .label{color:#94a3b8;font-size:13px;margin-bottom:6px}
  .card .value{font-size:28px;font-weight:700;color:#a78bfa}
  section{margin-bottom:32px}
  h2{font-size:18px;margin-bottom:12px;color:#e2e8f0}
  table{width:100%;border-collapse:collapse;background:#252548;border-radius:12px;overflow:hidden}
  th,td{padding:12px 16px;text-align:right;border-bottom:1px solid #2d2d4a;font-size:14px}
  th{background:#1f1f3d;color:#94a3b8;font-weight:600;font-size:12px;text-transform:uppercase}
  tr:last-child td{border-bottom:none}
  tr:hover{background:#2a2a52}
  footer{text-align:center;color:#64748b;font-size:12px;margin-top:32px;padding-top:16px;border-top:1px solid #2d2d4a}
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="logo">T</div>
    <div>
      <h1>TVCC — مركز إدارة المواقع</h1>
      <div class="meta">نسخة مُصدَّرة بتاريخ ${today}</div>
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="label">المواقع</div><div class="value">${websites.length}</div></div>
    <div class="card"><div class="label">العملاء</div><div class="value">${clients.length}</div></div>
    <div class="card"><div class="label">الاشتراكات</div><div class="value">${subs.length}</div></div>
    <div class="card"><div class="label">المواقع النشطة</div><div class="value">${websites.filter((w: any) => w.is_active).length}</div></div>
  </div>

  <section>
    <h2>المواقع</h2>
    <table>
      <thead><tr><th>الاسم</th><th>الدومين</th><th>الحالة</th><th>مفعّل</th></tr></thead>
      <tbody>
        ${websites.map((w: any) => `<tr><td>${esc(w.name)}</td><td>${esc(w.domain)}</td><td>${statusBadge(w.status)}</td><td>${w.is_active ? "نعم" : "لا"}</td></tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:#64748b">لا توجد مواقع</td></tr>`}
      </tbody>
    </table>
  </section>

  <section>
    <h2>العملاء</h2>
    <table>
      <thead><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th></tr></thead>
      <tbody>
        ${clients.map((c: any) => `<tr><td>${esc(c.full_name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td></tr>`).join("") || `<tr><td colspan="3" style="text-align:center;color:#64748b">لا يوجد عملاء</td></tr>`}
      </tbody>
    </table>
  </section>

  <section>
    <h2>الاشتراكات</h2>
    <table>
      <thead><tr><th>الخطة</th><th>السعر</th><th>الحالة</th><th>تاريخ البدء</th></tr></thead>
      <tbody>
        ${subs.map((s: any) => `<tr><td>${esc(s.plan_name)}</td><td>${esc(s.price)} ${esc(s.currency)}</td><td>${statusBadge(s.status)}</td><td>${esc(String(s.starts_at).slice(0, 10))}</td></tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:#64748b">لا توجد اشتراكات</td></tr>`}
      </tbody>
    </table>
  </section>

  <footer>تم التصدير من منصة TVCC — هذه نسخة عرض ثابتة بدون وظائف خادمية</footer>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tvcc-export-${today}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
