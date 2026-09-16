/** Whitelisted actions the agent is allowed to run. Anything else is rejected. */
export const COMMAND_WHITELIST = [
  "scan_ports",
  "read_configs",
  "service_status",
  "service_restart",
  "service_logs",
  "nginx_test",
  "nginx_reload",
  "firewall_list",
  "firewall_allow",
  "firewall_deny",
  "disk_usage",
  "write_config",
  "site_backup",
  "site_archive",
  "site_restore",
  "db_dump",
  "db_import",
  "platform_deploy",
  "link_check",
  "sync_site",
  "storage_usage",
  "site_dir",
  "issue_ssl",
  "port_check",
  "port_forward",
  "ai_models_list",
  "ollama_start",
  "ollama_stop",
  "ollama_pull",
  "ollama_rm",
  "ollama_ps",
  "site_start",
  "site_stop",
  "site_restart",
  "site_logs",
  "unit_write",
  "db_create",
  "db_user_grant",
  "db_ping",
  "db_sync",
  "watch_start",
  "watch_stop",
  "git_deploy",
  "failover_switch",
  "deploy_upload",
  "build_run",
  "serve_start",
  "serve_stop",
  "fs_list",
  "fs_tree",
  "fs_read",
  "fs_search",
  "fs_mkdir",
  "fs_write",
  "fs_delete",
  "fs_move",
  "hosting_provision",
  "hosting_quota_set",
  "hosting_usage_report",
  "file_replicate",
  "hn_dns_install",
  "hn_domain_publish",
  "hn_domain_remove",
  "port_bind_domain",
  "port_unbind_domain",
  "supabase_bind",
  "restore_all",
  "nginx_write_vhost",
  "ssl_issue_manual",
  "firewall_apply",
  "agent_update",
  "tunnel_setup",
  "tunnel_status",
  "tunnel_drop",
  "gateway_publish",
  "storage_sync",
  "storage_prune",
  "vpn_setup",
  "vpn_peer_add",
  "vpn_peer_remove",
  "vpn_status",
  "agent_self_update",
  "agent_diag",
  "job_cancel",
  "site_publish",
  "site_autostore",
  "autostore_scan",
  "agent_sync_all",
  "blueprint_apply",
  "site_clone",
  "multi_sql",
  "pitr_restore",
  "nginx_read",
  "nginx_write",
  "nginx_test",
  "nginx_reload",
  "site_snapshot",
  "site_rollback",
  "agent_config_set",
  "proc_list",
  "db_provision",
  "db_discover",
  "pg_meta",
  "pg_rows",
  "pg_write",
  "db_query",
  "db_policy",
  "auth_users",
  "storage_list",
  "edge_functions_list",
  "realtime_inspect",
  "advisor_scan",
  "db_export",
  "db_import_full",
  "site_identity_provision",
  "pooler_config",
  "backup_run",
  "backup_verify",
  "backup_restore",
  "db_migrate",
  "heal_action",
  "docker_ps",
  "docker_images",
  "docker_logs",
  "docker_action",
  "docker_exec",
  "docker_pull",
  "docker_rm",
  "docker_networks",
  "docker_volumes",
  "docker_compose_read",
  "docker_compose_write",
  "docker_compose_up",
  "docker_compose_down",
  "docker_create",
  "docker_prune",
  "docker_stats",
  "nginx_vhost_list",
  "nginx_vhost_read",
  "nginx_vhost_write",
  "nginx_vhost_enable",
  "nginx_vhost_disable",
  "nginx_vhost_delete",
  "nginx_cert_list",
  "nginx_cert_issue",
  "nginx_cert_renew",
  "nginx_access_log",
  "nginx_error_log",
  "nginx_stats",
  "users_list",
  "service_action",
  "pkg_list",
  "pkg_updates",
  "pkg_upgrade",
  "shell_exec",
  "cockpit_install",
  "tool_action",
] as const;




export type CommandAction = (typeof COMMAND_WHITELIST)[number];

export const COMMAND_LABELS: Record<string, string> = {
  blueprint_apply: "تطبيق القالب الأم",
  site_clone: "استنساخ موقع",
  multi_sql: "استعلام SQL جماعي",
  pitr_restore: "استعادة نقطة زمنية",
  nginx_read: "قراءة إعدادات Nginx",
  nginx_write: "كتابة إعدادات Nginx مع فحص",
  site_snapshot: "لقطة موقع",
  site_rollback: "استعادة نسخة موقع",
  agent_config_set: "تحديث إعدادات الوكيل",
  proc_list: "قائمة عمليات السيرفر",
  db_provision: "تجهيز قاعدة بيانات",
  db_discover: "اكتشاف خدمات قاعدة البيانات",
  pg_meta: "قراءة المخطط والعلاقات",
  pg_rows: "قراءة صفوف جدول",
  pg_write: "تعديل صفوف مؤكد",
  db_query: "استعلام قاعدة بيانات",
  db_policy: "سياسة قاعدة بيانات",
  auth_users: "مستخدمو المصادقة",
  storage_list: "حاويات التخزين",
  edge_functions_list: "قائمة الدوال",
  realtime_inspect: "فحص Realtime",
  advisor_scan: "فحص المستشارين",
  db_export: "تصدير كامل للقاعدة",
  db_import_full: "استيراد كامل للقاعدة",
  site_identity_provision: "تهيئة هوية تخزين الموقع",
  pooler_config: "إعداد تجميع الاتصالات",
  backup_run: "تنفيذ نسخة احتياطية",
  backup_verify: "التحقق من نسخة احتياطية",
  backup_restore: "استعادة نسخة احتياطية",
  db_migrate: "تهجير قاعدة بيانات",
  heal_action: "إجراء شفاء ذاتي",
  site_autostore: "تخزين تلقائي للموقع",
  autostore_scan: "فحص التخزين التلقائي",
  agent_sync_all: "مزامنة شاملة للوكيل",
  hosting_provision: "تجهيز مساحة استضافة",
  hosting_quota_set: "ضبط حصة التخزين",
  hosting_usage_report: "تقرير استهلاك التخزين",
  file_replicate: "نسخ ملف إلى خادم آخر",
  hn_dns_install: "تركيب سجل DNS لنطاق .HN",
  hn_domain_publish: "نشر نطاق .HN",
  hn_domain_remove: "إزالة نطاق .HN",
  git_deploy: "نشر من Git",
  deploy_upload: "رفع ملفات وبناء وتشغيل موقع",
  site_publish: "نشر نسخة المنصة على العقدة",
  build_run: "تنفيذ أمر البناء",
  serve_start: "تشغيل خدمة الموقع",
  serve_stop: "إيقاف خدمة الموقع",
  failover_switch: "تحويل تلقائي إلى سيرفر احتياطي",

  scan_ports: "فحص المنافذ المفتوحة",
  read_configs: "قراءة ملفات الإعداد",
  service_status: "حالة خدمة",
  service_restart: "إعادة تشغيل خدمة",
  service_logs: "سجلات خدمة",
  nginx_test: "اختبار إعداد Nginx",
  nginx_reload: "إعادة تحميل Nginx",
  firewall_list: "قواعد الجدار الناري",
  firewall_allow: "السماح بمنفذ",
  firewall_deny: "منع منفذ",
  disk_usage: "استهلاك القرص",
  write_config: "كتابة ملف إعداد",
  site_backup: "نسخة احتياطية لموقع",
  site_restore: "استعادة نسخة",
  db_dump: "تصدير قاعدة بيانات",
  db_import: "استيراد قاعدة بيانات",
  platform_deploy: "ترحيل المنصة",
  link_check: "فحص الاتصال بسيرفر آخر",
  sync_site: "مزامنة موقع بين سيرفرين",
  storage_usage: "قياس تخزين المواقع",
  site_dir: "إنشاء مجلد موقع",
  issue_ssl: "إصدار شهادة SSL",
  port_check: "فحص منفذ",
  port_forward: "جسر منفذ ← منفذ",
  ai_models_list: "قائمة نماذج الذكاء على منفذ",
  ollama_start: "تشغيل Ollama",
  ollama_stop: "إيقاف Ollama",
  ollama_pull: "تنزيل نموذج",
  ollama_rm: "حذف نموذج",
  ollama_ps: "النماذج قيد التشغيل",
  site_start: "تشغيل موقع",
  site_stop: "إيقاف موقع",
  site_restart: "إعادة تشغيل موقع",
  site_logs: "سجلات موقع",
  unit_write: "كتابة وحدة تشغيل الموقع",
  db_create: "إنشاء قاعدة بيانات",
  db_user_grant: "إنشاء مستخدم قاعدة ومنح صلاحيات",
  db_ping: "فحص الاتصال بقاعدة البيانات",
  db_sync: "مزامنة قاعدتي بيانات",
  watch_start: "تفعيل المزامنة اللحظية",
  watch_stop: "إيقاف المزامنة اللحظية",

  fs_list: "عرض محتويات مجلد",
  fs_tree: "شجرة الملفات",
  fs_read: "قراءة ملف",
  fs_search: "بحث داخل الملفات",
  fs_mkdir: "إنشاء مجلد",
  fs_write: "كتابة/تعديل ملف",
  fs_delete: "حذف ملف أو مجلد",
  fs_move: "نقل أو إعادة تسمية",

  port_bind_domain: "ربط منفذ بنطاق",
  port_unbind_domain: "إلغاء ربط النطاق",
  supabase_bind: "ربط منفذ بـ Supabase CLI",
  restore_all: "استعادة كل الخدمات",
  nginx_write_vhost: "كتابة إعداد Nginx للنطاق",
  ssl_issue_manual: "تركيب شهادة SSL يدوية",
  firewall_apply: "تطبيق قاعدة جدار ناري",
  agent_update: "تحديث الوكيل",
  tunnel_setup: "إنشاء نفق نحو البوابة",
  tunnel_status: "حالة النفق",
  tunnel_drop: "إزالة النفق",
  gateway_publish: "نشر موقع محلي عبر البوابة",
  storage_sync: "مزامنة نسخة الموقع للتخزين",
  storage_prune: "حذف نسخة التخزين",
  vpn_setup: "تهيئة شبكة VPN (WireGuard)",
  vpn_peer_add: "إضافة قرين VPN",
  vpn_peer_remove: "إزالة قرين VPN",
  vpn_status: "حالة شبكة VPN",
  agent_self_update: "تحديث الوكيل ذاتياً",
  agent_diag: "تشخيص الوكيل",
  job_cancel: "إلغاء مهمة",

  docker_ps: "قائمة الحاويات",
  docker_images: "قائمة الصور",
  docker_logs: "سجلات حاوية",
  docker_action: "تشغيل/إيقاف/إعادة تشغيل حاوية",
  docker_exec: "تنفيذ أمر داخل حاوية",
  docker_pull: "سحب صورة",
  docker_rm: "حذف حاوية",
  docker_networks: "شبكات Docker",
  docker_volumes: "مجلدات Docker",
  docker_compose_read: "قراءة ملف Compose",
  docker_compose_write: "كتابة ملف Compose",
  docker_compose_up: "تشغيل Compose",
  docker_compose_down: "إيقاف Compose",
  docker_create: "إنشاء حاوية جديدة",
  docker_prune: "تنظيف Docker",
  docker_stats: "استهلاك الحاويات",

  nginx_vhost_list: "قائمة مواقع Nginx",
  nginx_vhost_read: "قراءة ملف موقع Nginx",
  nginx_vhost_write: "كتابة ملف موقع Nginx",
  nginx_vhost_enable: "تفعيل موقع Nginx",
  nginx_vhost_disable: "تعطيل موقع Nginx",
  nginx_vhost_delete: "حذف موقع Nginx",
  nginx_cert_list: "قائمة شهادات SSL",
  nginx_cert_issue: "إصدار شهادة SSL",
  nginx_cert_renew: "تجديد شهادات SSL",
  nginx_access_log: "سجل الزيارات",
  nginx_error_log: "سجل الأخطاء",
  nginx_stats: "إحصاءات Nginx",
  users_list: "حسابات النظام",
  service_action: "إدارة خدمة Systemd",
  pkg_list: "الحزم المثبتة",
  pkg_updates: "فحص تحديثات Ubuntu",
  pkg_upgrade: "تثبيت تحديثات Ubuntu",
  shell_exec: "تنفيذ أمر طرفية",
  cockpit_install: "تثبيت وتشغيل Cockpit",
};


/** Actions that take a free-text argument, with the arg key + placeholder. */
export const COMMAND_ARG: Record<string, { key: string; placeholder: string }> = {
  service_status: { key: "name", placeholder: "nginx" },
  service_restart: { key: "name", placeholder: "nginx" },
  service_logs: { key: "name", placeholder: "nginx" },
  firewall_allow: { key: "port", placeholder: "443/tcp" },
  firewall_deny: { key: "port", placeholder: "23/tcp" },
  site_backup: { key: "domain", placeholder: "example.com" },
  db_dump: { key: "domain", placeholder: "example.com" },
  site_dir: { key: "domain", placeholder: "example.com" },
  issue_ssl: { key: "domain", placeholder: "example.com" },
  site_start: { key: "name", placeholder: "tvcc-site-example.com" },
  site_stop: { key: "name", placeholder: "tvcc-site-example.com" },
  site_restart: { key: "name", placeholder: "tvcc-site-example.com" },
  site_logs: { key: "name", placeholder: "tvcc-site-example.com" },
  users_list: { key: "filter", placeholder: "اسم المستخدم (اختياري)" },
  service_action: { key: "name", placeholder: "nginx" },
  shell_exec: { key: "cmd", placeholder: "systemctl status cockpit.socket" },
  watch_start: { key: "domain", placeholder: "example.com" },
  watch_stop: { key: "domain", placeholder: "example.com" },
};

/** تصنيف المهام لعرضها في جدول مهام الوكيل. */
export const COMMAND_CATEGORIES = [
  "مراقبة",
  "خدمات",
  "مواقع",
  "قواعد بيانات",
  "شبكة",
  "حاويات",
  "نسخ احتياطي",
  "ملفات",
  "ذكاء اصطناعي",
  "نظام",
] as const;
export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

/** أوامر تُعدّ خطرة وتحتاج تأكيداً قبل التنفيذ. */
export const RISKY_COMMANDS: readonly string[] = [
  "fs_delete", "fs_write", "fs_move", "db_import", "db_import_full", "db_write",
  "pg_write", "site_restore", "restore_all", "backup_restore", "pitr_restore",
  "agent_self_update", "agent_update", "failover_switch", "firewall_apply",
  "firewall_deny", "db_migrate", "heal_action", "site_rollback", "db_query",
  "multi_sql", "platform_deploy", "site_identity_provision", "db_provision",
  "docker_rm", "docker_prune", "docker_exec", "docker_compose_down",
  "docker_compose_write", "docker_create", "docker_action",
  "nginx_vhost_write", "nginx_vhost_delete", "nginx_vhost_disable", "nginx_cert_issue",
  "pkg_upgrade", "shell_exec", "cockpit_install",
];

export function commandCategory(action: string): CommandCategory {
  if (action.startsWith("docker_")) return "حاويات";
  if (/^(scan_ports|read_configs|disk_usage|storage_usage|link_check|port_check|proc_list|agent_diag|advisor_scan|realtime_inspect)$/.test(action)) return "مراقبة";

  if (action.startsWith("service_") || action.startsWith("unit_") || action.startsWith("serve_") || action.startsWith("watch_")) return "خدمات";
  if (action.startsWith("site_") || action.startsWith("hosting_") || action.startsWith("blueprint_") || action.startsWith("git_") || action.startsWith("build_") || action.startsWith("deploy_") || action === "sync_site") return "مواقع";
  if (action.startsWith("db_") || action.startsWith("pg_") || action.startsWith("supabase_") || action.startsWith("pooler_") || action === "multi_sql" || action === "auth_users") return "قواعد بيانات";
  if (action.startsWith("nginx_") || action.startsWith("firewall_") || action.startsWith("port_") || action.startsWith("tunnel_") || action.startsWith("vpn_") || action.startsWith("hn_") || action.startsWith("ssl_") || action === "issue_ssl" || action === "gateway_publish") return "شبكة";
  if (action.startsWith("backup_") || action.startsWith("storage_") || action.startsWith("file_") || action === "restore_all" || action === "pitr_restore") return "نسخ احتياطي";
  if (action.startsWith("fs_")) return "ملفات";
  if (action.startsWith("ollama_") || action.startsWith("ai_") || action.startsWith("edge_functions")) return "ذكاء اصطناعي";
  return "نظام";
}

/* ============================================================
 * أدوار الوكيل على السيرفر — أي وكيل يحق له تنفيذ أي مهمة
 * ============================================================ */

export const AGENT_ROLE_KEYS = ["main", "web", "db", "backup", "monitor", "healer", "security"] as const;
export type AgentRoleKey = (typeof AGENT_ROLE_KEYS)[number];

export const AGENT_ROLE_LABELS: Record<AgentRoleKey, string> = {
  main: "وكيل رئيسي",
  web: "المواقع و Nginx",
  db: "قواعد البيانات",
  backup: "النسخ الاحتياطية",
  monitor: "المراقبة",
  healer: "الإحياء الذاتي",
  security: "الأمان",
};

const CATEGORY_ROLES: Record<CommandCategory, AgentRoleKey[]> = {
  "مراقبة": ["main", "web", "db", "backup", "monitor", "healer", "security"],
  "خدمات": ["main", "web", "healer"],
  "مواقع": ["main", "web"],
  "قواعد بيانات": ["main", "db"],
  "شبكة": ["main", "web", "security"],
  "حاويات": ["main", "web"],
  "نسخ احتياطي": ["main", "backup"],
  "ملفات": ["main", "web", "backup"],
  "ذكاء اصطناعي": ["main"],
  "نظام": ["main", "healer", "security"],
};

/** أدوار الوكيل المخوّلة بتنفيذ هذه المهمة. */
export function rolesForAction(action: string): AgentRoleKey[] {
  if (action.startsWith("agent_") || action === "job_cancel") return ["main", "healer"];
  if (action.startsWith("heal_")) return ["main", "healer"];
  if (action.startsWith("firewall_")) return ["main", "security"];
  return CATEGORY_ROLES[commandCategory(action)] ?? ["main"];
}

export function agentRoleAllows(role: string | null | undefined, action: string): boolean {
  const r = (role ?? "main").toLowerCase();
  if (r === "main" || r === "full") return true;
  return (rolesForAction(action) as string[]).includes(r);
}

/* ============================================================
 * صلاحية المستخدم المطلوبة لكل مهمة
 * ============================================================ */

const READ_ONLY_COMMANDS: readonly string[] = [
  "scan_ports", "read_configs", "service_status", "service_logs", "disk_usage",
  "storage_usage", "port_check", "link_check", "proc_list", "agent_diag",
  "fs_list", "fs_tree", "fs_read", "fs_search", "site_logs", "db_ping",
  "tunnel_status", "vpn_status", "ai_models_list", "ollama_ps", "firewall_list",
  "nginx_test", "nginx_read", "nginx_vhost_list", "nginx_vhost_read", "nginx_cert_list",
  "nginx_access_log", "nginx_error_log", "nginx_stats", "docker_ps", "docker_images",
  "docker_logs", "docker_networks", "docker_volumes", "docker_stats", "docker_compose_read",
  "pg_meta", "pg_rows", "db_discover", "storage_list", "edge_functions_list",
  "realtime_inspect", "advisor_scan", "auth_users", "backup_verify", "hosting_usage_report",
];

export function isReadOnlyCommand(action: string): boolean {
  return READ_ONLY_COMMANDS.includes(action);
}

/** مفتاح الصلاحية في مصفوفة أدوار المستخدم المطلوب لتشغيل هذه المهمة. */
export function permissionForAction(action: string):
  | "agent.read" | "agent.run" | "docker.manage" | "nginx.manage" | "db.read" | "db.write" | "db.ddl" {
  if (action.startsWith("docker_")) return isReadOnlyCommand(action) ? "agent.read" : "docker.manage";
  if (action.startsWith("nginx_")) return isReadOnlyCommand(action) ? "agent.read" : "nginx.manage";
  if (commandCategory(action) === "قواعد بيانات") {
    if (isReadOnlyCommand(action)) return "db.read";
    if (["db_migrate", "db_provision", "db_import", "db_import_full", "db_create", "db_user_grant", "pooler_config"].includes(action)) return "db.ddl";
    return "db.write";
  }
  return isReadOnlyCommand(action) ? "agent.read" : "agent.run";
}

