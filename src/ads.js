const placements = new Map();
const cards = new Map();

function safeUrl(value) {
  try {
    const url = new URL(value, location.origin);
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

function createCard(ad) {
  const card = document.createElement("article");
  card.className = "sponsor-card";
  if (ad.mediaType === "video/mp4") card.classList.add("sponsor-card-video");
  card.dataset.adId = ad.id;
  card.dataset.placement = ad.placement;

  const media = document.createElement("span");
  media.className = "sponsor-media";
  if (ad.mediaType === "video/mp4") {
    const video = document.createElement("video");
    video.src = safeUrl(ad.mediaUrl);
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", `${ad.title} advertisement video`);
    media.append(video);
  } else {
    const image = document.createElement("img");
    image.src = safeUrl(ad.mediaUrl);
    image.alt = "";
    image.loading = "lazy";
    media.append(image);
  }
  const words = document.createElement("span");
  words.className = "sponsor-copy";
  const label = document.createElement("span");
  label.className = "sponsor-label";
  label.textContent = "Sponsored";
  const title = document.createElement("strong");
  title.textContent = ad.title;
  const description = document.createElement("span");
  description.textContent = ad.copy;
  words.append(label, title, description);
  const cta = document.createElement("a");
  cta.className = "sponsor-cta";
  cta.textContent = ad.cta;
  cta.href = safeUrl(ad.href);
  cta.target = "_blank";
  cta.rel = "noopener noreferrer sponsored";
  cta.setAttribute("aria-label", `${ad.cta}: ${ad.title} (sponsored)`);
  card.append(media, words, cta);
  return card;
}

export function detachAds(root) {
  root?.querySelectorAll(".sponsor-card").forEach((card) => card.remove());
}

export function hydrateAds(root = document) {
  root.querySelectorAll("[data-ad-slot]").forEach((slot) => {
    const placement = slot.dataset.adSlot;
    const ad = placements.get(placement);
    if (!ad) {
      slot.replaceChildren();
      slot.hidden = true;
      return;
    }
    let card = cards.get(placement);
    if (!card || card.dataset.adId !== ad.id) {
      card = createCard(ad);
      cards.set(placement, card);
    }
    if (slot.firstElementChild !== card) slot.replaceChildren(card);
    slot.hidden = false;
  });
}

export async function loadAds() {
  try {
    const response = await fetch("/api/ads");
    if (!response.ok) return;
    const data = await response.json();
    placements.clear();
    const groups = new Map();
    for (const ad of data.ads || []) {
      if (!safeUrl(ad.href) || !safeUrl(ad.mediaUrl)) continue;
      if (!groups.has(ad.placement)) groups.set(ad.placement, []);
      groups.get(ad.placement).push(ad);
    }
    for (const [placement, group] of groups) placements.set(placement, group[Math.floor(Math.random() * group.length)]);
    hydrateAds();
  } catch {
    // Ad delivery is optional. The draft still works if the service is offline.
  }
}

loadAds();
