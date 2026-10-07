import { isAdmin, json, readClickCounts, storageReady } from "./_ads.js";

export async function GET(request) {
  if (!isAdmin(request)) return json({ error: "Unauthorized" }, 401);
  if (!storageReady()) return json({ error: "Connect a public Vercel Blob store" }, 503);
  try { return json({ byAd: await readClickCounts() }); }
  catch { return json({ error: "Could not load click counts" }, 503); }
}
