import { GAME_CONFIG, STARS_CATALOG } from "./data/moviesData.js";
import { createPartyResultCard } from "./shareCard.js";

const HEROES = STARS_CATALOG.filter((star) => star.category === "Hero");
const REACTIONS = ["🔥", "💰", "🍿", "👏", "🏆", "🗣️ Teesko!"];
const slotsPerPlayer = GAME_CONFIG.slotsPerPlayer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function movieFor(room, id) {
  return HEROES.find((star) => star.id === room?.starId)?.movies.find((movie) => movie.id === id);
}

function roomLink(code) {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
}

function decodeMessage(message) {
  try { return typeof message === "string" ? JSON.parse(message) : message; }
  catch { return null; }
}

export class PartyRoom {
  constructor({ toast, onEnter, onLeave, onChange }) {
    this.toast = toast;
    this.onEnter = onEnter;
    this.onLeave = onLeave;
    this.onChange = onChange;
    this.peer = null;
    this.conn = null;
    this.connections = new Map();
    this.room = null;
    this.role = null;
    this.host = false;
    this.closing = false;
    this.resultBlob = null;
    this.resultKey = "";
    this.arena = document.getElementById("party-arena");
    this.arena?.addEventListener("click", (event) => this.handleClick(event));
    document.getElementById("btn-party-start")?.addEventListener("click", () => this.start());
  }

  get active() { return Boolean(this.room); }
  get code() { return this.room?.code || null; }
  get player() { return this.room?.players.find((player) => player.role === this.role); }

  create({ code, name, starId, size, deckMode }) {
    if (typeof Peer === "undefined") return this.toast("Online service is still loading. Try again shortly.");
    this.leave(false);
    const count = Number(size);
    if (!Number.isInteger(count) || count < 2 || count > 5) return this.toast("Choose 2 to 5 players.");
    this.host = true;
    this.closing = false;
    this.role = "P1";
    this.peer = new Peer(`MD-${code}`);
    this.peer.on("open", () => {
      this.room = {
        code, size: count, starId, deckMode: count > 2 ? "extended-shuffled" : deckMode,
        phase: "lobby", players: [{ role: "P1", name: name.slice(0, 30), connected: true,
          budget: GAME_CONFIG.defaultBudget, slots: [] }],
        poolIds: [], index: 0, bid: 0, highBidder: null, passed: [], bidHistory: [], lastSale: "",
      };
      this.enter();
      this.toast(`Room ${code} is ready. Invite ${count - 1} more ${count === 2 ? "player" : "players"}.`);
    });
    this.peer.on("connection", (conn) => this.acceptConnection(conn));
    this.peer.on("error", (error) => {
      if (error.type === "unavailable-id" && !this.room) {
        this.leave(false);
        this.toast("That room code is taken. Create another room.");
      } else this.toast(`Room connection error: ${error.message || error.type}`);
    });
  }

  join({ code, name }) {
    if (typeof Peer === "undefined") return this.toast("Online service is still loading. Try again shortly.");
    this.leave(false);
    this.host = false;
    this.closing = false;
    const peer = new Peer();
    this.peer = peer;
    peer.on("open", () => {
      const conn = peer.connect(`MD-${code}`, { reliable: true });
      this.conn = conn;
      const timer = setTimeout(() => {
        if (!this.room) {
          this.toast("Room not found. Check the code and ask the host to keep the room open.");
          this.leave(false);
        }
      }, 12000);
      conn.on("open", () => {
        const roleHint = sessionStorage.getItem(`movie-draft-role-${code}`);
        conn.send({ type: "JOIN_REQUEST", name: name.slice(0, 30), roleHint });
      });
      conn.on("data", (message) => {
        const data = decodeMessage(message);
        if (!data || typeof data !== "object") return;
        if (data.type === "JOIN_ACCEPTED") {
          clearTimeout(timer);
          this.role = data.role;
          sessionStorage.setItem(`movie-draft-role-${code}`, this.role);
          sessionStorage.setItem(`movie-draft-name-${code}`, name);
          this.room = data.room;
          this.enter();
          this.toast(`Joined room ${code} as ${this.role}.`);
        } else if (data.type === "ROOM_SNAPSHOT") {
          this.room = data.room;
          this.render();
        } else if (data.type === "REACTION") this.floatReaction(data.emoji);
        else if (data.type === "REJECTED") {
          clearTimeout(timer);
          this.toast(data.reason || "Could not join this room.");
          this.leave(false);
        }
      });
      conn.on("close", () => {
        clearTimeout(timer);
        if (!this.closing && this.room) {
          this.toast("Host disconnected. The room has closed.");
          this.leave();
        }
      });
      conn.on("error", () => this.toast("Could not connect to the host. Try the invite link again."));
    });
    peer.on("error", (error) => this.toast(`Connection error: ${error.message || error.type}`));
  }

  acceptConnection(conn) {
    conn.on("data", (message) => {
      const data = decodeMessage(message);
      if (!data || typeof data !== "object") return;
      if (data.type === "JOIN_REQUEST") {
        const name = String(data.name || "Player").slice(0, 30);
        let player = this.room?.players.find((entry) =>
          !entry.connected && entry.role === data.roleHint && entry.name === name);
        if (!player && this.room?.phase === "lobby" && this.room.players.length < this.room.size) {
          player = { role: `P${this.room.players.length + 1}`, name, connected: true,
            budget: GAME_CONFIG.defaultBudget, slots: [] };
          this.room.players.push(player);
        }
        if (!player && this.room?.phase === "lobby") {
          player = this.room.players.find((entry) => !entry.connected);
          if (player) { player.name = name; player.slots = []; player.budget = GAME_CONFIG.defaultBudget; }
        }
        if (!player) {
          conn.send({ type: "REJECTED", reason: this.room?.phase === "lobby"
            ? "This room is full." : "This draft has already started." });
          setTimeout(() => conn.close(), 100);
          return;
        }
        player.connected = true;
        this.connections.set(conn.peer, { conn, role: player.role });
        if (this.room.phase === "paused") this.room.phase = "draft";
        conn.send({ type: "JOIN_ACCEPTED", role: player.role, room: this.room });
        this.publish();
        this.toast(`${name} joined as ${player.role}.`);
      } else {
        const record = this.connections.get(conn.peer);
        if (!record) return;
        if (data.type === "ACTION") this.applyAction(record.role, data.action, data.amount);
        if (data.type === "REACTION" && REACTIONS.includes(data.emoji)) this.broadcastReaction(data.emoji);
      }
    });
    conn.on("close", () => {
      const record = this.connections.get(conn.peer);
      if (!record || !this.room) return;
      this.connections.delete(conn.peer);
      const player = this.room.players.find((entry) => entry.role === record.role);
      if (player) player.connected = false;
      if (this.room.phase === "draft") this.room.phase = "paused";
      this.publish();
      this.toast(`${player?.name || record.role} disconnected. Waiting for them to rejoin.`);
    });
  }

  enter() {
    history.replaceState({}, "", roomLink(this.room.code));
    document.body.classList.add("party-active");
    document.querySelector(".nf-arena")?.classList.add("hidden");
    this.arena?.classList.remove("hidden");
    this.onEnter(this.room, this.role);
    this.render();
  }

  leave(notify = true) {
    const wasActive = this.active;
    this.closing = true;
    try { this.conn?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.conn = null;
    this.peer = null;
    this.connections.clear();
    this.room = null;
    this.role = null;
    this.host = false;
    this.resultBlob = null;
    this.resultKey = "";
    document.body.classList.remove("party-active");
    document.querySelector(".nf-arena")?.classList.remove("hidden");
    this.arena?.classList.add("hidden");
    if (wasActive) {
      history.replaceState({}, "", `${location.origin}${location.pathname}`);
      this.onLeave();
      if (notify) this.toast("Left the online room.");
    }
  }

  publish() {
    if (!this.room) return;
    this.render();
    for (const { conn } of this.connections.values()) {
      if (conn.open) conn.send({ type: "ROOM_SNAPSHOT", room: this.room });
    }
  }

  start() {
    if (!this.host || !this.room) return;
    if (this.room.players.length !== this.room.size || this.room.players.some((player) => !player.connected)) {
      return this.toast(`Wait for all ${this.room.size} players to join.`);
    }
    const star = HEROES.find((entry) => entry.id === this.room.starId);
    const all = star.movies;
    if (all.length < this.room.size * slotsPerPlayer) return this.toast("This hero needs more films for this room size.");
    const originals = all.filter((movie) => movie.inVideoDraft).sort((a, b) => a.videoOrder - b.videoOrder);
    const useAll = this.room.size > 2 || this.room.deckMode === "extended-shuffled";
    const pool = useAll ? shuffle(all) : this.room.deckMode === "video-shuffled" ? shuffle(originals) : originals;
    this.room.poolIds = pool.map((movie) => movie.id);
    this.room.phase = "draft";
    this.room.index = 0;
    this.room.bid = 0;
    this.room.highBidder = null;
    this.room.passed = [];
    this.room.bidHistory = [];
    this.room.lastSale = "";
    this.resultBlob = null;
    this.resultKey = "";
    for (const player of this.room.players) { player.budget = GAME_CONFIG.defaultBudget; player.slots = []; }
    this.publish();
  }

  action(action, amount) {
    if (!this.room) return;
    if (this.host) this.applyAction(this.role, action, amount);
    else if (this.conn?.open) this.conn.send({ type: "ACTION", action, amount });
  }

  applyAction(role, action, amount) {
    const room = this.room;
    if (!this.host || !room || room.phase !== "draft") return;
    const player = room.players.find((entry) => entry.role === role);
    if (!player?.connected) return;
    if (action === "SKIP" && role === "P1") {
      room.lastSale = "Film skipped by host";
      this.nextMovie();
      this.publish();
      return;
    }
    if (player.slots.length >= slotsPerPlayer) return;
    if (action === "BID") {
      const next = room.bid + 1;
      const target = Number(amount) || next;
      if (room.passed.includes(role) || room.highBidder === role || target < next || target > player.budget) return;
      room.bid = target;
      room.highBidder = role;
      room.bidHistory.push({ role, amount: target });
      this.resolveIfReady();
      this.publish();
    } else if (action === "PASS") {
      if (room.passed.includes(role) || room.highBidder === role) return;
      room.passed.push(role);
      this.resolveIfReady();
      this.publish();
    } else if (action === "CLAIM") {
      if (room.highBidder || room.passed.includes(role)) return;
      if (room.players.some((other) => other.role !== role && other.connected && other.slots.length < slotsPerPlayer && other.budget > 0 && !room.passed.includes(other.role))) return;
      this.award(role, 0);
      this.publish();
    }
  }

  resolveIfReady() {
    const room = this.room;
    if (!room || room.phase !== "draft") return;
    const othersCanBid = room.players.some((player) => player.connected &&
      player.role !== room.highBidder && !room.passed.includes(player.role) &&
      player.slots.length < slotsPerPlayer && player.budget >= room.bid + 1);
    if (room.highBidder && !othersCanBid) {
      this.award(room.highBidder, room.bid);
    } else if (!room.highBidder && room.players.every((player) =>
      player.slots.length >= slotsPerPlayer || room.passed.includes(player.role) || player.budget === 0)) {
      room.lastSale = "No bids · next film";
      this.nextMovie();
    }
  }

  award(role, price) {
    const room = this.room;
    const player = room.players.find((entry) => entry.role === role);
    const movieId = room.poolIds[room.index];
    if (!player || !movieId || player.slots.length >= slotsPerPlayer) return;
    player.budget -= price;
    player.slots.push({ movieId, price });
    room.lastSale = `${player.name} won ${movieFor(room, movieId)?.title || "the film"} for ${price ? `₹${price}` : "free"}`;
    this.nextMovie();
  }

  nextMovie() {
    const room = this.room;
    if (room.players.every((player) => player.slots.length >= slotsPerPlayer)) {
      room.phase = "complete";
      return;
    }
    room.index += 1;
    room.bid = 0;
    room.highBidder = null;
    room.passed = [];
    room.bidHistory = [];
    if (room.index >= room.poolIds.length) {
      const drafted = new Set(room.players.flatMap((player) => player.slots.map((slot) => slot.movieId)));
      const unsold = room.poolIds.filter((id) => !drafted.has(id));
      if (unsold.length) room.poolIds.push(...shuffle(unsold));
      else room.phase = "complete";
    }
  }

  broadcastReaction(emoji) {
    this.floatReaction(emoji);
    for (const { conn } of this.connections.values()) {
      if (conn.open) conn.send({ type: "REACTION", emoji });
    }
  }

  floatReaction(emoji) {
    const container = document.getElementById("reactions-container");
    if (!container) return;
    const item = document.createElement("span");
    item.className = "floating-reaction";
    item.textContent = emoji;
    item.style.left = `${20 + Math.random() * 60}%`;
    container.appendChild(item);
    setTimeout(() => item.remove(), 2500);
  }

  async copyLink() {
    if (!this.room) return;
    try {
      await navigator.clipboard.writeText(roomLink(this.room.code));
      this.toast("Invite link copied. Send it to your players.");
    } catch { this.toast(`Room code: ${this.room.code}`); }
  }

  renderModal() {
    if (!this.room) return;
    document.getElementById("modal-active-room-code").textContent = this.room.code;
    const roster = document.querySelector(".active-room-roster");
    roster.innerHTML = Array.from({ length: this.room.size }, (_, index) => {
      const player = this.room.players[index];
      return `<div class="roster-item"><span class="roster-role">${index === 0 ? "Host" : "Guest"} (P${index + 1}):</span><span class="roster-name">${player ? `${escapeHtml(player.name)}${this.role === player.role ? " (You)" : ""}${player.connected ? "" : " · disconnected"}` : "Waiting to join…"}</span></div>`;
    }).join("");
    const start = document.getElementById("btn-party-start");
    start.classList.toggle("hidden", !this.host);
    start.disabled = this.room.phase !== "lobby" || this.room.players.length !== this.room.size || this.room.players.some((p) => !p.connected);
    start.textContent = this.room.phase === "complete" ? "Play Again" : this.room.phase === "lobby" ? `Start ${this.room.size}-Player Draft` : "Draft in progress";
    if (this.room.phase === "complete") start.disabled = false;
  }

  render() {
    const room = this.room;
    if (!room || !this.arena) return;
    const star = HEROES.find((entry) => entry.id === room.starId);
    const joined = room.players.filter((player) => player.connected).length;
    const playerCards = Array.from({ length: room.size }, (_, index) => {
      const player = room.players[index];
      const mine = player?.role === this.role;
      const slots = player?.slots || [];
      return `<article class="party-player ${mine ? "mine" : ""} ${!player?.connected ? "pending" : ""}">
        <div class="party-player-head"><span class="party-role">P${index + 1}${mine ? " · YOU" : ""}</span><strong>${escapeHtml(player?.name || "Waiting…")}</strong><span class="party-budget">₹${player?.budget ?? 20}</span></div>
        <div class="party-player-progress"><span style="width:${slots.length * 20}%"></span></div>
        <div class="party-picks">${Array.from({ length: slotsPerPlayer }, (_, slotIndex) => {
          const slot = slots[slotIndex];
          const movie = slot && movieFor(room, slot.movieId);
          return movie ? `<span class="party-pick" title="Won for ₹${slot.price}"><img src="${movie.poster}" alt="" /><span>${escapeHtml(movie.shortTitle || movie.title)}</span></span>` : `<span class="party-pick party-empty">${slotIndex + 1}</span>`;
        }).join("")}</div>
        <span class="party-slot-count">${slots.length}/${slotsPerPlayer} films</span>
      </article>`;
    }).join("");

    let center = "";
    if (room.phase === "lobby" || room.phase === "paused") {
      center = `<section class="party-wait"><span class="party-big-icon">${room.phase === "paused" ? "⏸" : "🎬"}</span>
        <h2>${room.phase === "paused" ? "Waiting for a player to reconnect" : `Your ${room.size}-player room is ready`}</h2>
        <p>${joined}/${room.size} players connected · ${escapeHtml(star.name)} movies · 5 picks each</p>
        <strong class="party-code">${escapeHtml(room.code)}</strong>
        <button class="nf-btn-red" data-party="copy">Copy invite link</button>
        ${this.host && room.phase === "lobby" ? `<button class="nf-btn-red" data-party="start" ${joined === room.size ? "" : "disabled"}>Start Draft</button>` : ""}
        <small>${this.host ? "You can start when everyone joins." : "The room creator will start the draft."}</small></section>`;
    } else if (room.phase === "draft") {
      const movie = movieFor(room, room.poolIds[room.index]);
      const me = this.player;
      const canBid = me && me.connected && me.slots.length < slotsPerPlayer &&
        !room.passed.includes(this.role) && room.highBidder !== this.role && me.budget >= room.bid + 1;
      const canPass = me && me.slots.length < slotsPerPlayer &&
        !room.passed.includes(this.role) && room.highBidder !== this.role;
      const freeClaim = me && me.slots.length < slotsPerPlayer && !room.highBidder &&
        room.players.every((player) => player.role === this.role || player.slots.length >= slotsPerPlayer || player.budget === 0 || room.passed.includes(player.role));
      center = `<section class="party-stage"><div class="party-round"><strong>${escapeHtml(star.name)}'s Movies Draft</strong><span>FILM ${room.index + 1} / ${room.poolIds.length}</span></div>
        <div class="party-showcase"><div class="party-poster"><img src="${movie?.poster || ""}" alt="${escapeHtml(movie?.title || "Film")} poster" /><h2>${escapeHtml(movie?.title || "Film")}</h2></div>
          <div class="party-bidding"><span class="party-live-label">🔴 LIVE BIDDING</span>
            <div class="party-high">${room.highBidder ? `<strong>₹${room.bid}</strong><span>${escapeHtml(room.players.find((player) => player.role === room.highBidder)?.name)} leads</span>` : `<strong>₹1</strong><span>Opening bid</span>`}</div>
            <div class="party-bid-trail">${room.bidHistory.length ? room.bidHistory.map((bid) => `<span>${bid.role} ₹${bid.amount}</span>`).join("") : "Be first to bid"}</div>
            <div class="party-controls"><button class="nf-btn-red" data-party="bid" ${canBid ? "" : "disabled"}>Bid ₹${room.bid + 1}</button><button class="nf-btn-plus" data-party="bid2" ${canBid && me.budget >= room.bid + 2 ? "" : "disabled"}>+₹2</button><button class="nf-btn-teesko" data-party="pass" ${canPass ? "" : "disabled"}>Teesko! Pass</button>${freeClaim ? `<button class="nf-btn-red" data-party="claim">Claim free</button>` : ""}</div>
            <p class="party-bid-help">${room.passed.includes(this.role) ? "You passed on this film." : room.highBidder === this.role ? "Your bid leads. Wait for the others." : `${escapeHtml(me?.name || "Your player")}, you have ₹${me?.budget ?? 0} left.`}</p>
            ${this.host ? `<button class="skip-link" data-party="skip">Skip film</button>` : ""}
          </div></div></section>`;
    } else {
      const labels = room.players.map((player) => player.role).join(" / ");
      center = `<section class="party-results"><span class="complete-badge">DRAFT COMPLETE</span><h2>Who drafted better?</h2><p>Share the lineups on Instagram. Ask friends to comment ${labels}.</p>
        <div class="party-results-grid">${room.players.map((player) => `<div class="party-result"><span>${player.role}</span><strong>${escapeHtml(player.name)}</strong><small>₹${player.budget} left</small><ol>${player.slots.map((slot) => `<li>${escapeHtml(movieFor(room, slot.movieId)?.title || "Film")} <em>₹${slot.price}</em></li>`).join("")}</ol></div>`).join("")}</div>
        <div class="party-result-actions"><button class="nf-btn-red" data-party="share" ${this.resultBlob ? "" : "disabled"}>Share result</button><button class="nf-btn-ghost" data-party="download" ${this.resultBlob ? "" : "disabled"}>Download image</button><button class="nf-btn-ghost" data-party="caption">Copy caption</button>${this.host ? `<button class="nf-btn-red" data-party="again">Play Again</button>` : ""}</div>
        <small>${this.resultBlob ? "Image ready to share." : "Preparing the result image…"}</small></section>`;
    }
    this.arena.innerHTML = `<div class="party-room-strip"><div><span class="room-live-pill">🔴 LIVE ROOM</span><strong>${escapeHtml(room.code)}</strong><span>${joined}/${room.size} players</span></div><div><button class="nf-btn-ghost-sm" data-party="copy">Copy link</button><button class="nf-btn-ghost-sm" data-party="leave">Leave</button></div></div>
      <div class="party-layout"><div class="party-main">${center}<div class="party-reactions"><span>Quick Reactions:</span>${REACTIONS.map((emoji) => `<button class="btn-react" data-party="react" data-emoji="${escapeHtml(emoji)}">${emoji === "🗣️ Teesko!" ? "Teesko!" : emoji}</button>`).join("")}</div><p class="party-last-sale">${escapeHtml(room.lastSale || "")}</p></div><aside class="party-sidebar"><h3>Lineups</h3><div class="party-scoreboard">${playerCards}</div></aside></div>`;
    document.getElementById("mp-btn-label").textContent = `Room: ${room.code} · ${this.role}`;
    document.getElementById("mp-status-dot")?.classList.toggle("connected", joined === room.size);
    this.renderModal();
    this.onChange(room, this.role);
    if (room.phase === "complete") this.prepareResult();
  }

  handleClick(event) {
    const button = event.target.closest("[data-party]");
    if (!button) return;
    const action = button.dataset.party;
    if (action === "copy") this.copyLink();
    else if (action === "leave") this.leave();
    else if (action === "start" || action === "again") this.start();
    else if (action === "bid") this.action("BID", this.room.bid + 1);
    else if (action === "bid2") this.action("BID", this.room.bid + 2);
    else if (action === "pass") this.action("PASS");
    else if (action === "claim") this.action("CLAIM");
    else if (action === "skip") this.action("SKIP");
    else if (action === "react") {
      const emoji = button.dataset.emoji;
      if (this.host) this.broadcastReaction(emoji);
      else this.conn?.send({ type: "REACTION", emoji });
    } else if (action === "share") this.shareResult();
    else if (action === "download") this.downloadResult();
    else if (action === "caption") this.copyCaption();
  }

  resultPlayers() {
    return this.room.players.map((player) => ({ ...player,
      slots: player.slots.map((slot) => ({ price: slot.price, movie: movieFor(this.room, slot.movieId) })) }));
  }

  caption() {
    const star = HEROES.find((entry) => entry.id === this.room.starId);
    return `🎬 ${star.name}'s Movie Draft\n${this.room.players.map((player) => `${player.role} ${player.name}: ${player.slots.map((slot) => movieFor(this.room, slot.movieId)?.title).join(", ")}`).join("\n")}\n\nWho drafted better? Comment ${this.room.players.map((player) => player.role).join(" / ")} 👇\n${location.origin}`;
  }

  async prepareResult() {
    const key = JSON.stringify(this.room.players.map((player) => player.slots));
    if (this.resultKey === key) return;
    this.resultKey = key;
    this.resultBlob = null;
    try {
      const star = HEROES.find((entry) => entry.id === this.room.starId);
      const blob = await createPartyResultCard(star.name, this.resultPlayers());
      if (this.resultKey !== key) return;
      this.resultBlob = blob;
      this.render();
    } catch (error) {
      console.error("Result card error", error);
      this.toast("Could not make the result image. Try Play Again.");
    }
  }

  downloadResult() {
    if (!this.resultBlob) return;
    const url = URL.createObjectURL(this.resultBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "movie-draft-result.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    this.toast("Image downloaded. Share it on Instagram and ask friends to vote.");
  }

  async shareResult() {
    if (!this.resultBlob) return;
    const file = new File([this.resultBlob], "movie-draft-result.png", { type: "image/png" });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) return this.downloadResult();
    try { await navigator.share({ files: [file], title: "Movie Draft result", text: this.caption() }); }
    catch (error) { if (error.name !== "AbortError") this.downloadResult(); }
  }

  async copyCaption() {
    try { await navigator.clipboard.writeText(this.caption()); this.toast("Caption copied."); }
    catch { this.toast("Could not copy the caption in this browser."); }
  }
}
