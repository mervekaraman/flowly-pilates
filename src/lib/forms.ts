import type { z } from "zod";

// Shape every form action returns to `useActionState`.
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
  /** Machine-readable reason, e.g. "full" when the last seat went to someone else. */
  code?: "full";
} | undefined;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

/** Echo non-secret inputs back so a failed submit does not wipe the form. */
export function keepValues(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

/** Turkish numbers are stored in E.164 (+905321234567) so they can be reused for SMS/WhatsApp later. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^5\d{9}$/.test(digits)) return `+90${digits}`;
  if (/^05\d{9}$/.test(digits)) return `+9${digits}`;
  if (/^905\d{9}$/.test(digits)) return `+${digits}`;
  if (input.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const match = phone.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return match ? `+90 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : phone;
}
