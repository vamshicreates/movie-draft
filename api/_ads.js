import { timingSafeEqual, createHash } from "node:crypto";
import { list, put, head } from "@vercel/blob";

export const PLACEMENTS = ["home", "live", "waiting", "results"];
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];
const CONFIG_PREFIX = "ads/config/";

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function storageReady() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
}

export function isAdmin(request) {
  const expected = process.env.AD_ADMIN_PASSWORD;
  if (!expected || expected.length < 16) return false;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;
  let actual;
  try {
    const pair = Buffer.from(auth.slice(6), "base64").toString("utf8");
    actual = pair.startsWith("admin:") ? pair.slice(6) : "";
  } catch { return false; }
  const one = createHash("sha256").update(actual).digest();
  const two = createHash("sha256").update(expected).digest();
  return timingSafeEqual(one, two);
}

export async function readConfig() {
  if (!storageReady()) return { revision: null, ads: [] };
  let cursor;
  let latest = null;
  do {
    const page = await list({ prefix: CONFIG_PREFIX, limit: 1000, cursor });
    for (const blob of page.blobs) {
      if (!blob.pathname.endsWith(".json")) continue;
      if (!latest || blob.pathname > latest.pathname) latest = blob;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (!latest) return { revision: null, ads: [] };
  const response = await fetch(latest.url);
  if (!response.ok) throw new Error("Could not read ad configuration");
  const config = await response.json();
  return { revision: latest.pathname, ads: Array.isArray(config.ads) ? config.ads : [] };
}

export async function writeConfig(ads) {
  const revision = `${CONFIG_PREFIX}${Date.now().toString().padStart(13, "0")}-${crypto.randomUUID()}.json`;
  await put(revision, JSON.stringify({ ads }), {
    access: "public", contentType: "application/json", cacheControlMaxAge: 60,
  });
  return revision;
}

export function publicAds(ads, now = Date.now()) {
  return ads.filter((ad) => ad.enabled && (!ad.startsAt || Date.parse(ad.startsAt) <= now) &&
    (!ad.endsAt || Date.parse(ad.endsAt) > now));
}

export function validateAd(ad) {
  if (!ad || typeof ad !== "object") throw new Error("Invalid ad record");
  if (!PLACEMENTS.includes(ad.placement)) throw new Error("Choose a valid placement");
  const title = String(ad.title || "").trim();
  const copy = String(ad.copy || "").trim();
  const cta = String(ad.cta || "Explore").trim();
  if (!title || title.length > 80) throw new Error("Ad title must be 1–80 characters");
  if (copy.length > 140) throw new Error("Ad description can be at most 140 characters");
  if (!cta || cta.length > 28) throw new Error("Button text must be 1–28 characters");
  const href = String(ad.href || "").trim();
  let destination;
  try { destination = new URL(href); } catch { throw new Error("Enter a valid destination URL"); }
  if (destination.protocol !== "https:") throw new Error("Destination URL must start with https://");
  const mediaUrl = String(ad.mediaUrl || "").trim();
  let media;
  try { media = new URL(mediaUrl); } catch { throw new Error("Upload an image, GIF or MP4 video"); }
  if (media.protocol !== "https:" || !media.hostname.endsWith(".public.blob.vercel-storage.com") ||
      !media.pathname.includes("/ads/media/")) throw new Error("Upload media through this admin panel");
  const startsAt = ad.startsAt ? new Date(ad.startsAt).toISOString() : "";
  const endsAt = ad.endsAt ? new Date(ad.endsAt).toISOString() : "";
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error("End date must follow start date");
  return {
    id: typeof ad.id === "string" && /^[a-zA-Z0-9-]{8,50}$/.test(ad.id) ? ad.id : crypto.randomUUID(),
    placement: ad.placement, title, copy, cta, href: destination.href, mediaUrl: media.href,
    mediaType: ad.mediaType === "video/mp4" ? "video/mp4" : String(ad.mediaType || ""),
    enabled: Boolean(ad.enabled), startsAt, endsAt,
  };
}

export async function checkMedia(ad) {
  const info = await head(ad.mediaUrl);
  if (!info.pathname.startsWith("ads/media/") || !MEDIA_TYPES.includes(info.contentType)) {
    throw new Error("Uploaded media type is not supported");
  }
  if (info.size > 15 * 1024 * 1024) throw new Error("Media must be 15 MB or less");
  if (info.contentType !== ad.mediaType) throw new Error("Media type does not match the upload");
  if (info.contentType === "video/mp4") {
    const response = await fetch(ad.mediaUrl);
    if (!response.ok) throw new Error("Could not validate video");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("Video must be 15 MB or less");
    const seconds = mp4Duration(bytes);
    if (!(seconds > 0 && seconds <= 10.05)) throw new Error("MP4 video must be 10 seconds or less");
  }
}

// MP4 movie-header duration; rejecting files without a valid movie header keeps
// the 10-second rule enforceable even if someone bypasses the browser form.
export function mp4Duration(buffer) {
  const view = new DataView(buffer);
  const text = (at) => String.fromCharCode(...new Uint8Array(buffer, at, 4));
  function boxes(start, end) {
    const found = [];
    for (let at = start; at + 8 <= end;) {
      let size = view.getUint32(at);
      const type = text(at + 4);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) break;
        const large = view.getBigUint64(at + 8);
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) break;
        size = Number(large);
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) break;
      found.push({ type, start: at + header, end: at + size });
      at += size;
    }
    return found;
  }
  const moov = boxes(0, buffer.byteLength).find((box) => box.type === "moov");
  const mvhd = moov && boxes(moov.start, moov.end).find((box) => box.type === "mvhd");
  if (!mvhd) return NaN;
  const version = view.getUint8(mvhd.start);
  const timescaleAt = mvhd.start + (version === 1 ? 20 : 12);
  const durationAt = mvhd.start + (version === 1 ? 24 : 16);
  if (durationAt + (version === 1 ? 8 : 4) > mvhd.end) return NaN;
  const timescale = view.getUint32(timescaleAt);
  const duration = version === 1 ? Number(view.getBigUint64(durationAt)) : view.getUint32(durationAt);
  return timescale ? duration / timescale : NaN;
}
