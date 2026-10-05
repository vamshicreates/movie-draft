// Released lead and co-lead acting credits checked against the filmography pages below.
// Cameos, child roles, voice-only work, supporting roles, recuts, short films,
// unreleased films, and producer-only credits are excluded.
// https://en.wikipedia.org/wiki/Nani_filmography
// https://en.wikipedia.org/wiki/Allu_Arjun_filmography
// https://en.wikipedia.org/wiki/Prabhas_filmography
// https://en.wikipedia.org/wiki/Mahesh_Babu_filmography

import { posterPaths } from "./filmoPosterPaths.js";

const credits = {
  nani: [
    ["Ride", 2009], ["Snehituda", 2009], ["Bheemili Kabaddi Jattu", 2010],
    ["Veppam", 2011], ["Yeto Vellipoyindhi Manasu", 2012],
    ["Paisa", 2014], ["Aaha Kalyanam", 2014],
    ["Janda Pai Kapiraju", 2015],
    ["Krishna Gaadi Veera Prema Gaadha", 2016], ["Majnu", 2016],
    ["Middle Class Abbayi", 2017], ["Krishnarjuna Yudham", 2018],
    ["Devadas", 2018], ["V", 2020],
    ["Tuck Jagadish", 2021],
    ["HIT: The Third Case", 2025],
  ],
  "allu-arjun": [
    ["Gangotri", 2003], ["Bunny", 2005], ["Happy", 2006],
    ["Arya 2", 2009],
    ["Varudu", 2010], ["Badrinath", 2011], ["Iddarammayilatho", 2013],
    ["DJ: Duvvada Jagannadham", 2017],
    ["Naa Peru Surya", 2018], ["Pushpa 2: The Rule", 2024],
  ],
  prabhas: [
    ["Eeswar", 2002], ["Raghavendra", 2003], ["Adavi Ramudu", 2004],
    ["Chakram", 2005], ["Pournami", 2006], ["Yogi", 2007],
    ["Munna", 2007], ["Bujjigadu", 2008], ["Ek Niranjan", 2009],
    ["Rebel", 2012], ["Saaho", 2019], ["Radhe Shyam", 2022],
    ["Adipurush", 2023], ["The RajaSaab", 2026],
  ],
  "mahesh-babu": [
    ["Rajakumarudu", 1999], ["Yuvaraju", 2000], ["Vamsi", 2000],
    ["Takkari Donga", 2002], ["Bobby", 2002], ["Nijam", 2003],
    ["Naani", 2004], ["Arjun", 2004], ["Sainikudu", 2006],
    ["Athidhi", 2007], ["Seethamma Vakitlo Sirimalle Chettu", 2013],
    ["Aagadu", 2014], ["Brahmotsavam", 2016], ["Spyder", 2017],
    ["Maharshi", 2019], ["Sarileru Neekevvaru", 2020],
    ["Sarkaru Vaari Paata", 2022], ["Guntur Kaaram", 2024],
  ],
};

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function textPoster(title, year) {
  const safe = title.replace(/[<>&"']/g, "");
  const lines = safe.match(/.{1,18}(?:\s|$)/g)?.slice(0, 4) || [safe];
  const labels = lines.map((line, index) => `<text x="200" y="${244 + index * 42}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="29" font-weight="bold">${line.trim()}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560"><rect width="400" height="560" fill="#101010"/><rect x="20" y="20" width="360" height="520" rx="16" fill="none" stroke="#e50914" stroke-width="3"/><text x="200" y="90" text-anchor="middle" fill="#e50914" font-family="Arial,sans-serif" font-size="18" font-weight="bold">MOVIE DRAFT</text>${labels}<text x="200" y="480" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="24">${year}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function addFilmographyCredits(stars) {
  for (const star of stars) {
    if (!credits[star.id]) continue;
    const existing = new Set(star.movies.map((movie) => slug(movie.title)));
    for (const [title, year] of credits[star.id]) {
      if (existing.has(slug(title))) continue;
      star.movies.push({
        id: `${star.id}-${slug(title)}`,
        title,
        shortTitle: title,
        year,
        poster: posterPaths[`${star.id}-${slug(title)}`] || textPoster(title, year),
        inVideoDraft: false,
        baseValue: 3,
      });
      existing.add(slug(title));
    }
  }
}
