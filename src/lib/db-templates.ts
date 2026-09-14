/**
 * مكتبة نماذج الجداول (Blueprints) للمواقع.
 * التعريفات بيانات فقط؛ بناء SQL يتم عبر buildTemplateSql على الخادم من معرّفات محقّقة.
 */

export type TplColumn = {
  name: string;
  type: string;
  notNull?: boolean;
  default?: string;
  primary?: boolean;
  unique?: boolean;
  ref?: string; // اسم جدول داخل نفس النموذج (مفتاح أجنبي إلى id)
};

export type TplPolicy = "own_rows" | "public_read" | "admin_only" | "public_read_own_write";

export type TplTable = {
  name: string;
  title: string;
  columns: TplColumn[];
  indexes?: string[];
  policy: TplPolicy;
  ownerColumn?: string;
  seeds?: Record<string, string | number | boolean | null>[];
};

export type DbTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  tables: TplTable[];
};

const ID: TplColumn = { name: "id", type: "uuid", primary: true, default: "gen_random_uuid()" };
const CREATED: TplColumn = { name: "created_at", type: "timestamptz", notNull: true, default: "now()" };
const UPDATED: TplColumn = { name: "updated_at", type: "timestamptz", notNull: true, default: "now()" };
const OWNER: TplColumn = { name: "user_id", type: "uuid", notNull: true };

const t = (
  name: string,
  title: string,
  columns: TplColumn[],
  policy: TplPolicy,
  extra: Partial<TplTable> = {},
): TplTable => ({ name, title, policy, columns: [ID, ...columns, CREATED, UPDATED], ...extra });

export const DB_TEMPLATES: DbTemplate[] = [
  {
    id: "core",
    name: "أساس الموقع",
    category: "أساسي",
    description: "الملفات الشخصية والأدوار والإعدادات والوسائط وسجل التدقيق — الحد الأدنى لأي موقع.",
    tables: [
      t("profiles", "الملفات الشخصية", [
        { name: "user_id", type: "uuid", notNull: true, unique: true },
        { name: "full_name", type: "text" },
        { name: "email", type: "text" },
        { name: "avatar_url", type: "text" },
        { name: "bio", type: "text" },
        { name: "locale", type: "text", default: "ar" },
      ], "public_read_own_write", { indexes: ["user_id"] }),
      t("user_roles", "أدوار المستخدمين", [
        OWNER,
        { name: "role", type: "text", notNull: true, default: "viewer" },
      ], "admin_only", { indexes: ["user_id"] }),
      t("settings", "الإعدادات", [
        { name: "key", type: "text", notNull: true, unique: true },
        { name: "value", type: "jsonb", notNull: true, default: "'{}'::jsonb" },
        { name: "is_public", type: "bool", notNull: true, default: "false" },
      ], "admin_only", {
        seeds: [
          { key: "site_title", value: '{"ar":"موقعي"}', is_public: true },
          { key: "maintenance", value: '{"enabled":false}', is_public: false },
        ],
      }),
      t("media", "الوسائط", [
        OWNER,
        { name: "path", type: "text", notNull: true },
        { name: "mime_type", type: "text" },
        { name: "size_bytes", type: "int8", default: "0" },
        { name: "alt_text", type: "text" },
      ], "own_rows", { indexes: ["user_id"] }),
      t("audit_log", "سجل التدقيق", [
        { name: "actor_id", type: "uuid" },
        { name: "action", type: "text", notNull: true },
        { name: "resource", type: "text" },
        { name: "resource_id", type: "text" },
        { name: "details", type: "jsonb", default: "'{}'::jsonb" },
      ], "admin_only", { indexes: ["actor_id", "created_at"] }),
    ],
  },
  {
    id: "blog",
    name: "مدوّنة ومحتوى",
    category: "محتوى",
    description: "مقالات وتصنيفات ووسوم وتعليقات مع نشر وقراءة عامة للمنشور فقط.",
    tables: [
      t("categories", "التصنيفات", [
        { name: "slug", type: "text", notNull: true, unique: true },
        { name: "name", type: "text", notNull: true },
        { name: "description", type: "text" },
      ], "public_read", { seeds: [{ slug: "news", name: "أخبار" }, { slug: "guides", name: "أدلة" }] }),
      t("posts", "المقالات", [
        { name: "author_id", type: "uuid", notNull: true },
        { name: "category_id", type: "uuid", ref: "categories" },
        { name: "slug", type: "text", notNull: true, unique: true },
        { name: "title", type: "text", notNull: true },
        { name: "excerpt", type: "text" },
        { name: "content", type: "text" },
        { name: "cover_url", type: "text" },
        { name: "status", type: "text", notNull: true, default: "draft" },
        { name: "views", type: "int8", notNull: true, default: "0" },
        { name: "published_at", type: "timestamptz" },
      ], "public_read_own_write", { ownerColumn: "author_id", indexes: ["author_id", "category_id", "status", "published_at"] }),
      t("tags", "الوسوم", [
        { name: "slug", type: "text", notNull: true, unique: true },
        { name: "name", type: "text", notNull: true },
      ], "public_read"),
      t("post_tags", "ربط الوسوم", [
        { name: "post_id", type: "uuid", notNull: true, ref: "posts" },
        { name: "tag_id", type: "uuid", notNull: true, ref: "tags" },
      ], "public_read", { indexes: ["post_id", "tag_id"] }),
      t("comments", "التعليقات", [
        { name: "post_id", type: "uuid", notNull: true, ref: "posts" },
        OWNER,
        { name: "body", type: "text", notNull: true },
        { name: "is_approved", type: "bool", notNull: true, default: "false" },
      ], "public_read_own_write", { indexes: ["post_id", "user_id"] }),
    ],
  },
  {
    id: "shop",
    name: "متجر إلكتروني",
    category: "تجارة",
    description: "منتجات ومتغيرات ومخزون وعملاء وطلبات ومدفوعات وكوبونات.",
    tables: [
      t("product_categories", "تصنيفات المنتجات", [
        { name: "slug", type: "text", notNull: true, unique: true },
        { name: "name", type: "text", notNull: true },
      ], "public_read"),
      t("products", "المنتجات", [
        { name: "category_id", type: "uuid", ref: "product_categories" },
        { name: "sku", type: "text", unique: true },
        { name: "name", type: "text", notNull: true },
        { name: "description", type: "text" },
        { name: "price", type: "numeric", notNull: true, default: "0" },
        { name: "currency", type: "text", notNull: true, default: "MAD" },
        { name: "image_url", type: "text" },
        { name: "is_active", type: "bool", notNull: true, default: "true" },
      ], "public_read", { indexes: ["category_id", "is_active"] }),
      t("product_variants", "متغيرات المنتج", [
        { name: "product_id", type: "uuid", notNull: true, ref: "products" },
        { name: "title", type: "text", notNull: true },
        { name: "price_delta", type: "numeric", notNull: true, default: "0" },
        { name: "stock", type: "int4", notNull: true, default: "0" },
      ], "public_read", { indexes: ["product_id"] }),
      t("customers", "العملاء", [
        OWNER,
        { name: "full_name", type: "text" },
        { name: "email", type: "text" },
        { name: "phone", type: "text" },
        { name: "address", type: "jsonb", default: "'{}'::jsonb" },
      ], "own_rows", { indexes: ["user_id"] }),
      t("orders", "الطلبات", [
        OWNER,
        { name: "customer_id", type: "uuid", ref: "customers" },
        { name: "order_number", type: "text", unique: true },
        { name: "status", type: "text", notNull: true, default: "pending" },
        { name: "subtotal", type: "numeric", notNull: true, default: "0" },
        { name: "shipping", type: "numeric", notNull: true, default: "0" },
        { name: "total", type: "numeric", notNull: true, default: "0" },
        { name: "currency", type: "text", notNull: true, default: "MAD" },
      ], "own_rows", { indexes: ["user_id", "status", "created_at"] }),
      t("order_items", "بنود الطلب", [
        { name: "order_id", type: "uuid", notNull: true, ref: "orders" },
        { name: "product_id", type: "uuid", ref: "products" },
        { name: "quantity", type: "int4", notNull: true, default: "1" },
        { name: "unit_price", type: "numeric", notNull: true, default: "0" },
      ], "admin_only", { indexes: ["order_id"] }),
      t("payments", "المدفوعات", [
        { name: "order_id", type: "uuid", notNull: true, ref: "orders" },
        { name: "provider", type: "text", notNull: true, default: "manual" },
        { name: "reference", type: "text" },
        { name: "amount", type: "numeric", notNull: true, default: "0" },
        { name: "status", type: "text", notNull: true, default: "pending" },
        { name: "paid_at", type: "timestamptz" },
      ], "admin_only", { indexes: ["order_id", "status"] }),
      t("coupons", "الكوبونات", [
        { name: "code", type: "text", notNull: true, unique: true },
        { name: "percent_off", type: "numeric", default: "0" },
        { name: "amount_off", type: "numeric", default: "0" },
        { name: "expires_at", type: "timestamptz" },
        { name: "is_active", type: "bool", notNull: true, default: "true" },
      ], "admin_only"),
    ],
  },
  {
    id: "booking",
    name: "حجوزات ومواعيد",
    category: "خدمات",
    description: "خدمات وموظفون وأوقات متاحة وحجوزات مع حالاتها.",
    tables: [
      t("services", "الخدمات", [
        { name: "name", type: "text", notNull: true },
        { name: "description", type: "text" },
        { name: "duration_minutes", type: "int4", notNull: true, default: "30" },
        { name: "price", type: "numeric", notNull: true, default: "0" },
        { name: "is_active", type: "bool", notNull: true, default: "true" },
      ], "public_read"),
      t("staff", "الموظفون", [
        OWNER,
        { name: "full_name", type: "text", notNull: true },
        { name: "role", type: "text" },
        { name: "is_active", type: "bool", notNull: true, default: "true" },
      ], "public_read", { indexes: ["user_id"] }),
      t("availability", "أوقات التوفّر", [
        { name: "staff_id", type: "uuid", notNull: true, ref: "staff" },
        { name: "weekday", type: "int4", notNull: true, default: "1" },
        { name: "start_time", type: "text", notNull: true, default: "09:00" },
        { name: "end_time", type: "text", notNull: true, default: "17:00" },
      ], "public_read", { indexes: ["staff_id"] }),
      t("bookings", "الحجوزات", [
        OWNER,
        { name: "service_id", type: "uuid", notNull: true, ref: "services" },
        { name: "staff_id", type: "uuid", ref: "staff" },
        { name: "starts_at", type: "timestamptz", notNull: true },
        { name: "ends_at", type: "timestamptz" },
        { name: "status", type: "text", notNull: true, default: "pending" },
        { name: "notes", type: "text" },
      ], "own_rows", { indexes: ["user_id", "service_id", "starts_at", "status"] }),
    ],
  },
  {
    id: "crm",
    name: "عملاء وصفقات (CRM)",
    category: "أعمال",
    description: "جهات اتصال وشركات وصفقات وأنشطة وملاحظات.",
    tables: [
      t("companies", "الشركات", [
        OWNER,
        { name: "name", type: "text", notNull: true },
        { name: "website", type: "text" },
        { name: "industry", type: "text" },
      ], "own_rows", { indexes: ["user_id"] }),
      t("contacts", "جهات الاتصال", [
        OWNER,
        { name: "company_id", type: "uuid", ref: "companies" },
        { name: "full_name", type: "text", notNull: true },
        { name: "email", type: "text" },
        { name: "phone", type: "text" },
      ], "own_rows", { indexes: ["user_id", "company_id"] }),
      t("deals", "الصفقات", [
        OWNER,
        { name: "contact_id", type: "uuid", ref: "contacts" },
        { name: "title", type: "text", notNull: true },
        { name: "amount", type: "numeric", notNull: true, default: "0" },
        { name: "stage", type: "text", notNull: true, default: "new" },
        { name: "close_date", type: "date" },
      ], "own_rows", { indexes: ["user_id", "stage"] }),
      t("activities", "الأنشطة", [
        OWNER,
        { name: "deal_id", type: "uuid", ref: "deals" },
        { name: "kind", type: "text", notNull: true, default: "note" },
        { name: "summary", type: "text" },
        { name: "due_at", type: "timestamptz" },
        { name: "done", type: "bool", notNull: true, default: "false" },
      ], "own_rows", { indexes: ["user_id", "deal_id"] }),
    ],
  },
  {
    id: "support",
    name: "الدعم الفني",
    category: "خدمات",
    description: "تذاكر ورسائل وإسناد وأولويات.",
    tables: [
      t("tickets", "التذاكر", [
        OWNER,
        { name: "subject", type: "text", notNull: true },
        { name: "body", type: "text" },
        { name: "priority", type: "text", notNull: true, default: "normal" },
        { name: "status", type: "text", notNull: true, default: "open" },
        { name: "assignee_id", type: "uuid" },
        { name: "closed_at", type: "timestamptz" },
      ], "own_rows", { indexes: ["user_id", "status", "assignee_id"] }),
      t("ticket_messages", "رسائل التذاكر", [
        { name: "ticket_id", type: "uuid", notNull: true, ref: "tickets" },
        OWNER,
        { name: "body", type: "text", notNull: true },
        { name: "is_internal", type: "bool", notNull: true, default: "false" },
      ], "own_rows", { indexes: ["ticket_id", "user_id"] }),
    ],
  },
  {
    id: "lms",
    name: "منصة تعليمية",
    category: "تعليم",
    description: "دورات ودروس وتسجيلات وتقدّم واختبارات.",
    tables: [
      t("courses", "الدورات", [
        { name: "slug", type: "text", notNull: true, unique: true },
        { name: "title", type: "text", notNull: true },
        { name: "description", type: "text" },
        { name: "price", type: "numeric", notNull: true, default: "0" },
        { name: "is_published", type: "bool", notNull: true, default: "false" },
      ], "public_read"),
      t("lessons", "الدروس", [
        { name: "course_id", type: "uuid", notNull: true, ref: "courses" },
        { name: "title", type: "text", notNull: true },
        { name: "content", type: "text" },
        { name: "video_url", type: "text" },
        { name: "position", type: "int4", notNull: true, default: "1" },
      ], "public_read", { indexes: ["course_id"] }),
      t("enrollments", "التسجيلات", [
        OWNER,
        { name: "course_id", type: "uuid", notNull: true, ref: "courses" },
        { name: "status", type: "text", notNull: true, default: "active" },
      ], "own_rows", { indexes: ["user_id", "course_id"] }),
      t("lesson_progress", "تقدّم الدروس", [
        OWNER,
        { name: "lesson_id", type: "uuid", notNull: true, ref: "lessons" },
        { name: "completed", type: "bool", notNull: true, default: "false" },
        { name: "completed_at", type: "timestamptz" },
      ], "own_rows", { indexes: ["user_id", "lesson_id"] }),
      t("quizzes", "الاختبارات", [
        { name: "lesson_id", type: "uuid", notNull: true, ref: "lessons" },
        { name: "question", type: "text", notNull: true },
        { name: "options", type: "jsonb", notNull: true, default: "'[]'::jsonb" },
        { name: "answer_index", type: "int4", notNull: true, default: "0" },
      ], "public_read", { indexes: ["lesson_id"] }),
    ],
  },
  {
    id: "marketing",
    name: "نشرة بريدية ونماذج اتصال",
    category: "تسويق",
    description: "مشتركون وحملات ورسائل التواصل الواردة.",
    tables: [
      t("subscribers", "المشتركون", [
        { name: "email", type: "text", notNull: true, unique: true },
        { name: "full_name", type: "text" },
        { name: "is_confirmed", type: "bool", notNull: true, default: "false" },
        { name: "unsubscribed_at", type: "timestamptz" },
      ], "admin_only"),
      t("campaigns", "الحملات", [
        { name: "subject", type: "text", notNull: true },
        { name: "body", type: "text" },
        { name: "status", type: "text", notNull: true, default: "draft" },
        { name: "sent_at", type: "timestamptz" },
      ], "admin_only"),
      t("contact_messages", "رسائل التواصل", [
        { name: "full_name", type: "text" },
        { name: "email", type: "text" },
        { name: "phone", type: "text" },
        { name: "message", type: "text", notNull: true },
        { name: "is_read", type: "bool", notNull: true, default: "false" },
      ], "admin_only", { indexes: ["created_at"] }),
    ],
  },
  {
    id: "analytics",
    name: "إحصائيات الموقع",
    category: "قياس",
    description: "زيارات الصفحات والأحداث والملخّص اليومي.",
    tables: [
      t("page_views", "زيارات الصفحات", [
        { name: "path", type: "text", notNull: true },
        { name: "referrer", type: "text" },
        { name: "session_id", type: "text" },
        { name: "country", type: "text" },
      ], "admin_only", { indexes: ["path", "created_at"] }),
      t("events", "الأحداث", [
        { name: "name", type: "text", notNull: true },
        { name: "props", type: "jsonb", default: "'{}'::jsonb" },
        { name: "session_id", type: "text" },
      ], "admin_only", { indexes: ["name", "created_at"] }),
      t("daily_stats", "الملخّص اليومي", [
        { name: "day", type: "date", notNull: true, unique: true },
        { name: "views", type: "int8", notNull: true, default: "0" },
        { name: "visitors", type: "int8", notNull: true, default: "0" },
        { name: "events_count", type: "int8", notNull: true, default: "0" },
      ], "admin_only"),
    ],
  },
];

export const TEMPLATE_TYPES = [
  "uuid", "text", "int4", "int8", "numeric", "bool", "jsonb", "timestamptz", "date", "float8",
];

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const safe = (value: string, label: string) => {
  if (!IDENT.test(value)) throw new Error(`اسم ${label} غير صالح: ${value}`);
  return value;
};
const literal = (value: unknown) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
};

export type BuildOptions = {
  schema?: string;
  prefix?: string;
  rls?: boolean;
  seeds?: boolean;
  ifNotExists?: boolean;
  tables?: string[]; // تقييد على جداول محددة
};

export function getTemplate(id: string): DbTemplate {
  const found = DB_TEMPLATES.find((tpl) => tpl.id === id);
  if (!found) throw new Error(`نموذج غير معروف: ${id}`);
  return found;
}

export function templateTableName(prefix: string | undefined, name: string) {
  const full = `${prefix ?? ""}${name}`;
  return safe(full, "الجدول");
}

/** يبني قائمة الأوامر الكاملة للنموذج (إنشاء + صلاحيات + RLS + سياسات + فهارس + مشغّل التحديث + بيانات تجريبية). */
export function buildTemplateSql(template: DbTemplate, options: BuildOptions = {}): string[] {
  const schema = safe(options.schema ?? "public", "المخطط");
  const prefix = options.prefix ? safe(options.prefix, "البادئة").replace(/_?$/, "_") : "";
  const withRls = options.rls !== false;
  const ine = options.ifNotExists !== false ? "if not exists " : "";
  const picked = options.tables?.length
    ? template.tables.filter((tbl) => options.tables!.includes(tbl.name))
    : template.tables;
  const out: string[] = [];

  out.push(
    `create or replace function "${schema}".tpl_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$`,
  );

  for (const tbl of picked) {
    const name = templateTableName(prefix, tbl.name);
    const cols = tbl.columns.map((col) => {
      const colName = safe(col.name, "العمود");
      const type = col.type.toLowerCase();
      if (!TEMPLATE_TYPES.includes(type)) throw new Error(`نوع غير مدعوم: ${type}`);
      return [
        `"${colName}" ${type}`,
        col.primary ? "primary key" : "",
        col.notNull && !col.primary ? "not null" : "",
        col.default ? `default ${col.default}` : "",
        col.unique && !col.primary ? "unique" : "",
      ].filter(Boolean).join(" ");
    });
    const refs = tbl.columns.filter((col) => col.ref).map((col) => {
      const target = templateTableName(prefix, safe(col.ref!, "الجدول المرجعي"));
      return `constraint "fk_${name}_${safe(col.name, "العمود")}" foreign key ("${col.name}") references "${schema}"."${target}"(id) on delete cascade`;
    });
    out.push(`create table ${ine}"${schema}"."${name}" (${[...cols, ...refs].join(", ")})`);
    out.push(`grant select, insert, update, delete on "${schema}"."${name}" to authenticated`);
    out.push(`grant all on "${schema}"."${name}" to service_role`);
    if (tbl.policy === "public_read" || tbl.policy === "public_read_own_write") {
      out.push(`grant select on "${schema}"."${name}" to anon`);
    }

    for (const index of tbl.indexes ?? []) {
      const col = safe(index, "العمود");
      out.push(`create index if not exists "idx_${name}_${col}" on "${schema}"."${name}" ("${col}")`);
    }

    out.push(`drop trigger if exists "trg_${name}_touch" on "${schema}"."${name}"`);
    out.push(`create trigger "trg_${name}_touch" before update on "${schema}"."${name}" for each row execute function "${schema}".tpl_touch_updated_at()`);

    if (withRls) {
      out.push(`alter table "${schema}"."${name}" enable row level security`);
      const owner = safe(tbl.ownerColumn ?? "user_id", "عمود المالك");
      const hasOwner = tbl.columns.some((col) => col.name === owner);
      const policy = (suffix: string, cmd: string, role: string, expr: string) => {
        const pname = `${name}_${suffix}`;
        out.push(`drop policy if exists "${pname}" on "${schema}"."${name}"`);
        out.push(cmd === "insert"
          ? `create policy "${pname}" on "${schema}"."${name}" for insert to ${role} with check (${expr})`
          : `create policy "${pname}" on "${schema}"."${name}" for ${cmd} to ${role} using (${expr})`);
      };
      const ownExpr = `auth.uid() = "${owner}"`;
      if (tbl.policy === "public_read") {
        policy("read_public", "select", "anon, authenticated", "true");
        policy("write_auth", "all", "authenticated", "auth.uid() is not null");
      } else if (tbl.policy === "public_read_own_write" && hasOwner) {
        policy("read_public", "select", "anon, authenticated", "true");
        policy("insert_own", "insert", "authenticated", ownExpr);
        policy("update_own", "update", "authenticated", ownExpr);
        policy("delete_own", "delete", "authenticated", ownExpr);
      } else if (tbl.policy === "own_rows" && hasOwner) {
        policy("select_own", "select", "authenticated", ownExpr);
        policy("insert_own", "insert", "authenticated", ownExpr);
        policy("update_own", "update", "authenticated", ownExpr);
        policy("delete_own", "delete", "authenticated", ownExpr);
      } else {
        policy("auth_only", "all", "authenticated", "auth.uid() is not null");
      }
    }

    if (options.seeds && tbl.seeds?.length) {
      for (const row of tbl.seeds) {
        const keys = Object.keys(row).map((key) => `"${safe(key, "العمود")}"`);
        const values = Object.values(row).map(literal);
        out.push(`insert into "${schema}"."${name}" (${keys.join(", ")}) values (${values.join(", ")}) on conflict do nothing`);
      }
    }
  }

  return out;
}

/** ملخّص مختصر للنموذج للعرض في الواجهة. */
export function templateSummary(template: DbTemplate) {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    tableCount: template.tables.length,
    tables: template.tables.map((tbl) => ({
      name: tbl.name,
      title: tbl.title,
      columns: tbl.columns.length,
      policy: tbl.policy,
      relations: tbl.columns.filter((col) => col.ref).map((col) => `${col.name} → ${col.ref}`),
      seeds: tbl.seeds?.length ?? 0,
    })),
  };
}
