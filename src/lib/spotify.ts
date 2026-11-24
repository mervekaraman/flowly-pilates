// Members can suggest their own Spotify playlist for a class; the trainer sees it with the request.
// Only Spotify links are accepted so nothing else ends up embedded on the trainer's screen.

type Kind = "playlist" | "album" | "track" | "artist" | "show" | "episode";
export type SpotifyLink = { url: string; embedUrl: string | null; kind: Kind | "link" };

const KINDS = "playlist|album|track|artist|show|episode";
// open.spotify.com links, also the old /user/<name>/playlist/… form, a country prefix (intl-tr) and no "https://".
const OPEN_LINK = new RegExp(`^(?:https?://)?open\\.spotify\\.com/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?(?:user/[^/?#\\s]+/)?(${KINDS})/([A-Za-z0-9]{22})(?:[/?#][^\\s]*)?$`, "i");
const URI = new RegExp(`^spotify:(?:user:[^:\\s]+:)?(${KINDS}):([A-Za-z0-9]{22})$`, "i");
// Share-sheet short links (spotify.link/…, spoti.fi/…) cannot be resolved offline; they are kept as plain links.
const SHORT_LINK = /^(?:https?:\/\/)?(spotify\.link|spoti\.fi)\/([A-Za-z0-9]{4,32})(?:[/?#]\S*)?$/i;
// Spotify's share sheet often copies a sentence around the link ("… dinle: https://…"); take the link out of it.
const IN_TEXT = /(?:https?:\/\/)?(?:open\.spotify\.com|spotify\.link|spoti\.fi)\/\S+|spotify:\S+/i;

/** Normalises a pasted Spotify link (drops tracking like ?si=…); null when it is not one. */
export function parseSpotifyLink(input: string | null | undefined): SpotifyLink | null {
  const value = (input ?? "").trim().match(IN_TEXT)?.[0].replace(/[.,;:!?)"'”’]+$/, "") ?? "";
  const match = value.match(OPEN_LINK) ?? value.match(URI);
  if (match) {
    const kind = match[1].toLowerCase() as Kind;
    return { url: `https://open.spotify.com/${kind}/${match[2]}`, embedUrl: `https://open.spotify.com/embed/${kind}/${match[2]}`, kind };
  }
  const short = value.match(SHORT_LINK);
  if (short) return { url: `https://${short[1].toLowerCase()}/${short[2]}`, embedUrl: null, kind: "link" };
  return null;
}
