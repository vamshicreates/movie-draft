import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePages = JSON.parse(readFileSync(path.join(root, "scripts/poster-pages.json"), "utf8"));
const output = path.join(root, "src/data/wikiPosterPaths.js");
const pageToKeys = new Map();

for (const [filmKey, pageUrl] of Object.entries(sourcePages)) {
  const title = decodeURIComponent(new URL(pageUrl).pathname.split("/wiki/")[1] || "").replaceAll("_", " ");
  if (!title) continue;
  if (!pageToKeys.has(title)) pageToKeys.set(title, []);
  pageToKeys.get(title).push(filmKey);
}

const titles = [...pageToKeys.keys()];
const batches = Array.from({ length: Math.ceil(titles.length / 20) }, (_, i) => titles.slice(i * 20, (i + 1) * 20));
const posters = {};
const failures = [];
let nextBatch = 0;

async function queryPages(batch) {
  const params = new URLSearchParams({
    action: "query", prop: "pageimages", piprop: "thumbnail|name",
    pithumbsize: "500", pilicense: "any", redirects: "1",
    format: "json", formatversion: "2", titles: batch.join("|"),
  });
  const url = `https://en.wikipedia.org/w/api.php?${params}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "MovieDraft/1.0 (https://github.com/vamshicreates/movie-draft)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

async function worker() {
  while (nextBatch < batches.length) {
    const index = nextBatch++;
    const batch = batches[index];
    try {
      const data = await queryPages(batch);
      const aliases = new Map([...(data.query?.normalized || []), ...(data.query?.redirects || [])].map(({ from, to }) => [from, to]));
      const pages = new Map((data.query?.pages || []).map((page) => [page.title.toLowerCase(), page]));
      for (const title of batch) {
        let resolved = title;
        for (let i = 0; i < 3 && aliases.has(resolved); i += 1) resolved = aliases.get(resolved);
        const page = pages.get(resolved.toLowerCase());
        const image = page?.thumbnail;
        const isPoster = /poster/i.test(page?.pageimage || "");
        if (!image?.source?.startsWith("https://upload.wikimedia.org/") || (!isPoster && image.height < image.width * 1.05)) continue;
        for (const key of pageToKeys.get(title)) posters[key] = image.source;
      }
    } catch (error) {
      failures.push(`${index + 1}: ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: 3 }, worker));
if (failures.length) throw new Error(`Poster lookup failed for ${failures.length} batches: ${failures.join(", ")}`);

const sorted = Object.fromEntries(Object.entries(posters).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(output, `// Wikipedia page images for films in the supplied spreadsheets.\n// Refresh with: node scripts/fetch-poster-art.mjs\nexport const wikiPosterPaths = ${JSON.stringify(sorted, null, 2)};\n`);
console.log(`Found ${Object.keys(sorted).length} film poster images from ${titles.length} Wikipedia pages.`);
