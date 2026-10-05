import { posterPaths } from "./filmoPosterPaths.js";
import { textPoster } from "./filmographyExtras.js";
import { SHEET_FILMOGRAPHY } from "./sheetFilmography.js";

function slug(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function filmKey(title, year) {
  return `${slug(title)}|${year}`;
}

export function addSheetFilmography(stars) {
  for (const star of stars) {
    const films = SHEET_FILMOGRAPHY[star.category]?.[star.name];
    if (!films) continue;

    const existingFilms = new Set(star.movies.map((movie) => filmKey(movie.title, movie.year)));
    const usedIds = new Set(star.movies.map((movie) => movie.id));

    for (const [title, year] of films) {
      const key = filmKey(title, year);
      if (existingFilms.has(key)) continue;

      const baseId = `${star.id}-${slug(title)}`;
      let id = usedIds.has(baseId) ? `${baseId}-${year}` : baseId;
      for (let suffix = 2; usedIds.has(id); suffix += 1) id = `${baseId}-${year}-${suffix}`;

      star.movies.push({
        id,
        title,
        shortTitle: title,
        year,
        poster: posterPaths[id] || textPoster(title, year),
        inVideoDraft: false,
        baseValue: 3,
      });
      existingFilms.add(key);
      usedIds.add(id);
    }
  }
}
