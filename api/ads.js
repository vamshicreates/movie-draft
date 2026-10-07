import { clickUrl, json, publicAds, readConfig } from "./_ads.js";

export async function GET() {
  try {
    const { ads } = await readConfig();
    return json({ ads: publicAds(ads).map((ad) => ({
      ...ad,
      clickUrls: {
        image: clickUrl(ad, "image"),
        link: clickUrl(ad, "link"),
        text: clickUrl(ad, "text"),
      },
    })) }, 200, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" });
  } catch {
    // An ad service outage must never prevent a game from loading.
    return json({ ads: [] });
  }
}
