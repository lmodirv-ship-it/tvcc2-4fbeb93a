import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI workspace: browse server files, read them, and organize development tasks. */

async function agentCall(
  sb: any,
  ownerId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  waitMs = 30000,
) {
  const { data: row, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      action,
      args,
      dry_run: false,
      requested_by: ownerId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const id = row?.id as string;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const { data: c } = await sb
      .from("server_commands")
      .select("status, output, error_message, exit_code")
      .eq("id", id)
      .maybeSingle();
    if (c && ["done", "success", "failed", "error"].includes(String(c.status))) {
      return {
        id,
        status: String(c.status),
        output: String(c.output ?? c.error_message ?? ""),
        exitCode: c.exit_code ?? null,
      };
    }
  }
  return { id, status: "pending", output: "بانتظار نبضة الوكيل…", exitCode: null };
}

export const browseServerPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; path?: string }) => input)
  .handler(async ({ data, context }) =>
    agentCall(context.supabase as any, context.userId, data.serverId, "fs_list", {
      path: data.path ?? "",
    }),
  );

export const readServerFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; path: string; limit?: number }) => input)
  .handler(async ({ data, context }) =>
    agentCall(context.supabase as any, context.userId, data.serverId, "fs_read", {
      path: data.path,
      limit: data.limit ?? 400,
    }),
  );

export const searchServerFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; path?: string; query: string }) => input)
  .handler(async ({ data, context }) =>
    agentCall(context.supabase as any, context.userId, data.serverId, "fs_search", {
      path: data.path ?? "",
      query: data.query,
    }),
  );

export const listAiTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("ai_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const saveAiTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string | null;
    title: string;
    instructions?: string;
    filePaths?: string[];
    serverId?: string | null;
    websiteId?: string | null;
    status?: string;
    priority?: number;
    result?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      title: data.title,
      instructions: data.instructions ?? "",
      file_paths: data.filePaths ?? [],
      server_id: data.serverId ?? null,
      website_id: data.websiteId ?? null,
      status: data.status ?? "pending",
      priority: data.priority ?? 2,
      result: data.result ?? null,
    };
    const { error } = data.id
      ? await sb.from("ai_tasks").update(row).eq("id", data.id)
      : await sb.from("ai_tasks").insert({ ...row, owner_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAiTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("ai_tasks")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAiTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("ai_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
