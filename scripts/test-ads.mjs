import assert from "node:assert/strict";
import { clickUrl, countClickPaths, verifiedClick } from "../api/_ads.js";

process.env.AD_ADMIN_PASSWORD = "test-only-strong-ad-password";
const now = Date.UTC(2026, 9, 7);
const ad = { id: "11111111-1111-4111-8111-111111111111", href: "https://example.com/film" };
const signed = new URL(clickUrl(ad, "image", now), "https://movie-draft.example");

assert.deepEqual(verifiedClick(signed.href, now + 1000), { id: ad.id, part: "image", href: ad.href });
signed.searchParams.set("to", "https://example.com/other");
assert.equal(verifiedClick(signed.href, now + 1000), null, "destination changes must invalidate the signature");
signed.searchParams.set("to", ad.href);
signed.searchParams.set("part", "link");
assert.equal(verifiedClick(signed.href, now + 1000), null, "click area changes must invalidate the signature");
assert.equal(verifiedClick(new URL(clickUrl(ad, "text", now), "https://movie-draft.example").href,
  now + 8 * 24 * 60 * 60 * 1000), null, "links must expire");

assert.deepEqual(countClickPaths([
  `ads/clicks/${ad.id}/image/${now}-11111111-1111-4111-8111-111111111111.txt`,
  `ads/clicks/${ad.id}/link/${now}-22222222-2222-4222-8222-222222222222.txt`,
  `ads/clicks/${ad.id}/text/${now}-33333333-3333-4333-8333-333333333333.txt`,
  `ads/clicks/${ad.id}/text/${now}-44444444-4444-4444-8444-444444444444.txt`,
  "ads/clicks/not-an-ad/other/invalid.txt",
]), { [ad.id]: { total: 4, image: 1, link: 1, text: 2 } });

console.log("Signed ad links and click counts passed.");
