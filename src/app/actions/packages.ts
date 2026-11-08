"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { memberPackages, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/dal";
import { isDayKey } from "@/lib/format";
import { fieldErrors, keepValues, type FormState } from "@/lib/forms";
import { notifyPackageAdded } from "@/lib/notify";
import { isUuid } from "@/lib/queries";

const packageInput = z.object({
  memberId: z.string().refine(isUuid),
  lessonCount: z.coerce.number({ message: "Ders sayısını yaz." }).int("Tam sayı olmalı.").min(1, "En az 1 ders.").max(200, "En fazla 200 ders."),
  startsOn: z.string().refine(isDayKey, "Başlangıç tarihini seç."),
  endsOn: z.string().refine(isDayKey, "Bitiş tarihini seç."),
}).refine((value) => value.endsOn >= value.startsOn, { message: "Bitiş, başlangıçtan önce olamaz.", path: ["endsOn"] });

/** Trainer enters a package the member bought at the studio; the member is told in the app. */
export async function addPackage(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = packageInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: keepValues(formData, ["lessonCount", "startsOn", "endsOn"]) };

  const db = await getDb();
  const [member] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, parsed.data.memberId), eq(users.role, "member"))).limit(1);
  if (!member) return { error: "Üye bulunamadı." };
  const [created] = await db.insert(memberPackages).values({ ...parsed.data, createdBy: user.id }).returning({ id: memberPackages.id });
  await audit(user.id, "package.add", { type: "package", id: created.id }, `üye ${member.id} · ${parsed.data.lessonCount} ders · ${parsed.data.startsOn} – ${parsed.data.endsOn}`);
  await notifyPackageAdded(member.id, parsed.data);
  refresh();
  return { ok: true, message: `${parsed.data.lessonCount} derslik paket tanımlandı.` };
}

/** Removes a package entered by mistake; lessons already taken from it simply stop counting against it. */
export async function deletePackage(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const id = String(formData.get("packageId") ?? "");
  if (!isUuid(id)) return { error: "Geçersiz işlem." };
  const [removed] = await (await getDb()).delete(memberPackages).where(eq(memberPackages.id, id))
    .returning({ memberId: memberPackages.memberId, lessonCount: memberPackages.lessonCount, startsOn: memberPackages.startsOn, endsOn: memberPackages.endsOn });
  if (!removed) return { error: "Paket bulunamadı." };
  await audit(user.id, "package.delete", { type: "package", id }, `üye ${removed.memberId} · ${removed.lessonCount} ders · ${removed.startsOn} – ${removed.endsOn}`);
  refresh();
  return { ok: true, message: "Paket silindi." };
}
