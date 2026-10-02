import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3040;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let relPath = urlPath === "/" ? "/index.html" : urlPath;

  // Try root path first, then fallback to /public
  let filePath = path.join(__dirname, relPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const pubPath = path.join(__dirname, "public", relPath);
    if (fs.existsSync(pubPath) && !fs.statSync(pubPath).isDirectory()) {
      filePath = pubPath;
    }
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  // Support HTTP Range requests for MP4 video seeking
  if (req.headers.range && ext === ".mp4") {
    const parts = req.headers.range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": contentType,
    });
    file.pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
  });
  fs.createReadStream(filePath).pipe(res);
});

// ============================================================================
// MULTIPLAYER ROOMS & WEBSOCKET ENGINE
// ============================================================================
const wss = new WebSocketServer({ server });
const rooms = new Map();

function generateRoomCode() {
  const words = ["NANI", "PUSH", "RRR", "KGF", "MASS", "HERO", "STAR", "CHIRU", "MAHESH", "PRABHAS", "NTR", "CHARAN"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${word}${num}`;
}

function broadcastToRoom(roomCode, message, excludeWs = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const payload = typeof message === "string" ? message : JSON.stringify(message);
  for (const client of room.clients) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function getRoomPublicState(room) {
  return {
    code: room.code,
    activeStarId: room.activeStarId,
    deckMode: room.deckMode,
    gameState: room.gameState,
    p1: {
      name: room.p1?.name || "Player 1",
      connected: !!(room.p1 && room.p1.ws.readyState === WebSocket.OPEN),
    },
    p2: {
      name: room.p2?.name || "Player 2",
      connected: !!(room.p2 && room.p2.ws.readyState === WebSocket.OPEN),
    },
    spectatorCount: Math.max(0, room.clients.length - (room.p1 ? 1 : 0) - (room.p2 ? 1 : 0)),
  };
}

wss.on("connection", (ws) => {
  let clientMeta = {
    roomCode: null,
    role: null, // "P1" | "P2" | "SPECTATOR"
    name: "Anonymous",
  };

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type } = data;

      if (type === "CREATE_ROOM") {
        const roomCode = (data.roomCode || generateRoomCode()).toUpperCase().trim();
        const playerName = data.name?.trim() || "Player 1";
        const activeStarId = data.activeStarId || "nani";
        const deckMode = data.deckMode || "video-exact";

        const room = {
          code: roomCode,
          activeStarId,
          deckMode,
          p1: { name: playerName, ws },
          p2: null,
          clients: [{ ws, role: "P1", name: playerName }],
          gameState: data.initialState || null,
          createdAt: Date.now(),
        };

        rooms.set(roomCode, room);
        clientMeta = { roomCode, role: "P1", name: playerName };

        ws.send(
          JSON.stringify({
            type: "ROOM_CREATED",
            room: getRoomPublicState(room),
            assignedRole: "P1",
          })
        );
        return;
      }

      if (type === "JOIN_ROOM") {
        const roomCode = data.roomCode?.toUpperCase().trim();
        const playerName = data.name?.trim() || "Player 2";
        const room = rooms.get(roomCode);

        if (!room) {
          ws.send(JSON.stringify({ type: "ERROR", message: `Room "${roomCode}" does not exist.` }));
          return;
        }

        let assignedRole = "SPECTATOR";
        if (!room.p1 || room.p1.ws.readyState !== WebSocket.OPEN) {
          room.p1 = { name: playerName, ws };
          assignedRole = "P1";
        } else if (!room.p2 || room.p2.ws.readyState !== WebSocket.OPEN) {
          room.p2 = { name: playerName, ws };
          assignedRole = "P2";
        }

        room.clients.push({ ws, role: assignedRole, name: playerName });
        clientMeta = { roomCode, role: assignedRole, name: playerName };

        ws.send(
          JSON.stringify({
            type: "ROOM_JOINED",
            room: getRoomPublicState(room),
            assignedRole,
          })
        );

        broadcastToRoom(roomCode, {
          type: "PLAYER_JOINED",
          room: getRoomPublicState(room),
          newPlayer: { name: playerName, role: assignedRole },
        });
        return;
      }

      if (type === "SYNC_ACTION") {
        const { roomCode, action, payload } = data;
        const room = rooms.get(roomCode);
        if (!room) return;

        if (action === "STATE_UPDATE" && payload?.gameState) {
          room.gameState = payload.gameState;
        }

        // Broadcast action to all clients in room
        broadcastToRoom(roomCode, {
          type: "ACTION_EVENT",
          action,
          payload,
          senderRole: clientMeta.role,
          senderName: clientMeta.name,
        }, ws);
        return;
      }

      if (type === "REACTION") {
        const { roomCode, emoji } = data;
        broadcastToRoom(roomCode, {
          type: "REACTION_POP",
          emoji,
          senderRole: clientMeta.role,
          senderName: clientMeta.name,
        }, ws);
        return;
      }

      if (type === "LEAVE_ROOM") {
        handleDisconnect();
      }
    } catch (err) {
      console.error("WS Error:", err);
    }
  });

  function handleDisconnect() {
    const { roomCode, role } = clientMeta;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.clients = room.clients.filter((c) => c.ws !== ws);

    if (role === "P1" && room.p1?.ws === ws) {
      room.p1 = null;
    } else if (role === "P2" && room.p2?.ws === ws) {
      room.p2 = null;
    }

    if (room.clients.length === 0) {
      rooms.delete(roomCode);
    } else {
      broadcastToRoom(roomCode, {
        type: "PLAYER_LEFT",
        room: getRoomPublicState(room),
        leftRole: role,
        leftName: clientMeta.name,
      });
    }
  }

  ws.on("close", handleDisconnect);
  ws.on("error", handleDisconnect);
});

server.listen(PORT, () => {
  console.log(`🎬 Movie Draft & Auction running at http://localhost:${PORT}`);
});
