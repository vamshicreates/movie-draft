import { GAME_CONFIG, STARS_CATALOG } from "./data/moviesData.js";

// Keep only Heroes for this minimal version
const HEROES_LIST = STARS_CATALOG.filter((s) => s.category === "Hero");

function makeSvgPoster(title, year = "", subtitle = "Movie Draft") {
  const safeTitle = String(title).replace(/[<>&"']/g, "");
  const safeSub = String(subtitle).replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#222222"/>
        <stop offset="100%" stop-color="#0A0A0A"/>
      </linearGradient>
    </defs>
    <rect width="400" height="560" fill="url(#bg)"/>
    <rect x="20" y="20" width="360" height="520" rx="10" fill="none" stroke="#E50914" stroke-width="2" stroke-opacity="0.7"/>
    <text x="200" y="90" text-anchor="middle" fill="#E50914" font-family="sans-serif" font-size="15" font-weight="bold" letter-spacing="3">${safeSub.toUpperCase()}</text>
    <text x="200" y="280" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="32" font-weight="800">${safeTitle.slice(0, 18)}</text>
    <text x="200" y="470" text-anchor="middle" fill="#B3B3B3" font-family="monospace" font-size="20" font-weight="bold">${year}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const state = {
  stars: HEROES_LIST,
  activeStarId: "nani",
  deckMode: "video-exact",
  opponentMode: "2p", // "2p" | "ai" | "online"
  soundEnabled: true,

  pool: [],
  currentIndex: 0,
  currentBid: 0,
  highBidder: null,
  bidHistory: [],
  isResolving: false,
  draftFinished: false,

  p1: {
    name: "Player 1",
    budget: GAME_CONFIG.defaultBudget,
    slots: [],
    votes: 54,
  },
  p2: {
    name: "Player 2",
    budget: GAME_CONFIG.defaultBudget,
    slots: [],
    votes: 46,
  },

  // Multiplayer State (Supports both WebSocket & WebRTC/PeerJS on Vercel)
  isMultiplayer: false,
  transportType: "ws", // "ws" | "peerjs"
  roomCode: null,
  myRole: null, // "P1" | "P2" | "SPECTATOR"
  myName: "Player 1",
  roomPlayers: {
    p1: { name: "Player 1", connected: false },
    p2: { name: "Player 2", connected: false },
    spectatorCount: 0,
  },
};

// ============================================================================
// SOUND ENGINE
// ============================================================================
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

function playBidTick(amount) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320 + Math.min(amount * 35, 500), ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // ignore
  }
}

function playSoldChaChing() {
  if (!state.soundEnabled) return;
  const audioEl = document.getElementById("sfx-chaching");
  if (audioEl) {
    audioEl.currentTime = 0;
    audioEl.volume = 0.85;
    audioEl.play().catch(() => {});
  }
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const item = document.createElement("div");
  item.className = "toast-item";
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function triggerFloatingReaction(emoji) {
  const container = document.getElementById("reactions-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "floating-reaction";
  el.textContent = emoji;
  const randX = 20 + Math.random() * 60;
  el.style.left = `${randX}%`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ============================================================================
// MULTIPLAYER TRANSPORT LAYER (HYBRID WEBSOCKET + WEBRTC PEERJS)
// ============================================================================
let wsSocket = null;
let peerInstance = null;
let peerConnection = null;

function generateRoomCode() {
  const words = ["NANI", "PUSH", "RRR", "KGF", "MASS", "HERO", "STAR", "CHIRU", "MAHESH", "PRABHAS", "NTR", "CHARAN"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${word}${num}`;
}

function getWsUrl() {
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${loc.host}`;
}

function isVercelOrStatic() {
  return (
    window.location.hostname.includes("vercel.app") ||
    window.location.hostname.includes("github.io") ||
    window.location.hostname.includes("netlify.app")
  );
}

function sendMultiplayerMessage(msg) {
  if (state.transportType === "peerjs" && peerConnection) {
    try {
      peerConnection.send(JSON.stringify(msg));
    } catch (err) {
      console.error("PeerJS send error:", err);
    }
  } else if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
    wsSocket.send(JSON.stringify(msg));
  }
}

function initPeerJsHost(roomCode, playerName, starId, deckMode) {
  state.transportType = "peerjs";
  const peerId = `MD-${roomCode.toUpperCase()}`;

  if (peerInstance) peerInstance.destroy();
  if (typeof Peer === "undefined") {
    showToast("PeerJS loading... try again in 2s.");
    return;
  }

  peerInstance = new Peer(peerId);

  peerInstance.on("open", () => {
    state.isMultiplayer = true;
    state.roomCode = roomCode.toUpperCase();
    state.myRole = "P1";
    state.myName = playerName;
    state.opponentMode = "online";
    state.activeStarId = starId;
    state.deckMode = deckMode;
    state.p1.name = playerName;
    state.roomPlayers = {
      p1: { name: playerName, connected: true },
      p2: { name: "Player 2", connected: false },
      spectatorCount: 0,
    };

    const newUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
    window.history.replaceState({}, "", newUrl);

    closeMpModal();
    updateMultiplayerBadge();
    startNewDraft(false);
    showToast(`Room ${state.roomCode} created! Share the invite link with Player 2.`);
  });

  peerInstance.on("connection", (conn) => {
    peerConnection = conn;

    conn.on("open", () => {
      conn.send(
        JSON.stringify({
          type: "ROOM_STATE_SYNC",
          room: {
            code: state.roomCode,
            activeStarId: state.activeStarId,
            deckMode: state.deckMode,
            p1: state.p1,
            p2: state.p2,
          },
          gameState: getCurrentGameStatePayload(),
        })
      );
    });

    conn.on("data", (raw) => {
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        handleMultiplayerMessage(data);
      } catch (err) {
        console.error("Data parse error:", err);
      }
    });

    conn.on("close", () => {
      state.roomPlayers.p2.connected = false;
      updateMultiplayerBadge();
      showToast("Player 2 disconnected.");
    });
  });

  peerInstance.on("error", (err) => {
    if (err.type === "unavailable-id") {
      // Room code collision: try another
      const newCode = generateRoomCode();
      initPeerJsHost(newCode, playerName, starId, deckMode);
    } else {
      console.error("PeerJS error:", err);
    }
  });
}

function initPeerJsJoin(roomCode, playerName) {
  state.transportType = "peerjs";
  const targetPeerId = `MD-${roomCode.toUpperCase()}`;

  if (peerInstance) peerInstance.destroy();
  if (typeof Peer === "undefined") {
    showToast("PeerJS loading... try again in 2s.");
    return;
  }

  peerInstance = new Peer();

  peerInstance.on("open", () => {
    const conn = peerInstance.connect(targetPeerId, { reliable: true });
    peerConnection = conn;

    conn.on("open", () => {
      state.isMultiplayer = true;
      state.roomCode = roomCode.toUpperCase();
      state.myRole = "P2";
      state.myName = playerName;
      state.p2.name = playerName;
      state.opponentMode = "online";
      state.roomPlayers.p2 = { name: playerName, connected: true };

      conn.send(
        JSON.stringify({
          type: "PLAYER_JOINED",
          newPlayer: { name: playerName, role: "P2" },
        })
      );

      const newUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
      window.history.replaceState({}, "", newUrl);

      closeMpModal();
      updateMultiplayerBadge();
      showToast(`Connected to Room ${state.roomCode} as Player 2!`);
    });

    conn.on("data", (raw) => {
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        handleMultiplayerMessage(data);
      } catch (err) {
        console.error("PeerJS data parse error:", err);
      }
    });

    conn.on("close", () => {
      showToast("Disconnected from host.");
      leaveRoom();
    });
  });

  peerInstance.on("error", (err) => {
    showToast(`Could not join room ${roomCode}. Please check code.`);
  });
}

function connectWebSocket(callback) {
  if (isVercelOrStatic()) {
    // On Vercel, directly use WebRTC PeerJS
    if (callback) callback();
    return;
  }

  if (wsSocket && (wsSocket.readyState === WebSocket.OPEN || wsSocket.readyState === WebSocket.CONNECTING)) {
    if (wsSocket.readyState === WebSocket.OPEN && callback) callback();
    return;
  }

  try {
    wsSocket = new WebSocket(getWsUrl());

    wsSocket.onopen = () => {
      state.transportType = "ws";
      updateMultiplayerBadge();
      if (callback) callback();
    };

    wsSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMultiplayerMessage(data);
      } catch (err) {
        console.error("WS Parse Error:", err);
      }
    };

    wsSocket.onclose = () => {
      if (state.isMultiplayer && state.transportType === "ws") {
        updateMultiplayerBadge();
      }
    };

    wsSocket.onerror = () => {
      // Fallback to PeerJS if WS server is unreachable
      state.transportType = "peerjs";
    };
  } catch {
    state.transportType = "peerjs";
  }
}

function handleMultiplayerMessage(data) {
  const { type } = data;

  if (type === "ROOM_CREATED") {
    state.isMultiplayer = true;
    state.roomCode = data.room.code;
    state.myRole = data.assignedRole;
    state.opponentMode = "online";
    state.roomPlayers = {
      p1: data.room.p1,
      p2: data.room.p2,
      spectatorCount: data.room.spectatorCount,
    };
    state.p1.name = data.room.p1.name;
    state.p2.name = data.room.p2.name;

    const newUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
    window.history.replaceState({}, "", newUrl);

    closeMpModal();
    updateMultiplayerBadge();
    renderAll();
    showToast(`Room ${state.roomCode} created! You are Player 1 (Host).`);
    return;
  }

  if (type === "ROOM_JOINED" || type === "ROOM_STATE_SYNC") {
    state.isMultiplayer = true;
    state.roomCode = (data.room?.code || state.roomCode).toUpperCase();
    state.myRole = state.myRole || data.assignedRole || "P2";
    state.opponentMode = "online";
    state.activeStarId = data.room?.activeStarId || state.activeStarId;
    state.deckMode = data.room?.deckMode || state.deckMode;

    if (data.room?.p1) state.p1.name = data.room.p1.name;
    if (data.room?.p2) state.p2.name = data.room.p2.name;

    state.roomPlayers = {
      p1: { name: state.p1.name, connected: true },
      p2: { name: state.p2.name, connected: true },
      spectatorCount: 0,
    };

    if (data.gameState) {
      syncFullGameState(data.gameState);
    } else {
      startNewDraft(false);
    }

    closeMpModal();
    updateMultiplayerBadge();
    renderAll();
    showToast(`Connected to Room ${state.roomCode}!`);
    return;
  }

  if (type === "PLAYER_JOINED") {
    state.roomPlayers.p2 = { name: data.newPlayer.name, connected: true };
    state.p2.name = data.newPlayer.name;
    updateMultiplayerBadge();
    renderAll();
    showToast(`👋 ${data.newPlayer.name} joined the draft as ${data.newPlayer.role}!`);

    if (state.myRole === "P1") {
      broadcastFullGameState();
    }
    return;
  }

  if (type === "PLAYER_LEFT") {
    state.roomPlayers.p2 = { name: "Player 2", connected: false };
    updateMultiplayerBadge();
    renderAll();
    showToast(`⚠️ ${data.leftName || "Opponent"} left the room.`);
    return;
  }

  if (type === "ACTION_EVENT" || type === "SYNC_ACTION") {
    const { action, payload } = data;
    handleRemoteAction(action, payload);
    return;
  }

  if (type === "REACTION_POP" || type === "REACTION") {
    triggerFloatingReaction(data.emoji);
    return;
  }

  if (type === "ERROR") {
    showToast(`❌ ${data.message}`);
    return;
  }
}

function handleRemoteAction(action, payload) {
  if (action === "PLACE_BID") {
    applyBidLocally(payload.playerKey, payload.customAmount, false);
  } else if (action === "TEESKO") {
    applyTeeskoLocally(payload.passingPlayerKey, false);
  } else if (action === "AWARD_MOVIE") {
    applyAwardLocally(payload.winnerKey, payload.price, false);
  } else if (action === "SKIP_MOVIE") {
    advanceToNextMovie(false);
  } else if (action === "RESET_DRAFT") {
    if (payload?.gameState) {
      syncFullGameState(payload.gameState);
    } else {
      if (payload?.activeStarId) state.activeStarId = payload.activeStarId;
      if (payload?.deckMode) state.deckMode = payload.deckMode;
      startNewDraft(false);
    }
    showToast("🔄 Draft reset by host.");
  } else if (action === "VOTE") {
    if (payload.target === "P1") state.p1.votes += 1;
    else state.p2.votes += 1;
    renderShowdownPanel();
  } else if (action === "FULL_SYNC" && state.myRole !== "P1") {
    syncFullGameState(payload.gameState);
  }
}

function getCurrentGameStatePayload() {
  return {
    currentIndex: state.currentIndex,
    currentBid: state.currentBid,
    highBidder: state.highBidder,
    bidHistory: state.bidHistory,
    draftFinished: state.draftFinished,
    activeStarId: state.activeStarId,
    deckMode: state.deckMode,
    pool: state.pool,
    p1: state.p1,
    p2: state.p2,
  };
}

function syncFullGameState(gs) {
  if (!gs) return;
  state.currentIndex = gs.currentIndex;
  state.currentBid = gs.currentBid;
  state.highBidder = gs.highBidder;
  state.bidHistory = gs.bidHistory || [];
  state.draftFinished = gs.draftFinished;
  state.activeStarId = gs.activeStarId || state.activeStarId;
  state.deckMode = gs.deckMode || state.deckMode;
  state.pool = gs.pool || state.pool;
  state.p1 = gs.p1 || state.p1;
  state.p2 = gs.p2 || state.p2;
  renderAll();
}

function broadcastFullGameState() {
  if (!state.isMultiplayer || !state.roomCode) return;
  sendMultiplayerMessage({
    type: "SYNC_ACTION",
    roomCode: state.roomCode,
    action: "FULL_SYNC",
    payload: { gameState: getCurrentGameStatePayload() },
  });
}

function updateMultiplayerBadge() {
  const dot = document.getElementById("mp-status-dot");
  const label = document.getElementById("mp-btn-label");
  const roomStrip = document.getElementById("room-status-strip");
  const waitingBanner = document.getElementById("room-waiting-banner");
  const stripCode = document.getElementById("strip-room-code");
  const stripRole = document.getElementById("strip-user-role");
  const stripPlayers = document.getElementById("strip-players-info");
  const waitCodeDisplay = document.getElementById("wait-room-code-display");

  if (!state.isMultiplayer) {
    dot?.classList.remove("connected", "waiting");
    if (label) label.textContent = "🌐 Play Online";
    roomStrip?.classList.add("hidden");
    waitingBanner?.classList.add("hidden");
    return;
  }

  const p2Joined = state.roomPlayers.p2 && state.roomPlayers.p2.connected;

  if (p2Joined) {
    dot?.classList.add("connected");
    dot?.classList.remove("waiting");
    waitingBanner?.classList.add("hidden");
  } else {
    dot?.classList.add("waiting");
    dot?.classList.remove("connected");
    if (state.myRole === "P1") {
      waitingBanner?.classList.remove("hidden");
      if (waitCodeDisplay) waitCodeDisplay.textContent = state.roomCode;
    }
  }

  if (label) {
    label.textContent = `Room: ${state.roomCode} · ${state.myRole || "P1"}`;
  }

  if (roomStrip) {
    roomStrip.classList.remove("hidden");
    if (stripCode) stripCode.textContent = `CODE: ${state.roomCode}`;
    if (stripRole) stripRole.textContent = `YOU: ${state.myRole || "P1"}`;
    if (stripPlayers) {
      stripPlayers.textContent = `${state.p1.name} (P1) vs ${p2Joined ? state.p2.name : "Waiting..."} (P2)`;
    }
  }
}

// ============================================================================
// DRAFT POOL & GAME LIFECYCLE
// ============================================================================
function getActiveStar() {
  return state.stars.find((s) => s.id === state.activeStarId) || state.stars[0];
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildMoviePool(star, mode) {
  const allMovies = [...star.movies];
  const videoMovies = allMovies
    .filter((m) => m.inVideoDraft)
    .sort((a, b) => (a.videoOrder || 99) - (b.videoOrder || 99));

  if (mode === "video-exact") {
    return videoMovies.length >= 10 ? videoMovies : allMovies.slice(0, 10);
  }
  if (mode === "video-shuffled") {
    const base = videoMovies.length >= 10 ? videoMovies : allMovies.slice(0, 10);
    return shuffleArray(base);
  }
  return shuffleArray(allMovies);
}

function startNewDraft(broadcast = true) {
  const star = getActiveStar();
  state.pool = buildMoviePool(star, state.deckMode);
  state.currentIndex = 0;
  state.currentBid = 0;
  state.highBidder = null;
  state.bidHistory = [];
  state.isResolving = false;
  state.draftFinished = false;

  const p1Input = document.getElementById("input-p1-name");
  const p2Input = document.getElementById("input-p2-name");

  if (!state.isMultiplayer) {
    state.p1.name = p1Input?.value || "Player 1";
    state.p2.name = state.opponentMode === "ai" ? "AI Opponent" : (p2Input?.value || "Player 2");
    if (p2Input && state.opponentMode === "ai") {
      p2Input.value = "AI Opponent";
    }
  }

  state.p1.budget = GAME_CONFIG.defaultBudget;
  state.p1.slots = [];
  state.p1.votes = 54;

  state.p2.budget = GAME_CONFIG.defaultBudget;
  state.p2.slots = [];
  state.p2.votes = 46;

  renderAll();

  if (broadcast && state.isMultiplayer && state.myRole === "P1") {
    sendMultiplayerMessage({
      type: "SYNC_ACTION",
      roomCode: state.roomCode,
      action: "RESET_DRAFT",
      payload: {
        activeStarId: state.activeStarId,
        deckMode: state.deckMode,
        gameState: getCurrentGameStatePayload(),
      },
    });
  }
}

// ============================================================================
// CORE BIDDING & TEESKO ENGINE
// ============================================================================
function getCurrentMovie() {
  return state.pool[state.currentIndex] || null;
}

function canPlayerControl(playerKey) {
  if (!state.isMultiplayer) return true;
  return state.myRole === playerKey;
}

function placeBid(playerKey, customAmount = null) {
  if (state.isMultiplayer && !canPlayerControl(playerKey)) {
    showToast(`You are ${state.myRole}. You can only bid with your paddle.`);
    return;
  }

  applyBidLocally(playerKey, customAmount, true);
}

function applyBidLocally(playerKey, customAmount = null, shouldBroadcast = true) {
  if (state.isResolving || state.draftFinished) return;
  const movie = getCurrentMovie();
  if (!movie) return;

  const bidder = playerKey === "P1" ? state.p1 : state.p2;
  if (bidder.slots.length >= GAME_CONFIG.slotsPerPlayer) {
    showToast(`${bidder.name} already has 5 movies.`);
    return;
  }

  const nextMin = state.highBidder === null ? 1 : state.currentBid + 1;
  const targetBid = customAmount !== null ? customAmount : nextMin;

  if (targetBid > bidder.budget) {
    showToast(`${bidder.name} only has ₹${bidder.budget} left.`);
    return;
  }
  if (targetBid < nextMin) return;

  state.currentBid = targetBid;
  state.highBidder = playerKey;
  state.bidHistory.push({ player: playerKey, amount: targetBid });

  playBidTick(targetBid);
  renderAll();

  if (shouldBroadcast && state.isMultiplayer && state.roomCode) {
    sendMultiplayerMessage({
      type: "SYNC_ACTION",
      roomCode: state.roomCode,
      action: "PLACE_BID",
      payload: { playerKey, customAmount: targetBid },
    });
  }

  if (state.opponentMode === "ai" && playerKey === "P1") {
    scheduleAiDecision();
  }
}

function handleTeesko(passingPlayerKey) {
  if (state.isMultiplayer && !canPlayerControl(passingPlayerKey)) {
    showToast(`You are ${state.myRole}. You can only pass your turn.`);
    return;
  }

  applyTeeskoLocally(passingPlayerKey, true);
}

function applyTeeskoLocally(passingPlayerKey, shouldBroadcast = true) {
  if (state.isResolving || state.draftFinished) return;
  const winningPlayerKey = passingPlayerKey === "P1" ? "P2" : "P1";
  const winner = winningPlayerKey === "P1" ? state.p1 : state.p2;

  if (winner.slots.length >= GAME_CONFIG.slotsPerPlayer) {
    showToast(`${winner.name}'s 5 slots are full.`);
    return;
  }

  const finalPrice =
    state.highBidder === winningPlayerKey ? state.currentBid : Math.min(state.currentBid, winner.budget);

  awardCurrentMovie(winningPlayerKey, finalPrice, shouldBroadcast);
}

function awardCurrentMovie(winnerKey, price, shouldBroadcast = true) {
  applyAwardLocally(winnerKey, price, shouldBroadcast);
}

function applyAwardLocally(winnerKey, price, shouldBroadcast = true) {
  if (state.isResolving || state.draftFinished) return;
  const movie = getCurrentMovie();
  if (!movie) return;

  state.isResolving = true;
  const winner = winnerKey === "P1" ? state.p1 : state.p2;
  const actualPrice = Math.max(0, Math.min(price, winner.budget));

  winner.budget -= actualPrice;
  winner.slots.push({ movie, price: actualPrice });

  playSoldChaChing();

  const overlay = document.getElementById("sold-stamp-overlay");
  const stampTitle = document.getElementById("sold-stamp-title");
  const stampPrice = document.getElementById("sold-stamp-price");
  if (overlay && stampTitle && stampPrice) {
    stampTitle.textContent = winner.name.toUpperCase();
    stampPrice.textContent = actualPrice > 0 ? `₹${actualPrice}` : "FREE (₹0)";
    overlay.classList.remove("hidden");
  }

  renderPlayerBoards();

  if (shouldBroadcast && state.isMultiplayer && state.roomCode) {
    sendMultiplayerMessage({
      type: "SYNC_ACTION",
      roomCode: state.roomCode,
      action: "AWARD_MOVIE",
      payload: { winnerKey, price: actualPrice },
    });
  }

  setTimeout(() => {
    if (overlay) overlay.classList.add("hidden");
    state.isResolving = false;
    // AWARD_MOVIE already causes both clients to advance after this animation.
    advanceToNextMovie(false);
  }, 1050);
}

function advanceToNextMovie(shouldBroadcast = true) {
  const p1Full = state.p1.slots.length >= GAME_CONFIG.slotsPerPlayer;
  const p2Full = state.p2.slots.length >= GAME_CONFIG.slotsPerPlayer;

  if (p1Full && p2Full) {
    state.draftFinished = true;
    renderAll();
    return;
  }

  if (state.currentIndex + 1 < state.pool.length) {
    state.currentIndex += 1;
    state.currentBid = 0;
    state.highBidder = null;
    state.bidHistory = [];
    renderAll();
  } else {
    state.draftFinished = true;
    renderAll();
  }

  if (shouldBroadcast && state.isMultiplayer && state.roomCode) {
    sendMultiplayerMessage({
      type: "SYNC_ACTION",
      roomCode: state.roomCode,
      action: "SKIP_MOVIE",
      payload: {},
    });
  }
}

// ============================================================================
// AI OPPONENT
// ============================================================================
let aiTimeout = null;

function scheduleAiDecision() {
  if (aiTimeout) clearTimeout(aiTimeout);
  aiTimeout = setTimeout(() => {
    if (state.isResolving || state.draftFinished || state.opponentMode !== "ai") return;
    const movie = getCurrentMovie();
    if (!movie) return;

    const ai = state.p2;
    if (ai.slots.length >= GAME_CONFIG.slotsPerPlayer || ai.budget <= state.currentBid) {
      showToast(`AI: "Teesko! Take ${movie.shortTitle || movie.title} for ₹${state.currentBid}."`);
      handleTeesko("P2");
      return;
    }

    const slotsLeft = GAME_CONFIG.slotsPerPlayer - ai.slots.length;
    const reserveNeeded = Math.max(0, slotsLeft - 1);
    const maxAffordable = Math.max(1, ai.budget - reserveNeeded);
    const valuation = Math.min(ai.budget, Math.min(maxAffordable + 2, movie.baseValue || 6));

    const nextBid = state.currentBid + 1;
    if (nextBid <= valuation && nextBid <= ai.budget) {
      placeBid("P2", nextBid);
    } else {
      showToast(`AI: "Teesko! Take ${movie.shortTitle || movie.title} for ₹${state.currentBid}."`);
      handleTeesko("P2");
    }
  }, 480);
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================
function renderHeroSelector() {
  const container = document.getElementById("star-pills-container");
  if (!container) return;
  container.innerHTML = "";

  state.stars.forEach((star) => {
    const btn = document.createElement("button");
    btn.className = `hero-pill ${star.id === state.activeStarId ? "active" : ""}`;
    const avatarSrc = star.avatarPoster || makeSvgPoster(star.name, "", star.moniker);
    btn.innerHTML = `
      <img class="hero-pill-avatar" src="${avatarSrc}" alt="${star.name}" onerror="this.src='${makeSvgPoster(star.name)}'" />
      <span>${star.name}</span>
    `;
    btn.addEventListener("click", () => {
      if (state.isMultiplayer && state.myRole !== "P1") {
        showToast("Only room host (Player 1) can change the draft hero.");
        return;
      }
      state.activeStarId = star.id;
      startNewDraft(true);
    });
    container.appendChild(btn);
  });
}

function calculatePlayerMetrics(player) {
  if (player.slots.length === 0) {
    return { avgImdb: "—", score: 0 };
  }
  const sumImdb = player.slots.reduce((acc, s) => acc + (s.movie.imdb || 7.5), 0);
  const avgImdb = (sumImdb / player.slots.length).toFixed(1);
  const basePoints = player.slots.reduce(
    (acc, s) => acc + Math.round((s.movie.imdb || 7.5) * 2 + (s.movie.baseValue || 5)),
    0
  );
  return {
    avgImdb: `★ ${avgImdb}`,
    score: basePoints + player.budget,
  };
}

function renderPlayerBoards() {
  const renderSide = (player, prefix, playerKey) => {
    const budgetVal = document.getElementById(`${prefix}-budget-val`);
    const budgetBox = document.getElementById(`${prefix}-budget-box`);
    const budgetBar = document.getElementById(`${prefix}-budget-bar`);
    const slotsList = document.getElementById(`${prefix}-slots-list`);
    const nameInput = document.getElementById(`input-${prefix}-name`);

    if (nameInput) {
      nameInput.value = player.name;
      if (state.isMultiplayer) {
        nameInput.disabled = state.myRole !== playerKey;
      } else {
        nameInput.disabled = false;
      }
    }

    if (budgetVal) budgetVal.textContent = `₹${player.budget}`;
    if (budgetBox) budgetBox.classList.toggle("budget-zero", player.budget === 0);
    if (budgetBar) {
      const pct = Math.max(0, Math.min(100, (player.budget / GAME_CONFIG.defaultBudget) * 100));
      budgetBar.style.width = `${pct}%`;
    }

    if (slotsList) {
      slotsList.innerHTML = "";
      for (let i = 0; i < GAME_CONFIG.slotsPerPlayer; i++) {
        const entry = player.slots[i];
        const li = document.createElement("li");
        if (entry) {
          const fallback = entry.movie.fallbackPoster || makeSvgPoster(entry.movie.title, entry.movie.year);
          li.className = "draft-slot filled-slot";
          li.innerHTML = `
            <span class="slot-num">${i + 1}.</span>
            <img class="slot-thumb" src="${entry.movie.poster}" alt="${entry.movie.title}" onerror="this.onerror=null;this.src='${fallback}'" />
            <div class="slot-details">
              <div class="slot-movie-title">${entry.movie.shortTitle || entry.movie.title}</div>
              <div class="slot-movie-sub">${entry.movie.year} · ★ ${entry.movie.imdb || "7.8"}</div>
            </div>
            <span class="slot-price-tag">${entry.price > 0 ? `₹${entry.price}` : "FREE"}</span>
          `;
        } else {
          li.className = "draft-slot empty-slot";
          li.innerHTML = `
            <span class="slot-num">${i + 1}.</span>
            <span class="slot-empty-label">Slot ${i + 1}</span>
          `;
        }
        slotsList.appendChild(li);
      }
    }
  };

  renderSide(state.p1, "p1", "P1");
  renderSide(state.p2, "p2", "P2");

  // Update Mobile HUD
  const mP1Name = document.getElementById("m-hud-p1-name");
  const mP1Budget = document.getElementById("m-hud-p1-budget");
  const mP1Slots = document.getElementById("m-hud-p1-slots");
  const mP2Name = document.getElementById("m-hud-p2-name");
  const mP2Budget = document.getElementById("m-hud-p2-budget");
  const mP2Slots = document.getElementById("m-hud-p2-slots");

  if (mP1Name) mP1Name.textContent = state.p1.name.slice(0, 8);
  if (mP1Budget) mP1Budget.textContent = `₹${state.p1.budget}`;
  if (mP1Slots) mP1Slots.textContent = `${state.p1.slots.length}/5`;

  if (mP2Name) mP2Name.textContent = state.p2.name.slice(0, 8);
  if (mP2Budget) mP2Budget.textContent = `₹${state.p2.budget}`;
  if (mP2Slots) mP2Slots.textContent = `${state.p2.slots.length}/5`;
}

function renderCenterStage() {
  const star = getActiveStar();
  const titleEl = document.getElementById("arena-star-title");
  if (titleEl) titleEl.textContent = `${star.name}'s Movies Draft`;

  const spotlightStage = document.getElementById("spotlight-stage");
  const completePanel = document.getElementById("draft-complete-panel");

  if (state.draftFinished) {
    spotlightStage?.classList.add("hidden");
    completePanel?.classList.remove("hidden");
    renderShowdownPanel();
    return;
  }

  spotlightStage?.classList.remove("hidden");
  completePanel?.classList.add("hidden");

  const movie = getCurrentMovie();
  if (!movie) return;

  document.getElementById("round-counter-pill").textContent = `FILM ${state.currentIndex + 1} / ${state.pool.length}`;
  const turnStatus = document.getElementById("turn-status-pill");
  if (turnStatus) {
    if (state.highBidder === null) {
      turnStatus.textContent = "Opening Bid: ₹1";
    } else {
      const leaderName = state.highBidder === "P1" ? state.p1.name : state.p2.name;
      turnStatus.textContent = `High Bid: ₹${state.currentBid} (${leaderName})`;
    }
  }

  const posterImg = document.getElementById("current-movie-poster");
  const fallback = movie.fallbackPoster || makeSvgPoster(movie.title, movie.year, star.name);
  if (posterImg) {
    posterImg.onerror = () => {
      posterImg.onerror = null;
      posterImg.src = fallback;
    };
    posterImg.src = movie.poster;
  }

  const liveWho = document.getElementById("live-bid-who");
  const liveAmt = document.getElementById("live-bid-amount");
  if (liveWho && liveAmt) {
    liveWho.textContent = state.highBidder ? `${state.highBidder} LEADS` : "OPENING BID";
    liveAmt.textContent = state.highBidder ? `₹${state.currentBid}` : "₹1";
  }

  document.getElementById("current-movie-year").textContent = movie.year;
  document.getElementById("current-movie-verdict").textContent = movie.verdict || "Blockbuster";
  document.getElementById("current-movie-imdb").textContent = `★ ${movie.imdb || "7.8"}`;
  document.getElementById("current-movie-title").textContent = movie.title;
  document.getElementById("current-movie-character").innerHTML =
    `Role: <strong>${movie.character || "Lead"}</strong> · Dir: <strong>${movie.director || "—"}</strong> · Music: <strong>${movie.music || "—"}</strong>`;

  const genresRow = document.getElementById("current-movie-genres");
  if (genresRow) {
    genresRow.innerHTML = (movie.genre || []).map((g) => `<span class="genre-tag">${g}</span>`).join("");
  }

  document.getElementById("current-movie-tagline").textContent = movie.tagline || "";

  const nextBidAmt = state.highBidder === null ? 1 : state.currentBid + 1;
  const p1CanBid = state.p1.slots.length < 5 && state.p1.budget >= nextBidAmt && state.highBidder !== "P1";
  const p2CanBid = state.p2.slots.length < 5 && state.p2.budget >= nextBidAmt && state.highBidder !== "P2";

  document.getElementById("paddle-p1-name").textContent = state.p1.name;
  document.getElementById("paddle-p1-max").textContent = `₹${state.p1.budget} left`;
  document.getElementById("paddle-p2-name").textContent = state.p2.name;
  document.getElementById("paddle-p2-max").textContent = `₹${state.p2.budget} left`;

  document.getElementById("paddle-p1").classList.toggle("leading-bidder", state.highBidder === "P1");
  document.getElementById("paddle-p2").classList.toggle("leading-bidder", state.highBidder === "P2");

  document.getElementById("p1-next-bid-label").textContent = `₹${nextBidAmt}`;
  document.getElementById("p2-next-bid-label").textContent = `₹${nextBidAmt}`;

  const allowP1 = !state.isMultiplayer || state.myRole === "P1";
  const allowP2 = !state.isMultiplayer || state.myRole === "P2";

  document.getElementById("btn-p1-bid-next").disabled = !allowP1 || !p1CanBid;
  document.getElementById("btn-p1-bid-plus2").disabled =
    !allowP1 ||
    !(
      state.p1.slots.length < 5 &&
      state.p1.budget >= state.currentBid + 2 &&
      state.highBidder !== "P1"
    );
  document.getElementById("btn-p1-teesko").disabled =
    !allowP1 || !(state.highBidder === "P2" && state.p2.slots.length < 5);

  document.getElementById("btn-p2-bid-next").disabled = !allowP2 || !p2CanBid;
  document.getElementById("btn-p2-bid-plus2").disabled =
    !allowP2 ||
    !(
      state.p2.slots.length < 5 &&
      state.p2.budget >= state.currentBid + 2 &&
      state.highBidder !== "P2"
    );
  document.getElementById("btn-p2-teesko").disabled =
    !allowP2 || !(state.highBidder === "P1" && state.p1.slots.length < 5);

  const chipsFlow = document.getElementById("bid-chips-flow");
  if (chipsFlow) {
    if (state.bidHistory.length === 0) {
      chipsFlow.innerHTML = `<span class="empty-trail">Start at ₹1</span>`;
    } else {
      chipsFlow.innerHTML = state.bidHistory
        .map((b) => `<span class="bid-chip">${b.player}: ₹${b.amount}</span>`)
        .join("");
      chipsFlow.scrollTop = chipsFlow.scrollHeight;
    }
  }

  // Special Rule Banner
  const specialBanner = document.getElementById("special-rule-banner");
  const specialText = document.getElementById("special-rule-text");
  const specialActions = document.getElementById("special-rule-actions");

  if (specialBanner && specialText && specialActions) {
    specialActions.innerHTML = "";
    const p1Full = state.p1.slots.length >= 5;
    const p2Full = state.p2.slots.length >= 5;

    if (p1Full && !p2Full) {
      specialBanner.classList.remove("hidden");
      specialText.textContent = `${state.p1.name}'s 5 slots are full — ${state.p2.name} gets ${movie.shortTitle || movie.title} for ₹0.`;
      if (allowP2) {
        const btn = document.createElement("button");
        btn.className = "nf-btn-red";
        btn.textContent = `Claim for ${state.p2.name} (₹0)`;
        btn.onclick = () => awardCurrentMovie("P2", 0, true);
        specialActions.appendChild(btn);
      }
    } else if (p2Full && !p1Full) {
      specialBanner.classList.remove("hidden");
      specialText.textContent = `${state.p2.name}'s 5 slots are full — ${state.p1.name} gets ${movie.shortTitle || movie.title} for ₹0.`;
      if (allowP1) {
        const btn = document.createElement("button");
        btn.className = "nf-btn-red";
        btn.textContent = `Claim for ${state.p1.name} (₹0)`;
        btn.onclick = () => awardCurrentMovie("P1", 0, true);
        specialActions.appendChild(btn);
      }
    } else if (state.p2.budget === 0 && !p1Full) {
      specialBanner.classList.remove("hidden");
      specialText.textContent = `${state.p2.name} has ₹0 budget left. ${state.p1.name} can claim this film:`;
      if (allowP1) {
        if (state.p1.budget >= 1) {
          const b1 = document.createElement("button");
          b1.className = "nf-btn-red";
          b1.textContent = `Claim for ₹1`;
          b1.onclick = () => awardCurrentMovie("P1", 1, true);
          specialActions.appendChild(b1);
        }
        const b0 = document.createElement("button");
        b0.className = "nf-btn-ghost";
        b0.textContent = `Claim Free (₹0)`;
        b0.onclick = () => awardCurrentMovie("P1", 0, true);
        specialActions.appendChild(b0);
      }
    } else if (state.p1.budget === 0 && !p2Full) {
      specialBanner.classList.remove("hidden");
      specialText.textContent = `${state.p1.name} has ₹0 budget left. ${state.p2.name} can claim this film:`;
      if (allowP2) {
        if (state.p2.budget >= 1) {
          const b1 = document.createElement("button");
          b1.className = "nf-btn-red";
          b1.textContent = `Claim for ₹1`;
          b1.onclick = () => awardCurrentMovie("P2", 1, true);
          specialActions.appendChild(b1);
        }
        const b0 = document.createElement("button");
        b0.className = "nf-btn-ghost";
        b0.textContent = `Claim Free (₹0)`;
        b0.onclick = () => awardCurrentMovie("P2", 0, true);
        specialActions.appendChild(b0);
      }
    } else {
      specialBanner.classList.add("hidden");
    }
  }

  updateMultiplayerBadge();
}

function renderShowdownPanel() {
  const star = getActiveStar();
  document.getElementById("showdown-headline").textContent = `${star.name}'s Movies Draft — Final Lineups`;

  const m1 = calculatePlayerMetrics(state.p1);
  const m2 = calculatePlayerMetrics(state.p2);

  document.getElementById("poll-p1-title").textContent = state.p1.name;
  document.getElementById("poll-p1-score").textContent = `${m1.score} PTS`;
  document.getElementById("poll-p1-metrics").innerHTML = `
    <div><strong>Films:</strong> ${state.p1.slots.map((s) => s.movie.shortTitle || s.movie.title).join(", ")}</div>
    <div><strong>Avg IMDb:</strong> ${m1.avgImdb} · <strong>Budget Left:</strong> ₹${state.p1.budget}</div>
  `;

  document.getElementById("poll-p2-title").textContent = state.p2.name;
  document.getElementById("poll-p2-score").textContent = `${m2.score} PTS`;
  document.getElementById("poll-p2-metrics").innerHTML = `
    <div><strong>Films:</strong> ${state.p2.slots.map((s) => s.movie.shortTitle || s.movie.title).join(", ")}</div>
    <div><strong>Avg IMDb:</strong> ${m2.avgImdb} · <strong>Budget Left:</strong> ₹${state.p2.budget}</div>
  `;

  const totalVotes = state.p1.votes + state.p2.votes;
  const p1Pct = Math.round((state.p1.votes / totalVotes) * 100);
  const p2Pct = 100 - p1Pct;
  document.getElementById("votes-p1-count").textContent = `${p1Pct}%`;
  document.getElementById("votes-p2-count").textContent = `${p2Pct}%`;
}

function renderAll() {
  renderHeroSelector();
  renderPlayerBoards();
  renderCenterStage();
}

// ============================================================================
// MULTIPLAYER MODAL UI
// ============================================================================
function openMpModal(defaultTab = "create") {
  const backdrop = document.getElementById("mp-modal-backdrop");
  if (!backdrop) return;
  backdrop.classList.remove("hidden");

  if (state.isMultiplayer) {
    showModalPanel("active");
    const activeCode = document.getElementById("modal-active-room-code");
    if (activeCode) activeCode.textContent = state.roomCode;
    const p1Roster = document.getElementById("roster-p1-name");
    const p2Roster = document.getElementById("roster-p2-name");
    if (p1Roster) p1Roster.textContent = `${state.p1.name} ${state.myRole === "P1" ? "(You)" : ""}`;
    if (p2Roster) {
      const p2Connected = state.roomPlayers.p2 && state.roomPlayers.p2.connected;
      p2Roster.textContent = p2Connected ? `${state.p2.name} ${state.myRole === "P2" ? "(You)" : ""}` : "Waiting to join...";
    }
  } else {
    showModalPanel(defaultTab);
  }
}

function closeMpModal() {
  const backdrop = document.getElementById("mp-modal-backdrop");
  if (backdrop) backdrop.classList.add("hidden");
}

function showModalPanel(tabKey) {
  const tabs = document.getElementById("mp-modal-tabs");
  const panelCreate = document.getElementById("mp-panel-create");
  const panelJoin = document.getElementById("mp-panel-join");
  const panelActive = document.getElementById("mp-panel-active");
  const tabCreate = document.getElementById("tab-mp-create");
  const tabJoin = document.getElementById("tab-mp-join");

  if (tabKey === "active") {
    tabs?.classList.add("hidden");
    panelCreate?.classList.add("hidden");
    panelJoin?.classList.add("hidden");
    panelActive?.classList.remove("hidden");
    return;
  }

  tabs?.classList.remove("hidden");
  panelActive?.classList.add("hidden");

  if (tabKey === "create") {
    tabCreate?.classList.add("active");
    tabJoin?.classList.remove("active");
    panelCreate?.classList.remove("hidden");
    panelJoin?.classList.add("hidden");
  } else {
    tabJoin?.classList.add("active");
    tabCreate?.classList.remove("active");
    panelJoin?.classList.remove("hidden");
    panelCreate?.classList.add("hidden");
  }
}

function copyRoomLink() {
  const url = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
  navigator.clipboard?.writeText(url).then(() => {
    showToast(`🔗 Invite link copied: ${url}`);
  }).catch(() => {
    showToast(`Room Code: ${state.roomCode}`);
  });
}

function leaveRoom() {
  if (state.isMultiplayer) {
    sendMultiplayerMessage({ type: "LEAVE_ROOM" });
  }
  if (peerInstance) {
    try { peerInstance.destroy(); } catch {}
  }
  state.isMultiplayer = false;
  state.roomCode = null;
  state.myRole = null;
  state.opponentMode = "2p";

  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, "", cleanUrl);

  closeMpModal();
  updateMultiplayerBadge();
  startNewDraft(false);
  showToast("Left room. Back in Local 2-Player mode.");
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================
function initEvents() {
  document.getElementById("btn-sound-toggle")?.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    document.getElementById("sound-icon").textContent = state.soundEnabled ? "🔊" : "🔇";
  });

  document.getElementById("select-deck-order")?.addEventListener("change", (e) => {
    state.deckMode = e.target.value;
    startNewDraft(true);
  });

  document.getElementById("mode-2p")?.addEventListener("click", () => {
    if (state.isMultiplayer) {
      showToast("Currently in Online Room. Leave room to switch to local mode.");
      return;
    }
    state.opponentMode = "2p";
    document.getElementById("mode-2p").classList.add("active");
    document.getElementById("mode-ai").classList.remove("active");
    document.getElementById("input-p2-name").value = "Player 2";
    startNewDraft(false);
  });

  document.getElementById("mode-ai")?.addEventListener("click", () => {
    if (state.isMultiplayer) {
      showToast("Currently in Online Room. Leave room to switch to vs AI.");
      return;
    }
    state.opponentMode = "ai";
    document.getElementById("mode-ai").classList.add("active");
    document.getElementById("mode-2p").classList.remove("active");
    document.getElementById("input-p2-name").value = "AI Opponent";
    startNewDraft(false);
  });

  document.getElementById("btn-reset-draft")?.addEventListener("click", () => startNewDraft(true));
  document.getElementById("btn-play-again")?.addEventListener("click", () => startNewDraft(true));

  document.getElementById("input-p1-name")?.addEventListener("input", (e) => {
    state.p1.name = e.target.value || "Player 1";
    renderCenterStage();
  });
  document.getElementById("input-p2-name")?.addEventListener("input", (e) => {
    state.p2.name = e.target.value || "Player 2";
    renderCenterStage();
  });

  document.getElementById("btn-p1-bid-next")?.addEventListener("click", () => placeBid("P1"));
  document.getElementById("btn-p1-bid-plus2")?.addEventListener("click", () => placeBid("P1", state.currentBid + 2));
  document.getElementById("btn-p1-teesko")?.addEventListener("click", () => handleTeesko("P1"));

  document.getElementById("btn-p2-bid-next")?.addEventListener("click", () => placeBid("P2"));
  document.getElementById("btn-p2-bid-plus2")?.addEventListener("click", () => placeBid("P2", state.currentBid + 2));
  document.getElementById("btn-p2-teesko")?.addEventListener("click", () => handleTeesko("P2"));

  document.getElementById("btn-skip-movie")?.addEventListener("click", () => {
    advanceToNextMovie(true);
  });

  // Reaction Bar
  document.querySelectorAll(".btn-react").forEach((btn) => {
    btn.addEventListener("click", () => {
      const emoji = btn.getAttribute("data-emoji");
      if (!emoji) return;
      triggerFloatingReaction(emoji);
      if (state.isMultiplayer && state.roomCode) {
        sendMultiplayerMessage({
          type: "REACTION",
          roomCode: state.roomCode,
          emoji,
        });
      }
    });
  });

  // Multiplayer Modal Triggers
  document.getElementById("btn-mp-toggle")?.addEventListener("click", () => openMpModal("create"));
  document.getElementById("btn-close-mp-modal")?.addEventListener("click", closeMpModal);
  document.getElementById("mp-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "mp-modal-backdrop") closeMpModal();
  });

  document.getElementById("tab-mp-create")?.addEventListener("click", () => showModalPanel("create"));
  document.getElementById("tab-mp-join")?.addEventListener("click", () => showModalPanel("join"));

  document.getElementById("btn-copy-room-link")?.addEventListener("click", copyRoomLink);
  document.getElementById("btn-copy-invite-action")?.addEventListener("click", copyRoomLink);
  document.getElementById("btn-modal-copy-link")?.addEventListener("click", copyRoomLink);

  document.getElementById("btn-leave-room-strip")?.addEventListener("click", leaveRoom);
  document.getElementById("btn-modal-leave-room")?.addEventListener("click", leaveRoom);

  // Submit Create Room
  document.getElementById("btn-submit-create-room")?.addEventListener("click", () => {
    const name = document.getElementById("input-create-name")?.value?.trim() || "Player 1";
    const starId = document.getElementById("select-create-star")?.value || "nani";
    const deckMode = document.getElementById("select-create-deck")?.value || "video-exact";
    const roomCode = generateRoomCode();

    state.myName = name;
    state.activeStarId = starId;
    state.deckMode = deckMode;

    if (isVercelOrStatic()) {
      initPeerJsHost(roomCode, name, starId, deckMode);
    } else {
      connectWebSocket(() => {
        if (state.transportType === "ws" && wsSocket && wsSocket.readyState === WebSocket.OPEN) {
          sendMultiplayerMessage({
            type: "CREATE_ROOM",
            roomCode,
            name,
            activeStarId: starId,
            deckMode,
          });
        } else {
          initPeerJsHost(roomCode, name, starId, deckMode);
        }
      });
    }
  });

  // Submit Join Room
  document.getElementById("btn-submit-join-room")?.addEventListener("click", () => {
    const code = document.getElementById("input-join-code")?.value?.trim().toUpperCase();
    const name = document.getElementById("input-join-name")?.value?.trim() || "Player 2";

    if (!code) {
      showToast("Please enter a room code.");
      return;
    }

    state.myName = name;

    if (isVercelOrStatic()) {
      initPeerJsJoin(code, name);
    } else {
      connectWebSocket(() => {
        if (state.transportType === "ws" && wsSocket && wsSocket.readyState === WebSocket.OPEN) {
          sendMultiplayerMessage({
            type: "JOIN_ROOM",
            roomCode: code,
            name,
          });
        } else {
          initPeerJsJoin(code, name);
        }
      });
    }
  });

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "a") placeBid("P1");
    else if (key === "s" && state.highBidder === "P2") handleTeesko("P1");
    else if (key === "k") placeBid("P2");
    else if (key === "l" && state.highBidder === "P1") handleTeesko("P2");
  });

  // Final Showdown Voting
  document.getElementById("btn-vote-p1")?.addEventListener("click", () => {
    state.p1.votes += 1;
    renderShowdownPanel();
    if (state.isMultiplayer && state.roomCode) {
      sendMultiplayerMessage({
        type: "SYNC_ACTION",
        roomCode: state.roomCode,
        action: "VOTE",
        payload: { target: "P1" },
      });
    }
  });

  document.getElementById("btn-vote-p2")?.addEventListener("click", () => {
    state.p2.votes += 1;
    renderShowdownPanel();
    if (state.isMultiplayer && state.roomCode) {
      sendMultiplayerMessage({
        type: "SYNC_ACTION",
        roomCode: state.roomCode,
        action: "VOTE",
        payload: { target: "P2" },
      });
    }
  });

  document.getElementById("btn-copy-summary")?.addEventListener("click", () => {
    const star = getActiveStar();
    const p1List = state.p1.slots.map((s, i) => `${i + 1}. ${s.movie.title} (₹${s.price})`).join("\n");
    const p2List = state.p2.slots.map((s, i) => `${i + 1}. ${s.movie.title} (₹${s.price})`).join("\n");
    const text = `🎬 ${star.name}'s Movies Draft (₹20 Budget)\n\n${state.p1.name} (₹${state.p1.budget} left):\n${p1List}\n\n${state.p2.name} (₹${state.p2.budget} left):\n${p2List}\n\nWho won this draft?`;
    navigator.clipboard?.writeText(text);
    showToast("Copied draft summary to clipboard!");
  });
}

function checkUrlParamsForRoom() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get("room");
  if (roomCode) {
    const joinCodeInput = document.getElementById("input-join-code");
    if (joinCodeInput) joinCodeInput.value = roomCode.toUpperCase();
    openMpModal("join");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initEvents();
  startNewDraft(false);
  checkUrlParamsForRoom();
});
