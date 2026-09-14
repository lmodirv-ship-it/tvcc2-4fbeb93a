export type SecurityCategory =
  | "database"
  | "server_command"
  | "roles"
  | "vault"
  | "website"
  | "auth"
  | "settings";

export type SecurityEventInput = {
  category: SecurityCategory;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  severity?: "info" | "warning" | "critical";
  success?: boolean;
  details?: Record<string, unknown>;
};

/**
 * Writes a row into public.security_events. Never throws: logging must not
 * break the operation it is recording.
 */
export async function logSecurityEvent(
  supabase: any,
  userId: string,
  event: SecurityEventInput,
  actorEmail?: string | null,
) {
  try {
    await supabase.from("security_events").insert({
      actor_id: userId,
      actor_email: actorEmail ?? null,
      category: event.category,
      action: event.action,
      resource: event.resource ?? null,
      resource_id: event.resourceId ?? null,
      severity: event.severity ?? "info",
      success: event.success ?? true,
      details: event.details ?? {},
    });
  } catch {
    // intentionally ignored
  }
}
