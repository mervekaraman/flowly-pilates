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

/**
 * Sender details that keep mail out of spam folders: the From address is the authenticated SMTP
 * account (so SPF/DKIM/DMARC line up), replies go to the studio, and List-Unsubscribe tells mail
 * providers how to stop notifications instead of the reader reaching for "report spam".
 */
function envelope() {
  const account = process.env.SMTP_USER;
  const from = process.env.MAIL_FROM ?? (account ? `${studio.name} <${account}>` : `${studio.name} <no-reply@localhost>`);
  const replyTo = studio.email || account;
  const unsubscribe = [replyTo && `<mailto:${replyTo}?subject=${encodeURIComponent("E-posta bildirimlerini kapat")}>`, `<${appUrl()}/profil/ayarlar>`].filter(Boolean).join(", ");
  return { from, replyTo, headers: { "List-Unsubscribe": unsubscribe } };
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
        ...envelope(), to: email.to, subject: email.subject, html, text,
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
      await transport.sendMail({ ...envelope(), to: row.to, subject: row.subject, html: row.html, text: row.text });
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
// Soft palette taken from the site: cream page, warm white card, plum accents.
const mailColors = { page: "#f3efe2", card: "#fffdf8", border: "#ebe4d2", soft: "#f7f2e6", ink: "#28171a", text: "#4f4744", muted: "#958c85", accent: "#77556d", accentSoft: "#efe6ea" };
const mailFont = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function render({ heading, paragraphs, details, action }: Email) {
  const c = mailColors;
  const href = action ? (action.href.startsWith("http") ? action.href : `${appUrl()}${action.href}`) : null;
  const detailRows = (details ?? []).map(([label, value], index) => {
    const border = index ? `border-top:1px solid ${c.border};` : "";
    return `<tr><td style="${border}padding:12px 18px;color:${c.muted};font-size:13px;width:40%">${escape(label)}</td><td style="${border}padding:12px 18px;color:${c.ink};font-size:14px;font-weight:600">${escape(value)}</td></tr>`;
  }).join("");
  const contact = [studio.address, studio.phone].filter(Boolean).map((item) => escape(item)).join(" · ");
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(heading)}</title></head>
<body style="margin:0;padding:0;background:${c.page};font-family:${mailFont};color:${c.ink};-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.page};padding:36px 14px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
<tr><td style="padding:0 8px 18px"><img src="${appUrl()}/images/flowly/email-logo.png" width="104" height="43" alt="flowly" style="display:block;border:0;width:104px;height:43px;font-family:${mailFont};font-size:30px;font-weight:700;color:${c.ink}"></td></tr>
<tr><td style="background:${c.card};border:1px solid ${c.border};border-radius:20px;padding:34px 30px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding-bottom:18px"><span style="display:inline-block;background:${c.accentSoft};color:${c.accent};font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:6px 12px;border-radius:999px">${escape(studio.name)}</span></td></tr>
<tr><td style="font-size:26px;font-weight:600;letter-spacing:-0.5px;line-height:1.22;color:${c.ink};padding-bottom:14px">${escape(heading)}</td></tr>
${paragraphs.map((paragraph) => `<tr><td style="font-size:15px;line-height:1.6;color:${c.text};padding-bottom:12px">${escape(paragraph)}</td></tr>`).join("\n")}
${detailRows ? `<tr><td style="padding:12px 0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.soft};border-radius:14px">${detailRows}</table></td></tr>` : ""}
${href && action ? `<tr><td style="padding-top:24px"><a href="${escape(href)}" style="display:inline-block;background:${c.accent};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:600">${escape(action.label)} &rarr;</a></td></tr>` : ""}
</table></td></tr>
<tr><td style="padding:22px 12px 0;font-size:12px;line-height:1.6;color:${c.muted}">Bu e-postayı ${escape(studio.name)} hesabındaki bir işlem nedeniyle aldın. Bildirim tercihlerini profil ayarlarından değiştirebilirsin.${contact ? `<br>${contact}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, "", ...paragraphs, ...(details ?? []).map(([label, value]) => `${label}: ${value}`), ...(href && action ? ["", `${action.label}: ${href}`] : [])].join("\n");
  return { html, text };
}
