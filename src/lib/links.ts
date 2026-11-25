import "server-only";

import { headers } from "next/headers";
import QRCode from "qrcode";

const FALLBACK_HOST = "matchmaking.commander2x2.org";
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;

/** The origin the admin is browsing, for links they hand to players. Falls back to production. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const rawHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const host = HOST_PATTERN.test(rawHost) ? rawHost : FALLBACK_HOST;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = h.get("x-forwarded-proto") === "http" || local ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * An SVG QR code for `text`. Black on white whatever the theme: phone cameras need the
 * contrast, so these two colors are deliberately not theme tokens.
 */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}
