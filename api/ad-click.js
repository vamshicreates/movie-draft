import { put } from "@vercel/blob";
import { verifiedClick } from "./_ads.js";

export async function GET(request) {
  const click = verifiedClick(request.url);
  if (!click) return new Response("Invalid or expired ad link", { status: 400, headers: { "Cache-Control": "no-store" } });

  // Browsers mark user-opened links as navigations; ignore known prefetches and API fetches.
  if (!request.headers.get("sec-fetch-mode") || request.headers.get("sec-fetch-mode") === "navigate") {
    try {
      const pathname = `ads/clicks/${click.id}/${click.part}/${Date.now()}-${crypto.randomUUID()}.txt`;
      await put(pathname, "1", { access: "public", contentType: "text/plain", cacheControlMaxAge: 60 });
    } catch (error) {
      // A storage outage must not block the advertiser's destination.
      console.error("Could not record ad click", error);
    }
  }

  return new Response(null, { status: 302, headers: {
    Location: click.href,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  } });
}
