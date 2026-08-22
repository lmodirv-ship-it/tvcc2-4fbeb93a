/** Runs a development task with an AI model, recording every stage into ai_task_steps. */
import { callModel, type ChatMsg } from "./ai-hub.server";
import { runTool } from "./ai-tools.server";

async function addStep(
  sb: any,
  userId: string,
  taskId: string,
  stage: string,
  title: string,
  detail?: string | null,
  toolName?: string | null,
  status = "done",
) {
  const { count } = await sb
    .from("ai_task_steps")
    .select("*", { count: "exact", head: true })
    .eq("task_id", taskId);
  await sb.from("ai_task_steps").insert({
    owner_id: userId,
    task_id: taskId,
    step_no: (count ?? 0) + 1,
    stage,
    title,
    detail: detail ? String(detail).slice(0, 4000) : null,
    tool_name: toolName ?? null,
    status,
  });
}

export async function runTaskWithModel(
  sb: any,
  userId: string,
  taskId: string,
  modelIdOverride?: string | null,
) {
  const { data: task } = await sb.from("ai_tasks").select("*").eq("id", taskId).maybeSingle();
  if (!task) throw new Error("المهمة غير موجودة");

  const modelId = modelIdOverride ?? task.model_id;
  if (!modelId) throw new Error("اختر نموذجاً لتنفيذ المهمة");
  const { data: model } = await sb.from("ai_models").select("*").eq("id", modelId).maybeSingle();
  if (!model) throw new Error("النموذج غير موجود");
  if (model.kind === "local") {
    throw new Error("النماذج المحلية تُشغَّل من صفحة المحادثة (تعمل عبر المتصفح).");
  }
  const { data: provider } = await sb.from("ai_providers").select("*").eq("id", model.provider_id).maybeSingle();
  if (!provider) throw new Error("المزوّد غير موجود");

  const allowWrites = !!task.allow_edit;
  const started = Date.now();

  await sb.from("ai_tasks").update({
    status: "running",
    stage: "planning",
    progress: Math.max(5, Number(task.progress) || 0),
    model_id: modelId,
    started_at: task.started_at ?? new Date().toISOString(),
    last_step_at: new Date().toISOString(),
  }).eq("id", taskId);

  await addStep(sb, userId, taskId, "planning", `بدء التنفيذ بالنموذج ${model.name}`, task.instructions ?? "", null, "done");

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        "أنت منفّذ مهام TVCC لتطوير المواقع والسيرفرات. نفّذ المهمة خطوة بخطوة بالعربية. " +
        `معرّف المهمة: ${taskId}. ` +
        "بعد كل خطوة استدعِ log_task_step، وحدّث المرحلة والنسبة بـ set_task_progress، " +
        "وعند الانتهاء استدعِ set_task_progress بـ status=done مع ملخّص النتيجة في result. " +
        (allowWrites
          ? "لديك أمر تعديل معتمد لهذه المهمة: يمكنك استخدام أدوات الكتابة اللازمة فقط."
          : "ليس لديك أمر تعديل: اقرأ وحلّل واقترح الخطوات دون أي كتابة أو حذف.") +
        (task.server_id ? ` سيرفر العمل: ${task.server_id} (أدوات fs_* تعمل عليه).` : "") +
        (Array.isArray(task.file_paths) && task.file_paths.length
          ? ` الملفات المستهدفة: ${task.file_paths.join("، ")}.`
          : ""),
    },
    {
      role: "user",
      content: `المهمة: ${task.title}\n\nالتعليمات:\n${task.instructions || "(بدون تفاصيل إضافية)"}`,
    },
  ];

  let answer = "";
  try {
    for (let step = 0; step < 12; step++) {
      const json = await callModel(model, provider, messages, true);
      const msg = json?.choices?.[0]?.message;
      if (!msg) throw new Error("رد غير متوقع من النموذج");
      const calls = msg.tool_calls ?? [];
      if (calls.length) {
        messages.push(msg as ChatMsg);
        for (const c of calls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* ignore */ }
          if (args.task_id === undefined && ["log_task_step", "set_task_progress"].includes(String(c.function?.name))) {
            args.task_id = taskId;
          }
          const result = await runTool(sb, userId, String(c.function?.name ?? ""), args, allowWrites, {
            serverId: task.server_id ?? null,
            websiteId: task.website_id ?? null,
          });
          if (!["log_task_step", "set_task_progress"].includes(String(c.function?.name))) {
            await addStep(
              sb, userId, taskId, "working",
              `تنفيذ الأداة ${c.function?.name}`,
              JSON.stringify(result).slice(0, 1500),
              String(c.function?.name ?? ""),
              (result as any)?.error ? "failed" : "done",
            );
          }
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 8000) } as ChatMsg);
        }
        continue;
      }
      answer = msg.content ?? "";
      break;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await addStep(sb, userId, taskId, "failed", "توقّف التنفيذ", message, null, "failed");
    await sb.from("ai_tasks").update({
      status: "failed", stage: "failed", result: message, last_step_at: new Date().toISOString(),
    }).eq("id", taskId);
    throw e;
  }

  const { data: fresh } = await sb.from("ai_tasks").select("status, progress").eq("id", taskId).maybeSingle();
  const finished = fresh?.status === "done";
  await sb.from("ai_tasks").update({
    status: finished ? "done" : "review",
    stage: finished ? "done" : "verifying",
    progress: finished ? 100 : Math.max(Number(fresh?.progress) || 0, 80),
    result: answer || fresh?.status,
    completed_at: new Date().toISOString(),
    last_step_at: new Date().toISOString(),
  }).eq("id", taskId);

  await addStep(sb, userId, taskId, "done", "انتهى التنفيذ", answer.slice(0, 3000), null, "done");

  await sb.from("ai_models").update({ last_latency_ms: Date.now() - started, status: "ready" }).eq("id", modelId);

  return { ok: true, answer, duration_ms: Date.now() - started };
}
