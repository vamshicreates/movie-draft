import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PartyRoom } from "../src/partyRoom.js";
import { GAME_CONFIG, STARS_CATALOG } from "../src/data/moviesData.js";

for (const star of STARS_CATALOG.filter((entry) => entry.category === "Hero")) {
  assert.ok(star.movies.length >= 25, `${star.name} needs 25 distinct films`);
  assert.equal(new Set(star.movies.map((movie) => movie.id)).size, star.movies.length,
    `${star.name} has duplicate IDs`);
  for (const movie of star.movies) {
    if (!movie.poster.startsWith("/posters/filmography/")) continue;
    const path = fileURLToPath(new URL(`../public${movie.poster}`, import.meta.url));
    assert.ok(existsSync(path), `Missing poster for ${movie.title}`);
  }
}

const game = Object.create(PartyRoom.prototype);
game.host = true;
game.role = "P1";
game.toast = (message) => { throw new Error(message); };
game.publish = () => {};
game.resultBlob = null;
game.resultKey = "";
game.room = {
  code: "TEST99", size: 5, starId: "allu-arjun", deckMode: "extended-shuffled",
  phase: "lobby", players: Array.from({ length: 5 }, (_, index) => ({
    role: `P${index + 1}`, name: `Player ${index + 1}`, connected: true,
    budget: GAME_CONFIG.defaultBudget, slots: [],
  })),
  poolIds: [], index: 0, bid: 0, highBidder: null, passed: [], bidHistory: [], lastSale: "",
};

game.start();
assert.equal(game.room.poolIds.length, 27);
assert.equal(game.room.phase, "draft");
game.applyAction("P1", "BID", 21);
assert.equal(game.room.bid, 0, "overspending bid must be rejected");

while (game.room.phase === "draft") {
  const round = game.room.index;
  const target = game.room.players[round % 5];
  if (target.slots.length >= 5) throw new Error("Draft targeted a full roster");
  game.applyAction(target.role, "BID", 1);
  for (const player of game.room.players) {
    if (game.room.phase !== "draft" || game.room.index !== round) break;
    if (player.role !== target.role) game.applyAction(player.role, "PASS");
  }
  assert.ok(game.room.index !== round || game.room.phase === "complete", "Auction did not advance");
  assert.ok(round < 30, "Draft should complete in at most 25 awarded rounds");
}

assert.equal(game.room.phase, "complete");
assert.ok(game.room.players.every((player) => player.slots.length === 5));
assert.equal(new Set(game.room.players.flatMap((player) => player.slots.map((slot) => slot.movieId))).size, 25);
assert.ok(game.room.players.every((player) => player.budget === 15));
console.log("Five-player auction and film catalogs passed.");
