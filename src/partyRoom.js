import { GAME_CONFIG, STARS_CATALOG } from "./data/moviesData.js";
import { createPartyResultCard } from "./shareCard.js";
import { detachAds, hydrateAds } from "./ads.js";

const DRAFT_STARS = STARS_CATALOG.filter((star) => star.category === "Hero" || star.category === "Heroine");
const REACTIONS = ["🔥", "💰", "🍿", "👏", "🏆", "🗣️ Teesko!"];
const slotCount = (room) => room?.slotCount || GAME_CONFIG.slotsPerPlayer;
const startingBudget = (room) => room?.startingBudget || GAME_CONFIG.defaultBudget;

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
  return DRAFT_STARS.find((star) => star.id === room?.starId)?.movies.find((movie) => movie.id === id);
}

function canDraftMovie(player, movieId, room) {
  return player.connected && player.slots.length < slotCount(room) &&
    (DRAFT_STARS.find((star) => star.id === room.starId)?.movies.length < slotCount(room) ||
      !player.slots.some((slot) => slot.movieId === movieId));
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
    this.joinRetryTimer = null;
    this.joinTimeout = null;
    this.hostReconnectTimer = null;
    this.startTimer = null;
    this.arena = document.getElementById("party-arena");
    this.arena?.addEventListener("click", (event) => this.handleClick(event));
    document.getElementById("btn-party-start")?.addEventListener("click", () => this.start());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.reconnectHost();
        this.scheduleAutoStart();
      }
    });
    window.addEventListener("online", () => this.reconnectHost());
  }

  get active() { return Boolean(this.room); }
  get code() { return this.room?.code || null; }
  get player() { return this.room?.players.find((player) => player.role === this.role); }

  create({ code, name, starId, size, deckMode, budget = 20, slots = 5 }) {
    if (typeof Peer === "undefined") return this.toast("Online service is still loading. Try again shortly.");
    this.leave(false);
    const count = Number(size);
    if (!Number.isInteger(count) || count < 2 || count > 5) return this.toast("Choose 2 to 5 players.");
    const initialBudget = Number(budget);
    const movieSlots = Number(slots);
    if (!Number.isInteger(initialBudget) || initialBudget < 20 || initialBudget > 100 || initialBudget % 10 !== 0) return this.toast("Choose a budget from ₹20 to ₹100.");
    if (!Number.isInteger(movieSlots) || movieSlots < 5 || movieSlots > 7) return this.toast("Choose 5 to 7 movies per player.");
    const star = DRAFT_STARS.find((entry) => entry.id === starId);
    if (!star?.movies.length) return this.toast("This star has no available films yet.");
    this.host = true;
    this.closing = false;
    this.role = "P1";
    const peer = new Peer(`MD-${code}`);
    this.peer = peer;
    peer.on("open", () => {
      if (this.peer !== peer || this.closing) return;
      clearTimeout(this.hostReconnectTimer);
      this.hostReconnectTimer = null;
      if (this.room) {
        this.publish();
        this.toast("Room connection restored. Guests can join again.");
        return;
      }
      this.room = {
        code, size: count, starId, startingBudget: initialBudget, slotCount: movieSlots,
        deckMode: count > 2 || movieSlots > 5 ? "extended-shuffled" : deckMode,
        phase: "lobby", players: [{ role: "P1", name: name.slice(0, 30), connected: true,
          budget: initialBudget, slots: [] }],
        poolIds: [], index: 0, bid: 0, highBidder: null, passed: [], bidHistory: [], lastSale: "",
      };
      this.enter();
      this.toast(`Room ${code} is ready. Invite ${count - 1} more ${count === 2 ? "player" : "players"}.`);
    });
    peer.on("connection", (conn) => this.acceptConnection(conn));
    peer.on("disconnected", () => {
      if (this.peer !== peer || this.closing) return;
      this.toast("Room connection paused. Keep this tab open; reconnecting…");
      this.scheduleHostReconnect();
    });
    peer.on("error", (error) => {
      if (error.type === "unavailable-id" && !this.room) {
        this.leave(false);
        this.toast("That room code is taken. Create another room.");
      } else if (this.peer === peer && !this.closing) {
        this.toast(`Room connection error: ${error.message || error.type}`);
        this.scheduleHostReconnect();
      }
    });
  }

  scheduleHostReconnect() {
    if (this.hostReconnectTimer || !this.host || this.closing) return;
    this.hostReconnectTimer = setTimeout(() => {
      this.hostReconnectTimer = null;
      this.reconnectHost();
      if (this.peer?.disconnected) this.scheduleHostReconnect();
    }, 3000);
  }

  reconnectHost() {
    if (!this.host || this.closing || document.hidden || !navigator.onLine) return;
    const peer = this.peer;
    if (peer?.disconnected && !peer.destroyed) {
      try { peer.reconnect(); } catch { this.scheduleHostReconnect(); }
    }
  }

  join({ code, name }) {
    if (typeof Peer === "undefined") return this.toast("Online service is still loading. Try again shortly.");
    this.leave(false);
    this.host = false;
    this.closing = false;
    const peer = new Peer();
    this.peer = peer;
    const status = document.getElementById("join-connection-status");
    if (status) status.textContent = "Connecting to the host…";
    const joinButton = document.getElementById("btn-submit-join-room");
    if (joinButton) { joinButton.disabled = true; joinButton.textContent = "Connecting…"; }
    this.joinTimeout = setTimeout(() => {
      if (this.peer !== peer || this.room) return;
      this.leave(false);
      this.toast("Host is offline. Ask them to reopen the room tab, then try again.");
    }, 90000);
    const retry = () => {
      if (this.joinRetryTimer || this.peer !== peer || this.closing || this.room) return;
      if (status) status.textContent = "Waiting for the host. Ask them to keep the room tab open; retrying…";
      this.joinRetryTimer = setTimeout(() => {
        this.joinRetryTimer = null;
        connect();
      }, 3000);
    };
    const connect = () => {
      if (this.peer !== peer || this.closing || this.room || peer.destroyed) return;
      clearTimeout(this.joinRetryTimer);
      this.joinRetryTimer = null;
      if (peer.disconnected) {
        try { peer.reconnect(); } catch {}
        retry();
        return;
      }
      const previous = this.conn;
      this.conn = null;
      try { previous?.close(); } catch {}
      const conn = peer.connect(`MD-${code}`, { reliable: true });
      this.conn = conn;
      const watchdog = setTimeout(() => {
        if (this.conn !== conn || this.room) return;
        try { conn.close(); } catch {}
        retry();
      }, 12000);
      conn.on("open", () => {
        clearTimeout(watchdog);
        const roleHint = sessionStorage.getItem(`movie-draft-role-${code}`);
        conn.send({ type: "JOIN_REQUEST", name: name.slice(0, 30), roleHint });
      });
      conn.on("data", (message) => {
        const data = decodeMessage(message);
        if (!data || typeof data !== "object") return;
        if (data.type === "JOIN_ACCEPTED") {
          clearTimeout(watchdog);
          clearTimeout(this.joinTimeout);
          clearTimeout(this.joinRetryTimer);
          this.joinTimeout = null;
          this.joinRetryTimer = null;
          if (status) status.textContent = "";
          if (joinButton) { joinButton.disabled = false; joinButton.textContent = "Join Room"; }
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
          clearTimeout(watchdog);
          this.toast(data.reason || "Could not join this room.");
          this.leave(false);
        }
      });
      conn.on("close", () => {
        clearTimeout(watchdog);
        if (!this.closing && this.room) {
          this.toast("Host disconnected. The room has closed.");
          this.leave();
        } else if (this.conn === conn) retry();
      });
      conn.on("error", () => { clearTimeout(watchdog); retry(); });
    };
    peer.on("open", connect);
    peer.on("error", (error) => {
      if (this.peer !== peer || this.closing || this.room) return;
      if (error.type === "peer-unavailable" || error.type === "network" || error.type === "webrtc") retry();
      else {
        this.leave(false);
        this.toast(`Connection error: ${error.message || error.type}`);
      }
    });
    peer.on("disconnected", retry);
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
            budget: startingBudget(this.room), slots: [] };
          this.room.players.push(player);
        }
        if (!player && this.room?.phase === "lobby") {
          player = this.room.players.find((entry) => !entry.connected);
          if (player) { player.name = name; player.slots = []; player.budget = startingBudget(this.room); }
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
        this.scheduleAutoStart();
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
    clearTimeout(this.joinRetryTimer);
    clearTimeout(this.joinTimeout);
    clearTimeout(this.hostReconnectTimer);
    clearTimeout(this.startTimer);
    this.joinRetryTimer = null;
    this.joinTimeout = null;
    this.hostReconnectTimer = null;
    this.startTimer = null;
    const joinButton = document.getElementById("btn-submit-join-room");
    if (joinButton) { joinButton.disabled = false; joinButton.textContent = "Join Room"; }
    const status = document.getElementById("join-connection-status");
    if (status) status.textContent = "";
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

  scheduleAutoStart() {
    if (!this.host || this.startTimer || this.room?.phase !== "lobby") return;
    if (this.room.players.length !== this.room.size || this.room.players.some((player) => !player.connected)) return;
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      if (this.room?.phase === "lobby") this.start();
    }, 2500);
  }

  start() {
    if (!this.host || !this.room) return;
    if (this.room.phase !== "lobby" && this.room.phase !== "complete") return;
    if (this.room.players.length !== this.room.size || this.room.players.some((player) => !player.connected)) {
      return this.toast(`Wait for all ${this.room.size} players to join.`);
    }
    clearTimeout(this.startTimer);
    this.startTimer = null;
    const star = DRAFT_STARS.find((entry) => entry.id === this.room.starId);
    const all = star.movies;
    if (!all.length) return this.toast("This star has no available films yet.");
    const originals = all.filter((movie) => movie.inVideoDraft).sort((a, b) => a.videoOrder - b.videoOrder);
    const useAll = this.room.size > 2 || slotCount(this.room) > 5 || this.room.deckMode === "extended-shuffled" || originals.length < slotCount(this.room) * 2;
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
    for (const player of this.room.players) { player.budget = startingBudget(this.room); player.slots = []; }
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
    const movieId = room.poolIds[room.index];
    if (!movieId || !canDraftMovie(player, movieId, room)) return;
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
      if (room.players.some((other) => other.role !== role && canDraftMovie(other, movieId, room) && other.budget > 0 && !room.passed.includes(other.role))) return;
      this.award(role, 0);
      this.publish();
    }
  }

  resolveIfReady() {
    const room = this.room;
    if (!room || room.phase !== "draft") return;
    const movieId = room.poolIds[room.index];
    const othersCanBid = room.players.some((player) => player.connected &&
      player.role !== room.highBidder && !room.passed.includes(player.role) &&
      canDraftMovie(player, movieId, room) && player.budget >= room.bid + 1);
    if (room.highBidder && !othersCanBid) {
      this.award(room.highBidder, room.bid);
    } else if (!room.highBidder && room.players.every((player) =>
      !canDraftMovie(player, movieId, room) || room.passed.includes(player.role) || player.budget === 0)) {
      room.lastSale = "No bids · next film";
      this.nextMovie();
    }
  }

  award(role, price) {
    const room = this.room;
    const player = room.players.find((entry) => entry.role === role);
    const movieId = room.poolIds[room.index];
    if (!player || !movieId || !canDraftMovie(player, movieId, room)) return;
    player.budget -= price;
    player.slots.push({ movieId, price });
    room.lastSale = `${player.name} won ${movieFor(room, movieId)?.title || "the film"} for ${price ? `₹${price}` : "free"}`;
    this.nextMovie();
  }

  nextMovie() {
    const room = this.room;
    if (room.players.every((player) => player.slots.length >= slotCount(room))) {
      room.phase = "complete";
      return;
    }
    const allIds = DRAFT_STARS.find((star) => star.id === room.starId).movies.map((movie) => movie.id);
    do {
      room.index += 1;
      if (room.index >= room.poolIds.length) room.poolIds.push(...shuffle(allIds));
    } while (!room.players.some((player) => canDraftMovie(player, room.poolIds[room.index], room)));
    room.bid = 0;
    room.highBidder = null;
    room.passed = [];
    room.bidHistory = [];
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
    start.textContent = this.room.phase === "complete" ? "Play Again" : this.room.phase === "lobby" ? "Start Movie Draft" : "Draft in progress";
    if (this.room.phase === "complete") start.disabled = false;
  }

  render() {
    const room = this.room;
    if (!room || !this.arena) return;
    const star = DRAFT_STARS.find((entry) => entry.id === room.starId);
    const picks = slotCount(room);
    const budget = startingBudget(room);
    const joined = room.players.filter((player) => player.connected).length;
    const playerCards = Array.from({ length: room.size }, (_, index) => {
      const player = room.players[index];
      const mine = player?.role === this.role;
      const slots = player?.slots || [];
      return `<article class="party-player ${mine ? "mine" : ""} ${!player?.connected ? "pending" : ""}">
        <div class="party-player-head"><span class="party-role">P${index + 1}${mine ? " · YOU" : ""}</span><strong>${escapeHtml(player?.name || "Waiting…")}</strong><span class="party-budget">₹${player?.budget ?? budget}</span></div>
        <div class="party-player-progress"><span style="width:${slots.length / picks * 100}%"></span></div>
        <div class="party-picks">${Array.from({ length: picks }, (_, slotIndex) => {
          const slot = slots[slotIndex];
          const movie = slot && movieFor(room, slot.movieId);
          return movie ? `<span class="party-pick" title="Won for ₹${slot.price}"><img src="${movie.poster}" alt="" /><span>${escapeHtml(movie.shortTitle || movie.title)}</span></span>` : `<span class="party-pick party-empty">${slotIndex + 1}</span>`;
        }).join("")}</div>
        <span class="party-slot-count">${slots.length}/${picks} films</span>
      </article>`;
    }).join("");

    let center = "";
    if (room.phase === "lobby" || room.phase === "paused") {
      const waiting = room.size - joined;
      const roster = Array.from({ length: room.size }, (_, index) => {
        const player = room.players[index];
        return `<li class="${player?.connected ? "joined" : "waiting"}"><span>P${index + 1}${index === 0 ? " · Host" : ""}</span><strong>${escapeHtml(player?.name || "Waiting to join")}</strong><span>${player?.connected ? "● Joined" : "○ Waiting"}</span></li>`;
      }).join("");
      center = `<section class="party-wait"><span class="party-big-icon">${room.phase === "paused" ? "⏸" : "🎬"}</span>
        <h2>${room.phase === "paused" ? "Waiting for a player to reconnect" : `Your ${room.size}-player room is ready`}</h2>
        <p>${joined}/${room.size} players connected · ${escapeHtml(star.name)} movies · ${picks} picks each · ₹${budget} budget</p>
        <ol class="party-lobby-players">${roster}</ol>
        <p class="party-lobby-status">${room.phase === "paused" ? "The draft resumes when everyone reconnects." : waiting ? `Waiting for ${waiting} more ${waiting === 1 ? "player" : "players"}…` : "Everyone is here. Starting the movie draft…"}</p>
        <strong class="party-code">${escapeHtml(room.code)}</strong>
        ${this.host && room.phase === "lobby" ? `<button class="nf-btn-red" data-party="start" ${joined === room.size ? "" : "disabled"}>Start Movie Draft</button>` : ""}
        <button class="nf-btn-ghost" data-party="copy">Copy invite link</button>
        <small>${this.host ? "Keep this room tab open while guests join." : "The draft starts automatically when everyone joins."}</small></section>`;
    } else if (room.phase === "draft") {
      const movie = movieFor(room, room.poolIds[room.index]);
      const me = this.player;
      const eligible = me && canDraftMovie(me, room.poolIds[room.index], room);
      const canBid = eligible &&
        !room.passed.includes(this.role) && room.highBidder !== this.role && me.budget >= room.bid + 1;
      const canPass = eligible &&
        !room.passed.includes(this.role) && room.highBidder !== this.role;
      const freeClaim = eligible && !room.highBidder &&
        room.players.every((player) => player.role === this.role || !canDraftMovie(player, room.poolIds[room.index], room) || player.budget === 0 || room.passed.includes(player.role));
      center = `<section class="party-stage"><div class="party-round"><strong>${escapeHtml(star.name)}'s Movies Draft</strong><span>FILM ${room.index + 1} / ${room.poolIds.length}</span></div>
        <div class="party-showcase"><div class="party-poster"><img src="${movie?.poster || ""}" alt="${escapeHtml(movie?.title || "Film")} poster" /><h2>${escapeHtml(movie?.title || "Film")}</h2></div>
          <div class="party-bidding"><span class="party-live-label">🔴 LIVE BIDDING</span>
            <div class="party-high">${room.highBidder ? `<strong>₹${room.bid}</strong><span>${escapeHtml(room.players.find((player) => player.role === room.highBidder)?.name)} leads</span>` : `<strong>₹1</strong><span>Opening bid</span>`}</div>
            <div class="party-bid-trail">${room.bidHistory.length ? room.bidHistory.map((bid) => `<span>${bid.role} ₹${bid.amount}</span>`).join("") : "Be first to bid"}</div>
            <div class="party-controls"><button class="nf-btn-red" data-party="bid" ${canBid ? "" : "disabled"}>Bid ₹${room.bid + 1}</button><button class="nf-btn-plus" data-party="bid2" ${canBid && me.budget >= room.bid + 2 ? "" : "disabled"}>+₹2</button><button class="nf-btn-teesko" data-party="pass" ${canPass ? "" : "disabled"}>Teesko! Pass</button><button class="nf-btn-skip" data-party="skip" ${this.host ? "" : "disabled"}>${this.host ? "Skip film" : "Skip (host)"}</button>${freeClaim ? `<button class="nf-btn-red" data-party="claim">Claim free</button>` : ""}</div>
            <p class="party-bid-help">${!eligible ? "You already drafted this film or filled your lineup." : room.passed.includes(this.role) ? "You passed on this film." : room.highBidder === this.role ? "Your bid leads. Wait for the others." : `${escapeHtml(me?.name || "Your player")}, you have ₹${me?.budget ?? 0} left.`}</p>
          </div></div></section>`;
    } else {
      const labels = room.players.map((player) => player.role).join(" / ");
      center = `<section class="party-results"><span class="complete-badge">DRAFT COMPLETE</span><h2>Who drafted better?</h2><p>Share the lineups on Instagram. Ask friends to comment ${labels}.</p>
        <div class="party-results-grid">${room.players.map((player) => `<div class="party-result"><span>${player.role}</span><strong>${escapeHtml(player.name)}</strong><small>₹${player.budget} left</small><ol>${player.slots.map((slot) => `<li>${escapeHtml(movieFor(room, slot.movieId)?.title || "Film")} <em>₹${slot.price}</em></li>`).join("")}</ol></div>`).join("")}</div>
        <div class="party-result-actions"><button class="nf-btn-red" data-party="share" ${this.resultBlob ? "" : "disabled"}>Share result</button><button class="nf-btn-ghost" data-party="download" ${this.resultBlob ? "" : "disabled"}>Download image</button><button class="nf-btn-ghost" data-party="caption">Copy caption</button>${this.host ? `<button class="nf-btn-red" data-party="again">Play Again</button>` : ""}</div>
        <small>${this.resultBlob ? "Image ready to share." : "Preparing the result image…"}</small></section>`;
    }
    detachAds(this.arena);
    this.arena.innerHTML = `<div class="party-room-strip"><div><span class="room-live-pill">🔴 LIVE ROOM</span><strong>${escapeHtml(room.code)}</strong><span>${joined}/${room.size} players</span></div><div><button class="nf-btn-ghost-sm" data-party="copy">Copy link</button><button class="nf-btn-ghost-sm" data-party="leave">Leave</button></div></div>
      ${room.phase === "lobby" ? '<div class="ad-slot ad-slot-waiting" data-ad-slot="waiting" hidden></div>' : ""}
      <div class="party-layout ${room.phase === "complete" ? "party-layout-complete" : ""}"><div class="party-main">${center}<div class="party-reactions"><span>Quick Reactions:</span>${REACTIONS.map((emoji) => `<button class="btn-react" data-party="react" data-emoji="${escapeHtml(emoji)}">${emoji === "🗣️ Teesko!" ? "Teesko!" : emoji}</button>`).join("")}</div>${room.phase === "draft" ? '<div class="ad-slot ad-slot-live" data-ad-slot="live" hidden></div>' : ""}<p class="party-last-sale">${escapeHtml(room.lastSale || "")}</p></div><aside class="party-sidebar"><h3>Lineups</h3><div class="party-scoreboard">${playerCards}</div>${room.phase === "complete" ? '<div class="ad-slot ad-slot-results" data-ad-slot="results" hidden></div>' : ""}</aside></div>`;
    hydrateAds(this.arena);
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
    const star = DRAFT_STARS.find((entry) => entry.id === this.room.starId);
    return `🎬 ${star.name}'s Movie Draft\n${this.room.players.map((player) => `${player.role} ${player.name}: ${player.slots.map((slot) => movieFor(this.room, slot.movieId)?.title).join(", ")}`).join("\n")}\n\nWho drafted better? Comment ${this.room.players.map((player) => player.role).join(" / ")} 👇\n${location.origin}`;
  }

  async prepareResult() {
    const key = JSON.stringify(this.room.players.map((player) => player.slots));
    if (this.resultKey === key) return;
    this.resultKey = key;
    this.resultBlob = null;
    try {
      const star = DRAFT_STARS.find((entry) => entry.id === this.room.starId);
      const blob = await createPartyResultCard(star.name, this.resultPlayers(), startingBudget(this.room), slotCount(this.room));
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
