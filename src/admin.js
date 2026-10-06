import { upload } from "@vercel/blob/client";

const $ = (id) => document.getElementById(id);
const state = { password: "", revision: null, ads: [], editingId: null, previewUrl: null };
const typeExtensions = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "video/mp4": "mp4",
};
const placementNames = { home: "Home ribbon", live: "During draft", waiting: "Waiting room", results: "Results / side rail" };

function status(message, good = false) {
  $("admin-status").textContent = message;
  $("admin-status").classList.toggle("good", good);
}

function authorization() {
  const bytes = new TextEncoder().encode(`admin:${state.password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { authorization: authorization(), ...(options.headers || {}) },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

function localDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function releasePreviewUrl() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
}

function preview(src, type, title, copy, cta) {
  const box = $("media-preview");
  box.replaceChildren();
  if (!src) { box.textContent = "Your ad preview appears here after you choose media."; return; }
  const card = document.createElement("article");
  card.className = "sponsor-card";
  const media = document.createElement("span");
  media.className = "sponsor-media";
  const element = document.createElement(type === "video/mp4" ? "video" : "img");
  element.src = src;
  if (type === "video/mp4") {
    element.controls = true;
    element.muted = true;
    element.playsInline = true;
  } else element.alt = "";
  media.append(element);
  const words = document.createElement("span");
  words.className = "sponsor-copy";
  const label = document.createElement("span");
  label.className = "sponsor-label";
  label.textContent = "Sponsored";
  const heading = document.createElement("strong");
  heading.textContent = title || "Campaign title";
  const description = document.createElement("span");
  description.textContent = copy || "Short description";
  words.append(label, heading, description);
  const action = document.createElement("span");
  action.className = "sponsor-cta";
  action.textContent = cta || "Explore";
  card.append(media, words, action);
  box.append(card);
}

function currentAd() { return state.ads.find((ad) => ad.id === state.editingId); }

function updatePreview() {
  const file = $("ad-file").files[0];
  const old = currentAd();
  releasePreviewUrl();
  if (file) state.previewUrl = URL.createObjectURL(file);
  preview(state.previewUrl || old?.mediaUrl, file?.type || old?.mediaType,
    $("ad-title").value, $("ad-copy").value, $("ad-cta").value);
}

function editAd(ad = null) {
  state.editingId = ad?.id || null;
  $("editor-title").textContent = ad ? "Edit ad" : "New ad";
  $("ad-placement").value = ad?.placement || "home";
  $("ad-title").value = ad?.title || "";
  $("ad-copy").value = ad?.copy || "";
  $("ad-cta").value = ad?.cta || "Explore";
  $("ad-href").value = ad?.href || "";
  $("ad-start").value = localDate(ad?.startsAt);
  $("ad-end").value = localDate(ad?.endsAt);
  $("ad-enabled").checked = Boolean(ad?.enabled);
  $("ad-file").value = "";
  updatePreview();
  if (ad) $("ad-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderList() {
  const list = $("ad-list");
  list.replaceChildren();
  if (!state.ads.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "No ads yet. Create one below when you have campaign media and a destination link.";
    list.append(empty);
    return;
  }
  for (const ad of state.ads) {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    const info = document.createElement("div");
    info.className = "admin-list-info";
    const title = document.createElement("strong");
    title.textContent = ad.title;
    const detail = document.createElement("small");
    detail.textContent = `${placementNames[ad.placement]} · ${ad.enabled ? "Published" : "Paused"}${ad.startsAt ? " · Scheduled" : ""}`;
    info.append(title, detail);
    const action = (label, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", onClick);
      return button;
    };
    row.append(info, action("Edit", () => editAd(ad)),
      action(ad.enabled ? "Pause" : "Publish", () => changeAds(state.ads.map((item) => item.id === ad.id ? { ...item, enabled: !item.enabled } : item))),
      action("Delete", () => {
        if (confirm(`Delete “${ad.title}” from ad placements?`)) changeAds(state.ads.filter((item) => item.id !== ad.id));
      }));
    list.append(row);
  }
}

async function changeAds(ads) {
  status("Saving ad changes…");
  try {
    const result = await api("/api/admin-ads", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: state.revision, ads }),
    });
    state.revision = result.revision;
    state.ads = result.ads;
    renderList();
    editAd();
    status("Saved. Published ads will appear on new game visits shortly.", true);
  } catch (error) { status(error.message); }
}

function videoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => { const duration = video.duration; URL.revokeObjectURL(url); resolve(duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read MP4 video")); };
    video.src = url;
  });
}

async function mediaForSave() {
  const file = $("ad-file").files[0];
  if (!file) {
    const old = currentAd();
    if (!old) throw new Error("Choose an image, GIF or MP4 video");
    return { mediaUrl: old.mediaUrl, mediaType: old.mediaType };
  }
  if (!typeExtensions[file.type]) throw new Error("Use JPG, PNG, WebP, GIF or MP4");
  if (file.size > 15 * 1024 * 1024) throw new Error("Media must be 15 MB or less");
  if (file.type === "video/mp4") {
    const seconds = await videoDuration(file);
    if (!(seconds > 0 && seconds <= 10.05)) throw new Error("Video must be 10 seconds or less");
  }
  status("Uploading media…");
  const { uploadUrl } = await api("/api/ad-upload");
  const blob = await upload(`ads/media/${crypto.randomUUID()}.${typeExtensions[file.type]}`, file, {
    access: "public", handleUploadUrl: uploadUrl, contentType: file.type,
    multipart: file.size > 4 * 1024 * 1024,
  });
  return { mediaUrl: blob.url, mediaType: file.type };
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.password = $("admin-password").value;
  status("Opening ad manager…");
  try {
    const result = await api("/api/admin-ads");
    state.revision = result.revision;
    state.ads = result.ads;
    $("admin-password").value = "";
    $("login-panel").classList.add("hidden");
    $("admin-dashboard").classList.remove("hidden");
    renderList();
    editAd();
    status("Ad manager ready.", true);
  } catch (error) { status(error.message); }
});

$("ad-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("save-ad");
  button.disabled = true;
  try {
    const media = await mediaForSave();
    const ad = {
      id: state.editingId || crypto.randomUUID(),
      placement: $("ad-placement").value,
      title: $("ad-title").value.trim(),
      copy: $("ad-copy").value.trim(),
      cta: $("ad-cta").value.trim(),
      href: $("ad-href").value.trim(),
      ...media,
      startsAt: $("ad-start").value ? new Date($("ad-start").value).toISOString() : "",
      endsAt: $("ad-end").value ? new Date($("ad-end").value).toISOString() : "",
      enabled: $("ad-enabled").checked,
    };
    const ads = state.editingId ? state.ads.map((item) => item.id === state.editingId ? ad : item) : [...state.ads, ad];
    await changeAds(ads);
  } catch (error) { status(error.message); }
  finally { button.disabled = false; }
});

$("new-ad").addEventListener("click", () => editAd());
$("cancel-ad").addEventListener("click", () => editAd());
for (const id of ["ad-file", "ad-title", "ad-copy", "ad-cta"]) $(id).addEventListener("input", updatePreview);
editAd();
