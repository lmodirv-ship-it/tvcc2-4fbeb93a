import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the payment instructions for the active default account.
 *  The table itself is owner/admin-only; this controlled endpoint exposes
 *  just the fields a signed-in buyer needs to complete a transfer. */
export const getCheckoutPaymentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("payment_accounts")
      .select("id,label,bank_name,holder,account_number,rib,iban,swift,currency,gateway_url,notes")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { account: data ?? null };
  });
