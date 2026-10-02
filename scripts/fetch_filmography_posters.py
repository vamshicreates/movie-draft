"""Fetch poster files for new filmography entries from Wikipedia file pages.

Usage: python3 scripts/fetch_filmography_posters.py
The script writes local images and a JS path manifest. Failed lookups retain the
app's generated title card; it never substitutes an unrelated photograph.
"""

import concurrent.futures
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRAS = ROOT / "src/data/filmographyExtras.js"
DEST = ROOT / "public/posters/filmography"
MANIFEST = ROOT / "src/data/filmoPosterPaths.js"
API = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "MovieDraft/1.0 (film poster research; contact: https://github.com/vamshicreates/movie-draft)"}


def request_json(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=15) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))


def slug(value):
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def normalize(value):
    return set(re.findall(r"[a-z0-9]+", value.lower())) - {"the", "a", "an", "film", "movie"}


def page_images(title):
    result = request_json({"action": "query", "prop": "images", "titles": title,
                           "format": "json", "imlimit": 50})
    pages = result.get("query", {}).get("pages", {})
    page = next(iter(pages.values())) if pages else {}
    if "missing" in page:
        return []
    return [entry["title"] for entry in page.get("images", [])]


def best_image(images, title):
    words = normalize(title)
    scored = []
    for image in images:
        low = image.lower()
        if not low.endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        if any(word in low for word in ("flag of", "symbol", "logo", "icon", "commons", "map", "award", "premiere", "promotion in", "audio launch", "event", "trailer")):
            continue
        overlap = len(words & normalize(image))
        score = overlap * 3 + (5 if "poster" in low else 0) + (1 if "cover" in low else 0)
        if normalize(image.removeprefix("File:").rsplit(".", 1)[0]) == words:
            score += 5
        if score >= 3:
            scored.append((score, image))
    return max(scored, default=(0, None))[1]


def find_image(title, year):
    # Exact film page first; year and film suffixes cover common disambiguations.
    candidates = [f"{title} ({year} film)", f"{title} (film)", title,
                  f"{title} (Telugu film)", f"{title} (Indian film)"]
    for page in candidates:
        image = best_image(page_images(page), title)
        if image:
            return image
    return None


def image_url(file_title):
    result = request_json({"action": "query", "prop": "imageinfo", "titles": file_title,
                           "iiprop": "url|mime|size", "iiurlwidth": 600, "format": "json"})
    pages = result.get("query", {}).get("pages", {})
    page = next(iter(pages.values())) if pages else {}
    return next(iter(page.get("imageinfo", [])), {})


def fetch_one(entry):
    hero, title, year = entry
    movie_id = f"{hero}-{slug(title)}"
    try:
        file_title = find_image(title, year)
        if not file_title:
            return movie_id, None, "no poster file"
        info = image_url(file_title)
        url = info.get("thumburl") or info.get("url")
        if not url:
            return movie_id, None, "file unavailable"
        suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            return movie_id, None, "unsupported format"
        target = DEST / hero / f"{slug(title)}{suffix}"
        target.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20) as response:
            target.write_bytes(response.read(3_000_001))
        if target.stat().st_size > 3_000_000:
            target.unlink()
            return movie_id, None, "oversized download"
        path = "/" + str(target.relative_to(ROOT / "public"))
        return movie_id, path, file_title
    except Exception as error:
        return movie_id, None, str(error)


def parse_entries():
    content = EXTRAS.read_text()
    entries = []
    for hero, body in re.findall(r'\n  (nani|"allu-arjun"|prabhas|"mahesh-babu"): \[(.*?)\n  \],', content, re.S):
        for title, year in re.findall(r'\["([^"]+)", (\d{4})\]', body):
            entries.append((hero.strip('"'), title, int(year)))
    return entries


def main():
    entries = parse_entries()
    existing = dict(re.findall(r'"([^"]+)": "([^"]+)"', MANIFEST.read_text())) if MANIFEST.exists() else {}
    manifest = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        missing = [entry for entry in entries if not (
            existing.get(f"{entry[0]}-{slug(entry[1])}") and
            (ROOT / "public" / existing[f"{entry[0]}-{slug(entry[1])}"].lstrip("/")).exists()
        )]
        for entry in entries:
            movie_id = f"{entry[0]}-{slug(entry[1])}"
            path = existing.get(movie_id)
            if path and (ROOT / "public" / path.lstrip("/")).exists():
                manifest[movie_id] = path
        for movie_id, path, note in pool.map(fetch_one, missing):
            print(f"{movie_id}: {path or '-'} ({note})", flush=True)
            if path:
                manifest[movie_id] = path
    MANIFEST.write_text("// Local Wikipedia poster images fetched by scripts/fetch_filmography_posters.py\n"
                        + "export const posterPaths = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")
    print(f"Saved {len(manifest)} of {len(entries)} posters")


if __name__ == "__main__":
    main()
