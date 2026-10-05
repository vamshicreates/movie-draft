import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PartyRoom } from "../src/partyRoom.js";
import { STARS_CATALOG } from "../src/data/moviesData.js";

assert.equal(STARS_CATALOG.filter((star) => star.category === "Hero").length, 22);
assert.equal(STARS_CATALOG.filter((star) => star.category === "Heroine").length, 21);
for (const star of STARS_CATALOG) {
  assert.ok(star.movies.length >= 3, `${star.name} needs lead films`);
  assert.equal(new Set(star.movies.map((movie) => movie.id)).size, star.movies.length,
    `${star.name} has duplicate movie IDs`);
  for (const movie of star.movies) {
    if (!movie.poster.startsWith("/")) continue;
    const path = fileURLToPath(new URL(`../public${movie.poster}`, import.meta.url));
    assert.ok(existsSync(path), `Missing poster for ${movie.title}`);
  }
}

function play({ starId, size, slots, budget }) {
  const star = STARS_CATALOG.find((entry) => entry.id === starId);
  const game = Object.create(PartyRoom.prototype);
  game.host = true;
  game.role = "P1";
  game.toast = (message) => { throw new Error(message); };
  game.publish = () => {};
  game.resultBlob = null;
  game.resultKey = "";
  game.room = {
    code: "TEST99", size, starId, startingBudget: budget, slotCount: slots,
    deckMode: "extended-shuffled", phase: "lobby",
    players: Array.from({ length: size }, (_, index) => ({
      role: `P${index + 1}`, name: `Player ${index + 1}`, connected: true,
      budget, slots: [],
    })),
    poolIds: [], index: 0, bid: 0, highBidder: null, passed: [], bidHistory: [], lastSale: "",
  };
  game.start();
  assert.equal(game.room.phase, "draft");
  assert.ok(game.room.players.every((player) => player.budget === budget));
  game.applyAction("P1", "BID", budget + 1);
  assert.equal(game.room.bid, 0, "overspending bid must be rejected");

  let rounds = 0;
  while (game.room.phase === "draft") {
    assert.ok(++rounds <= size * slots * 10, "Auction did not finish");
    const round = game.room.index;
    const movieId = game.room.poolIds[round];
    const eligible = game.room.players.filter((player) => player.slots.length < slots &&
      (star.movies.length < slots || !player.slots.some((slot) => slot.movieId === movieId)));
    assert.ok(eligible.length, "Round had no eligible players");
    const target = eligible.sort((a, b) => a.slots.length - b.slots.length)[0];
    game.applyAction(target.role, "BID", 1);
    for (const player of game.room.players) {
      if (game.room.phase !== "draft" || game.room.index !== round) break;
      if (player.role !== target.role) game.applyAction(player.role, "PASS");
    }
    assert.ok(game.room.index !== round || game.room.phase === "complete", "Auction did not advance");
  }
  assert.ok(game.room.players.every((player) => player.slots.length === slots));
  assert.ok(game.room.players.every((player) => player.budget === budget - slots));
  if (star.movies.length >= slots) {
    assert.ok(game.room.players.every((player) =>
      new Set(player.slots.map((slot) => slot.movieId)).size === slots));
  }
}

play({ starId: "allu-arjun", size: 5, slots: 5, budget: 20 });
play({ starId: "nani", size: 2, slots: 6, budget: 50 });
play({ starId: "chiranjeevi", size: 5, slots: 7, budget: 100 });
play({ starId: "vaishnavi-chaitanya", size: 3, slots: 7, budget: 100 });
console.log("43 star catalogs and configurable online auctions passed.");
