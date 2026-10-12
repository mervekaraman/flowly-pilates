import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailOutbox } from "@/db/schema";
import { maskEmail } from "@/lib/privacy";
import { studio } from "@/lib/studio";

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");

let transporter: Transporter | null | undefined;
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return (transporter = null);
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export const isMailConfigured = () => Boolean(process.env.SMTP_HOST);

type Email = {
  to: string; subject: string; heading: string; paragraphs: string[]; details?: [string, string][]; action?: { label: string; href: string };
  /** Calendar event (.ics) — mail apps show it as an "add to calendar" card, like airline bookings. */
  calendar?: { ics: string; cancelled?: boolean };
  /** The action link is a secret (password reset, e-mail change): never keep a working copy once sent. */
  sensitive?: boolean;
};

/** Sends through SMTP when configured; otherwise the message is only recorded (visible at /gelistirici/e-postalar in development). */
export async function sendEmail(email: Email) {
  const { html, text } = render(email);
  let status: "sent" | "logged" | "failed" = "logged";
  let error: string | null = null;
  // Reserved test domains (demo accounts like duygu@demo.smeda.test) can never receive mail; sending
  // would only bounce back to the studio inbox and hurt its reputation, so they are recorded instead.
  const undeliverable = /\.(test|example|invalid|localhost|local)$/i.test(email.to.trim());
  const transport = undeliverable ? null : getTransporter();
  if (transport) {
    try {
      await transport.sendMail({
        from: process.env.MAIL_FROM ?? `${studio.name} <no-reply@localhost>`, to: email.to, subject: email.subject, html, text,
        icalEvent: email.calendar ? { filename: "flowly-pilates-ders.ics", method: email.calendar.cancelled ? "CANCEL" : "PUBLISH", content: email.calendar.ics } : undefined,
      });
      status = "sent";
    } catch (cause) {
      status = "failed";
      error = cause instanceof Error ? cause.message : String(cause);
      console.error(`[e-posta] ${maskEmail(email.to)} adresine gönderilemedi: ${error}`);
    }
  } else {
    console.info(`[e-posta] ${undeliverable ? "Demo adresi" : "SMTP ayarlı değil"}, kaydedildi → ${maskEmail(email.to)}`);
  }
  // The stored copy keeps a working secret link only for local testing without SMTP; once a message
  // has really gone out (or in production) the link is blanked so a database leak cannot reuse it.
  const keepLink = !email.sensitive || (status !== "sent" && process.env.NODE_ENV !== "production");
  const stored = keepLink ? { html, text } : redact({ html, text }, email.action?.href);
  await (await getDb()).insert(emailOutbox).values({ to: email.to, subject: email.subject, html: stored.html, text: stored.text, status, error, retryable: !email.sensitive });
}

function redact(copy: { html: string; text: string }, href: string | undefined) {
  if (!href) return copy;
  const absolute = href.startsWith("http") ? href : `${appUrl()}${href}`;
  const hidden = "[gizli bağlantı]";
  return { html: copy.html.split(escape(absolute)).join(hidden).split(absolute).join(hidden), text: copy.text.split(absolute).join(hidden) };
}

/** Retries non-sensitive failed messages. Password reset mail is intentionally never replayed. */
export async function retryFailedEmails(limit = 25) {
  const transport = getTransporter();
  if (!transport) throw new Error("SMTP ayarlı değil.");
  const db = await getDb();
  const rows = await db.select().from(emailOutbox)
    .where(and(eq(emailOutbox.status, "failed"), eq(emailOutbox.retryable, true))).limit(limit);
  let sent = 0;
  for (const row of rows) {
    try {
      await transport.sendMail({ from: process.env.MAIL_FROM ?? `${studio.name} <no-reply@localhost>`, to: row.to, subject: row.subject, html: row.html, text: row.text });
      await db.update(emailOutbox).set({ status: "sent", error: null, attempts: row.attempts + 1 }).where(eq(emailOutbox.id, row.id));
      sent += 1;
    } catch (cause) {
      await db.update(emailOutbox).set({ error: cause instanceof Error ? cause.message : String(cause), attempts: row.attempts + 1 }).where(eq(emailOutbox.id, row.id));
    }
  }
  return { attempted: rows.length, sent };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// Table-based, inline-styled layout so it renders the same in Gmail, Outlook and Apple Mail.
function render({ heading, paragraphs, details, action }: Email) {
  const href = action ? (action.href.startsWith("http") ? action.href : `${appUrl()}${action.href}`) : null;
  const detailRows = (details ?? []).map(([label, value]) => `<tr><td style="padding:10px 0;border-top:1px solid #e6e1cf;color:#77716c;font-size:13px;width:38%">${escape(label)}</td><td style="padding:10px 0;border-top:1px solid #e6e1cf;color:#1d1b1b;font-size:14px;font-weight:600">${escape(value)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f1edda;font-family:Helvetica,Arial,sans-serif;color:#1d1b1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1edda;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f8f5e8;border-radius:14px;padding:36px 32px">
<tr><td style="font-size:28px;font-weight:700;letter-spacing:-1px;padding-bottom:4px">flowly</td></tr>
<tr><td style="font-size:11px;letter-spacing:3px;color:#77716c;text-transform:uppercase;padding-bottom:28px">${escape(studio.name)}</td></tr>
<tr><td style="font-size:26px;font-weight:600;letter-spacing:-0.5px;line-height:1.2;padding-bottom:14px">${escape(heading)}</td></tr>
${paragraphs.map((paragraph) => `<tr><td style="font-size:15px;line-height:1.55;color:#3a3232;padding-bottom:12px">${escape(paragraph)}</td></tr>`).join("")}
${detailRows ? `<tr><td style="padding:10px 0 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table></td></tr>` : ""}
${href && action ? `<tr><td style="padding-top:22px"><a href="${escape(href)}" style="display:inline-block;background:#28171a;color:#f1edda;text-decoration:none;padding:14px 26px;border-radius:8px;font-size:15px">${escape(action.label)} →</a></td></tr>` : ""}
<tr><td style="padding-top:30px;font-size:12px;color:#77716c;line-height:1.5">Bu e-postayı ${escape(studio.name)} hesabındaki bir işlem nedeniyle aldın. Bildirim tercihlerini profil ayarlarından değiştirebilirsin.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, "", ...paragraphs, ...(details ?? []).map(([label, value]) => `${label}: ${value}`), ...(href && action ? ["", `${action.label}: ${href}`] : [])].join("\n");
  return { html, text };
}
