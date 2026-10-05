"""Fetch available movie poster files for the curated actor catalogs.

Usage: python3 scripts/fetch_filmography_posters.py
The script writes local images and a JS path manifest. Failed lookups retain the
app's generated title card; it never substitutes an unrelated photograph. It
requests one film at a time and stops if Wikimedia responds with a rate limit.
"""

import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/posters/filmography"
MANIFEST = ROOT / "src/data/filmoPosterPaths.js"
API = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "MovieDraft/1.0 (film poster research; contact: https://github.com/vamshicreates/movie-draft)"}


def request_json(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            time.sleep(0.45)
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=15) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 429:
                raise
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def slug(value):
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def normalize(value):
    return set(re.findall(r"[a-z0-9]+", value.lower())) - {"the", "a", "an", "film", "movie"}


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
    alternate_pages = {
        "Geetanjali": "Geethanjali (1989 film)",
        "Siva": "Shiva (1989 Telugu film)",
        "Swarna Kamalam": "Swarnakamalam",
        "Student No. 1": "Student No: 1",
        "Aadi": "Aadhi (2002 film)",
        "Shiva Manasulo Shruti": "Siva Manasulo Sruthi",
        "Appatlo Okadundevaadu": "Appatlo Okadundevadu",
        "Life Before Wedding": "LBW (Life Before Wedding)",
        "Leo": "Leo (2023 Indian film)",
        "Beast": "Beast (2022 Indian film)",
        "Utsavam": "Utsavam (2024 film)",
        "Aankh Micholi": "Aankh Micholi (2023 film)",
        "Love Me": "Love Me (2024 Indian film)",
    }
    candidates = [alternate_pages[title]] if title in alternate_pages else []
    candidates += [f"{title} ({year} film)", f"{title} (film)", title,
                  f"{title} (Telugu film)", f"{title} (Indian film)"]
    result = request_json({"action": "query", "prop": "images", "titles": "|".join(candidates),
                           "format": "json", "imlimit": 50})
    pages = {page.get("title"): page for page in result.get("query", {}).get("pages", {}).values()}
    for candidate in candidates:
        page = pages.get(candidate, {})
        image = best_image([entry["title"] for entry in page.get("images", [])], alternate_pages.get(title, title))
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
    hero, title, year, movie_id = entry
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
        time.sleep(0.45)
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
    script = "import { STARS_CATALOG } from './src/data/moviesData.js'; const lists = STARS_CATALOG.map(s => s.movies.filter(m => m.poster.startsWith('data:')).map(m => [s.id, m.title, m.year, m.id])); console.log(JSON.stringify(Array.from({length: Math.max(...lists.map(a => a.length))}, (_, i) => lists.map(a => a[i]).filter(Boolean)).flat()))"
    output = subprocess.check_output(["node", "--input-type=module", "-e", script], cwd=ROOT, text=True)
    return json.loads(output)


def main():
    entries = parse_entries()
    existing = dict(re.findall(r'"([^"]+)": "([^"]+)"', MANIFEST.read_text())) if MANIFEST.exists() else {}
    manifest = dict(existing)
    missing = [entry for entry in entries if not (
        existing.get(entry[3]) and
        (ROOT / "public" / existing[entry[3]].lstrip("/")).exists()
    )]
    for entry in missing:
        movie_id, path, note = fetch_one(entry)
        print(f"{movie_id}: {path or '-'} ({note})", flush=True)
        if path:
            manifest[movie_id] = path
            MANIFEST.write_text("// Local Wikipedia poster images fetched by scripts/fetch_filmography_posters.py\n"
                                + "export const posterPaths = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")
        if "429" in note:
            print("Rate limited by Wikipedia; stopping poster downloads.", flush=True)
            break
    print(f"Saved {len(manifest)} of {len(entries)} posters")


if __name__ == "__main__":
    main()
