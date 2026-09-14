/**
 * مصفوفة الصلاحيات — تحدد ما يستطيع كل دور فعله داخل لوحة التحكم.
 * هذه طبقة واجهة فقط؛ الحماية الحقيقية في سياسات RLS بقاعدة البيانات.
 */

export type AppRole = "system_owner" | "admin" | "editor" | "viewer";

export const ROLE_ORDER: AppRole[] = ["system_owner", "admin", "editor", "viewer"];

export const ROLE_LABELS: Record<AppRole, string> = {
  system_owner: "مالك المنصة",
  admin: "مدير (Admin)",
  editor: "محرر (Editor)",
  viewer: "مشاهد (Viewer)",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  system_owner: "صلاحية كاملة على المنصة، غير قابل للحذف أو التعديل",
  admin: "إدارة كاملة للمواقع والسيرفرات والفريق",
  editor: "إنشاء وتعديل المحتوى والمواقع دون إدارة الفريق أو الأسرار",
  viewer: "عرض فقط دون أي تعديل",
};

export const PERMISSIONS = [
  { key: "sites.view", label: "عرض المواقع", group: "المواقع" },
  { key: "sites.manage", label: "إضافة/تعديل/حذف المواقع", group: "المواقع" },
  { key: "sites.deploy", label: "النشر والمزامنة", group: "المواقع" },
  { key: "servers.view", label: "عرض السيرفرات", group: "البنية التحتية" },
  { key: "servers.manage", label: "التحكم بالسيرفرات والأوامر", group: "البنية التحتية" },
  { key: "domains.manage", label: "إدارة النطاقات والشهادات", group: "البنية التحتية" },
  { key: "agent.read", label: "عرض الوكلاء ومهامهم", group: "الوكيل" },
  { key: "agent.run", label: "تشغيل أوامر الوكيل", group: "الوكيل" },
  { key: "agent.capability", label: "تفعيل/تعطيل مهام الوكيل وأدواره", group: "الوكيل" },
  { key: "docker.manage", label: "إدارة الحاويات (Docker)", group: "الوكيل" },
  { key: "nginx.manage", label: "إدارة Nginx والشهادات", group: "الوكيل" },
  { key: "db.read", label: "قراءة قواعد البيانات والجداول", group: "قواعد البيانات" },
  { key: "db.write", label: "تعديل صفوف قواعد البيانات", group: "قواعد البيانات" },
  { key: "db.ddl", label: "تغيير بنية الجداول والاستيراد", group: "قواعد البيانات" },
  { key: "secrets.view", label: "الوصول إلى الخزنة والأسرار", group: "الأمان" },
  { key: "users.view", label: "عرض أعضاء الفريق", group: "الفريق" },
  { key: "users.manage", label: "دعوة الأعضاء ومنح الأدوار", group: "الفريق" },
  { key: "billing.manage", label: "الاشتراكات والمدفوعات", group: "الأعمال" },
  { key: "settings.manage", label: "إعدادات المنصة وهوية التصميم", group: "الأعمال" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

const VIEWER: PermissionKey[] = ["sites.view", "servers.view", "users.view", "agent.read", "db.read"];
const EDITOR: PermissionKey[] = [
  ...VIEWER,
  "sites.manage",
  "sites.deploy",
  "agent.run",
];
const ADMIN: PermissionKey[] = [
  ...EDITOR,
  "servers.manage",
  "domains.manage",
  "agent.capability",
  "docker.manage",
  "nginx.manage",
  "db.write",
  "db.ddl",
  "secrets.view",
  "users.manage",
  "billing.manage",
  "settings.manage",
];

export const ROLE_PERMISSIONS: Record<AppRole, PermissionKey[]> = {
  system_owner: PERMISSIONS.map((p) => p.key),
  admin: ADMIN,
  editor: EDITOR,
  viewer: VIEWER,
};


export function permissionsForRoles(roles: string[]): Set<PermissionKey> {
  const out = new Set<PermissionKey>();
  const effective = roles.length ? roles : ["viewer"];
  for (const r of effective) {
    const list = ROLE_PERMISSIONS[r as AppRole];
    if (list) list.forEach((p) => out.add(p));
  }
  return out;
}

export function roleHas(role: AppRole, permission: PermissionKey) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
