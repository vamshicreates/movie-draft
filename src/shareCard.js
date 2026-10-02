const WIDTH = 1080;
const HEIGHT = 1350;
const RED = "#E50914";
const WHITE = "#FFFFFF";
const MUTED = "#B8B8B8";
const FONT = '"Plus Jakarta Sans", Arial, sans-serif';

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fitText(ctx, value, x, y, maxWidth) {
  let text = String(value || "");
  while (text.length > 1 && ctx.measureText(text).width > maxWidth) {
    text = text.slice(0, -1);
  }
  if (text !== value) text = `${text.trimEnd()}…`;
  ctx.fillText(text, x, y);
}

function loadPoster(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawPoster(ctx, image, x, y, width, height) {
  ctx.save();
  roundedRect(ctx, x, y, width, height, 9);
  ctx.clip();
  ctx.fillStyle = "#303030";
  ctx.fillRect(x, y, width, height);

  if (image) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  ctx.restore();
}

function drawLineup(ctx, player, images, label, x) {
  const y = 270;
  const width = 478;
  ctx.fillStyle = "#1B1B1B";
  roundedRect(ctx, x, y, width, 895, 20);
  ctx.fill();
  ctx.strokeStyle = "#383838";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = RED;
  roundedRect(ctx, x + 26, y + 25, 62, 40, 8);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = `800 25px ${FONT}`;
  ctx.fillText(label, x + 38, y + 53);

  ctx.font = `800 37px ${FONT}`;
  fitText(ctx, player.name, x + 105, y + 55, width - 137);
  ctx.fillStyle = MUTED;
  ctx.font = `600 21px ${FONT}`;
  ctx.fillText(`₹${player.budget} left from ₹20`, x + 28, y + 97);

  for (let index = 0; index < 5; index += 1) {
    const rowY = y + 130 + index * 135;
    const slot = player.slots[index];

    ctx.fillStyle = index % 2 === 0 ? "#242424" : "#202020";
    roundedRect(ctx, x + 22, rowY, width - 44, 119, 12);
    ctx.fill();

    ctx.fillStyle = "#888888";
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`${index + 1}.`, x + 39, rowY + 69);

    drawPoster(ctx, images[index], x + 76, rowY + 9, 72, 101);
    ctx.fillStyle = WHITE;
    ctx.font = `800 25px ${FONT}`;
    fitText(ctx, slot?.movie?.shortTitle || slot?.movie?.title || "Open slot", x + 166, rowY + 51, width - 203);
    if (slot) {
      ctx.fillStyle = MUTED;
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText(`Won for ₹${slot.price}`, x + 166, rowY + 84);
    }
  }
}

export async function createResultCard(starName, p1, p2) {
  if (document.fonts?.ready) await document.fonts.ready;
  const posters = await Promise.all(
    [p1, p2].map((player) => Promise.all(player.slots.slice(0, 5).map((slot) => loadPoster(slot.movie.poster))))
  );

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, WIDTH, 14);

  ctx.fillStyle = RED;
  roundedRect(ctx, 50, 54, 58, 58, 10);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = `800 37px ${FONT}`;
  ctx.fillText("M", 64, 96);
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText("MOVIE DRAFT", 130, 96);

  ctx.fillStyle = WHITE;
  ctx.font = `800 57px ${FONT}`;
  ctx.fillText("Who drafted better?", 50, 188);
  ctx.fillStyle = MUTED;
  ctx.font = `600 27px ${FONT}`;
  fitText(ctx, `${starName} movies · ₹20 budget · 5 picks each`, 52, 229, 975);

  drawLineup(ctx, p1, posters[0], "P1", 50);
  drawLineup(ctx, p2, posters[1], "P2", 552);

  ctx.fillStyle = RED;
  roundedRect(ctx, 50, 1198, 980, 101, 16);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.textAlign = "center";
  ctx.font = `800 37px ${FONT}`;
  ctx.fillText("COMMENT P1 OR P2", WIDTH / 2, 1263);
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText("movie-draft-phi.vercel.app", 50, 1331);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create result image")), "image/png");
  });
}

// A portrait image that stays legible when a room has three to five lineups.
export async function createPartyResultCard(starName, players) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  const posters = await Promise.all(players.map((player) =>
    Promise.all(player.slots.map((slot) => loadPoster(slot.movie.poster)))
  ));
  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, 1080, 16);
  ctx.fillStyle = WHITE;
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText("MOVIE DRAFT", 54, 102);
  ctx.font = `800 49px ${FONT}`;
  ctx.fillText("Who drafted better?", 54, 173);
  ctx.fillStyle = MUTED;
  ctx.font = `600 26px ${FONT}`;
  fitText(ctx, `${starName} · ₹20 each · 5 films each`, 56, 216, 970);

  const cols = 2;
  const cardW = 476;
  const cardH = players.length <= 2 ? 1260 : 490;
  const gapX = 20;
  const gapY = 24;
  for (let i = 0; i < players.length; i += 1) {
    const player = players[i];
    const x = 54 + (i % cols) * (cardW + gapX);
    const y = 258 + Math.floor(i / cols) * (cardH + gapY);
    ctx.fillStyle = "#1d1d1d";
    roundedRect(ctx, x, y, cardW, cardH, 20);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = RED;
    roundedRect(ctx, x + 18, y + 17, 66, 38, 8);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(`P${i + 1}`, x + 33, y + 44);
    ctx.font = `800 26px ${FONT}`;
    fitText(ctx, player.name, x + 100, y + 44, cardW - 120);
    ctx.fillStyle = MUTED;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText(`₹${player.budget} remaining`, x + 20, y + 82);
    const rowH = players.length <= 2 ? 185 : 78;
    for (let j = 0; j < 5; j += 1) {
      const slot = player.slots[j];
      const rowY = y + 104 + j * rowH;
      const imgW = players.length <= 2 ? 91 : 48;
      const imgH = players.length <= 2 ? 135 : 66;
      drawPoster(ctx, posters[i]?.[j], x + 18, rowY, imgW, imgH);
      ctx.fillStyle = WHITE;
      ctx.font = `800 ${players.length <= 2 ? 25 : 20}px ${FONT}`;
      fitText(ctx, slot?.movie?.shortTitle || slot?.movie?.title || "Open slot", x + imgW + 30, rowY + (players.length <= 2 ? 55 : 29), cardW - imgW - 51);
      ctx.fillStyle = MUTED;
      ctx.font = `600 ${players.length <= 2 ? 19 : 16}px ${FONT}`;
      if (slot) ctx.fillText(`₹${slot.price}`, x + imgW + 30, rowY + (players.length <= 2 ? 86 : 53));
    }
  }
  ctx.fillStyle = RED;
  roundedRect(ctx, 54, 1800, 972, 80, 14);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.textAlign = "center";
  ctx.font = `800 31px ${FONT}`;
  ctx.fillText(`COMMENT ${players.map((_, i) => `P${i + 1}`).join(" / ")}`, 540, 1852);
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("movie-draft-phi.vercel.app", 54, 1907);
  return new Promise((resolve, reject) => canvas.toBlob((blob) =>
    blob ? resolve(blob) : reject(new Error("Could not create result image")), "image/png"));
}
