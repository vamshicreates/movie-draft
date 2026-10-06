import { json, isAdmin, storageReady, readConfig, writeConfig, validateAd, checkMedia } from "./_ads.js";

export async function GET(request) {
  if (!isAdmin(request)) return json({ error: "Incorrect admin password or AD_ADMIN_PASSWORD is not configured" }, 401);
  if (!storageReady()) return json({ error: "Connect a public Vercel Blob store to this project" }, 503);
  try { return json(await readConfig()); }
  catch { return json({ error: "Could not load ads from Vercel Blob" }, 503); }
}

export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: "Unauthorized" }, 401);
  if (!storageReady()) return json({ error: "Connect a public Vercel Blob store to this project" }, 503);
  try {
    const body = await request.json();
    if (!Array.isArray(body.ads) || body.ads.length > 30) return json({ error: "Save up to 30 ads" }, 400);
    const current = await readConfig();
    if (body.revision !== current.revision) return json({ error: "Ads changed in another tab. Reload before saving." }, 409);
    const ads = body.ads.map(validateAd);
    if (new Set(ads.map((ad) => ad.id)).size !== ads.length) throw new Error("Duplicate ad IDs");
    for (const ad of ads) await checkMedia(ad);
    const revision = await writeConfig(ads);
    return json({ revision, ads });
  } catch (error) {
    return json({ error: error.message || "Could not save ads" }, 400);
  }
}
