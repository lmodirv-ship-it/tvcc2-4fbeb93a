/** Write permission is granted by an explicit edit command inside the message — not by a toggle. */

const EDIT_PATTERNS: RegExp[] = [
  /^\s*\/(edit|write|apply|fix|تعديل|عدل|نفذ)\b/i,
  /(^|\s)(عدّل|عدل|حدّث|حدث|اكتب|أنشئ|انشئ|احذف|طبّق|طبق|نفّذ التعديل|نفذ التعديل)\s/,
  /(^|\s)(أمر التعديل|امر التعديل)/,
  /\b(apply changes?|write the file|make the edit)\b/i,
];

/** True when the user's message contains an explicit edit command. */
export function hasEditCommand(message: string): boolean {
  const text = (message ?? "").trim();
  if (!text) return false;
  return EDIT_PATTERNS.some((re) => re.test(text));
}

export const EDIT_COMMAND_HINT =
  "التعديل يتم بأمر صريح: ابدأ رسالتك بـ /تعديل أو اكتب «عدّل …» / «نفّذ التعديل …» لتفعيل صلاحية الكتابة لهذه الرسالة فقط.";
