import "server-only";
import { getDb } from "@/db";
import { auditEvents } from "@/db/schema";

/**
 * Records who changed what (see `auditEvents` in the schema). Ids and short facts only, never notes or
 * contact details. A failed write is logged and swallowed: the trainer's action itself must not fail.
 */
export async function audit(actorId: string | null, action: string, target: { type: string; id?: string | null }, detail?: string) {
  try {
    await (await getDb()).insert(auditEvents).values({ actorId, action, targetType: target.type, targetId: target.id ?? null, detail: detail?.slice(0, 300) ?? null });
  } catch (error) {
    console.error("audit kaydı yazılamadı", action, error instanceof Error ? error.message : error);
  }
}
