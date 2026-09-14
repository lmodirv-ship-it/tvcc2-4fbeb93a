/** قراءة نتائج أوامر الوكيل الخاصة بمحرر الجداول. */

export type AgentCommand = {
  id: string;
  action: string;
  args: Record<string, any> | null;
  status: string;
  output: unknown;
  exit_code: number | null;
  created_at: string;
  completed_at: string | null;
};

export function parseOutput(output: unknown): any {
  if (output === null || output === undefined) return null;
  let parsed: any = output;
  if (typeof parsed === "string") {
    const text = parsed.trim();
    if (!text) return null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { text };
    }
  }
  return parsed;
}

/** استخراج مصفوفة صفوف من ناتج الوكيل مهما كان شكل الغلاف. */
export function extractRows(output: unknown): any[] | null {
  const parsed = parseOutput(output);
  if (!parsed) return null;
  if (Array.isArray(parsed)) return parsed;
  for (const key of ["rows", "result", "data", "records", "items"]) {
    const value = parsed[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray(value.rows)) return value.rows;
  }
  return null;
}

export function extractTotal(output: unknown): number | null {
  const parsed = parseOutput(output);
  if (!parsed || typeof parsed !== "object") return null;
  const raw = parsed.total ?? parsed.count ?? parsed.total_count ?? parsed.rows_count;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** أحدث أمر يطابق الفعل والشروط. */
export function findCommand(
  commands: AgentCommand[],
  action: string,
  match?: (args: Record<string, any>) => boolean,
): AgentCommand | undefined {
  return commands.find((row) => row.action === action && (!match || match(row.args ?? {})));
}

export function commandTone(status?: string) {
  if (status === "completed" || status === "done" || status === "success") return "default" as const;
  if (status === "pending" || status === "running" || status === "queued") return "secondary" as const;
  return "outline" as const;
}

export function toCsv(rows: any[], headers: string[]) {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([`\uFEFF${content}`], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
