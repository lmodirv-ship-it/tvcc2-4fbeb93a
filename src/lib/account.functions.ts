import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERMANENT_OWNERS = ["lmodirv@gmail.com", "info@hnchat.net", "taltnamart@gmail.com"];

/** Admins / platform owners can reset the password of any account from the dashboard. */
export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => {
    if (!input.userId) throw new Error("المستخدم مطلوب");
    if (!input.password || input.password.length < 8) throw new Error("كلمة السر يجب أن تكون 8 أحرف على الأقل");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
      sb.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      sb.rpc("has_role", { _user_id: context.userId, _role: "system_owner" }),
    ]);
    if (!isAdmin && !isOwner) throw new Error("غير مسموح — للمالك أو المدير فقط");

    const { data: target } = await sb.from("profiles").select("email").eq("id", data.userId).maybeSingle();
    const targetEmail = (target?.email ?? "").toLowerCase();

    // Only a platform owner may reset another platform owner's password.
    if (PERMANENT_OWNERS.includes(targetEmail) && !isOwner) {
      throw new Error("حساب مالك المنصة يمكن تعديله من المالك فقط");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email: targetEmail };
  });
