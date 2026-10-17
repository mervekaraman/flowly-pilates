// "Add to calendar" for a booking, like airlines do for flights: an .ics file (Apple Calendar,
// Outlook, Gmail's invite card) and a Google Calendar link. One stable UID per booking means a
// later CANCEL with the same UID removes the event the member added earlier.

export type CalendarEvent = {
  uid: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
  description: string;
  location: string;
  url: string;
  cancelled?: boolean;
  /** Bumped on every change so calendars apply the newest version. */
  sequence?: number;
};

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Every line break form (CRLF, CR, LF) becomes the escaped "\n" and other control characters are
// dropped, so text from a name or note can never start a new calendar property.
const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/([,;])/g, "\\$1");

/** RFC 5545 lines are at most 75 octets; longer ones continue on the next line after a space. */
function fold(line: string) {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (bytes.encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function bookingIcs(event: CalendarEvent, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flowly Pilates//Rezervasyon//TR",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${escapeText(event.cancelled ? `İptal: ${event.title}` : event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    `URL:${event.url}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(event.cancelled ? [] : ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reformer dersin 1 saat sonra", "TRIGGER:-PT1H", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function googleCalendarLink(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`,
    details: `${event.description}\n\n${event.url}`,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
