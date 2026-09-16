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

/** Creates a payment order with a server-recomputed amount.
 *  The client never supplies the price: the plan row is re-read server-side. */
export const createCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    planId: string;
    cycle: "monthly" | "yearly";
    buyerName?: string | null;
    buyerEmail?: string | null;
  }) => {
    if (!input?.planId || typeof input.planId !== "string") throw new Error("باقة غير صالحة");
    if (input.cycle !== "monthly" && input.cycle !== "yearly") throw new Error("دورة فوترة غير صالحة");
    const trim = (v: unknown, max: number) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
    return {
      planId: input.planId,
      cycle: input.cycle,
      buyerName: trim(input.buyerName, 120),
      buyerEmail: trim(input.buyerEmail, 200),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await (supabaseAdmin as any)
      .from("hosting_plans")
      .select("id,name,name_ar,price_monthly,price_yearly")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) throw new Error("الباقة غير موجودة");

    const monthly = Number(plan.price_monthly) || 0;
    const yearly = Number(plan.price_yearly) || monthly * 12;
    const amount = data.cycle === "yearly" ? yearly : monthly;

    const { data: account } = await (supabaseAdmin as any)
      .from("payment_accounts")
      .select("id")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: order, error } = await (supabaseAdmin as any)
      .from("payment_orders")
      .insert({
        user_id: context.userId,
        account_id: account?.id ?? null,
        plan_id: plan.id,
        plan_name: plan.name_ar || plan.name || "باقة",
        amount,
        currency: "USD",
        billing_cycle: data.cycle,
        buyer_name: data.buyerName,
        buyer_email: data.buyerEmail || (context.claims as any)?.email || null,
        method: "bank_transfer",
      })
      .select("reference")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { reference: order?.reference ?? "", amount };
  });
