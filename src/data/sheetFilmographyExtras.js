import { posterPaths } from "./filmoPosterPaths.js";
import { textPoster } from "./filmographyExtras.js";
import { SHEET_FILMOGRAPHY } from "./sheetFilmography.js";
import { wikiPosterPaths } from "./wikiPosterPaths.js";

const posterAliases = {
  "naan-ee|2012": "eega|2012", // Tamil release of the same film
};

function slug(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function filmKey(title, year) {
  return `${slug(title)}|${year}`;
}

export function addSheetFilmography(stars) {
  const artworkByFilm = new Map();
  for (const star of stars) {
    for (const movie of star.movies) {
      if (!movie.poster.startsWith("data:")) artworkByFilm.set(filmKey(movie.title, movie.year), movie.poster);
    }
  }

  function artworkFor(key) {
    const match = posterAliases[key] || key;
    return artworkByFilm.get(key) || artworkByFilm.get(match) || wikiPosterPaths[key] || wikiPosterPaths[match];
  }

  for (const star of stars) {
    const films = SHEET_FILMOGRAPHY[star.category]?.[star.name];
    if (!films) continue;

    for (const movie of star.movies) {
      const key = filmKey(movie.title, movie.year);
      if (movie.poster.startsWith("data:")) movie.poster = artworkFor(key) || movie.poster;
      if (!movie.poster.startsWith("data:")) artworkByFilm.set(key, movie.poster);
    }

    const existingFilms = new Set(star.movies.map((movie) => filmKey(movie.title, movie.year)));
    const usedIds = new Set(star.movies.map((movie) => movie.id));

    for (const [title, year] of films) {
      const key = filmKey(title, year);
      if (existingFilms.has(key)) continue;

      const baseId = `${star.id}-${slug(title)}`;
      let id = usedIds.has(baseId) ? `${baseId}-${year}` : baseId;
      for (let suffix = 2; usedIds.has(id); suffix += 1) id = `${baseId}-${year}-${suffix}`;

      const poster = posterPaths[id] || artworkFor(key) || textPoster(title, year);
      star.movies.push({
        id,
        title,
        shortTitle: title,
        year,
        poster,
        inVideoDraft: false,
        baseValue: 3,
      });
      existingFilms.add(key);
      usedIds.add(id);
      if (!poster.startsWith("data:")) artworkByFilm.set(key, poster);
    }

    if (star.avatarPoster?.startsWith("data:")) {
      star.avatarPoster = star.movies.find((movie) => !movie.poster.startsWith("data:"))?.poster || star.avatarPoster;
    }
  }
}
