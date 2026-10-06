import { createHmac, timingSafeEqual } from "node:crypto";
import { handleUpload } from "@vercel/blob/client";
import { isAdmin, json, MEDIA_TYPES, storageReady } from "./_ads.js";

function validTicket(ticket) {
  const [time, signature] = String(ticket || "").split(".");
  if (!/^\d{13}$/.test(time) || !/^[a-f0-9]{64}$/.test(signature || "") ||
      Math.abs(Date.now() - Number(time)) > 5 * 60_000) return false;
  const expected = createHmac("sha256", process.env.AD_ADMIN_PASSWORD).update(time).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function GET(request) {
  if (!isAdmin(request)) return json({ error: "Unauthorized" }, 401);
  if (!storageReady()) return json({ error: "Connect a public Vercel Blob store" }, 503);
  const time = String(Date.now());
  const signature = createHmac("sha256", process.env.AD_ADMIN_PASSWORD).update(time).digest("hex");
  return json({ uploadUrl: `/api/ad-upload?ticket=${time}.${signature}` });
}

export async function POST(request) {
  if (!storageReady()) return json({ error: "Connect a public Vercel Blob store" }, 503);
  try {
    const body = await request.json();
    const result = await handleUpload({
      request, body,
      onBeforeGenerateToken: async (pathname) => {
        if (!validTicket(new URL(request.url).searchParams.get("ticket"))) throw new Error("Upload authorization expired");
        if (!/^ads\/media\/[a-zA-Z0-9-]+\.(png|jpe?g|webp|gif|mp4)$/.test(pathname)) throw new Error("Invalid media name");
        return {
          allowedContentTypes: MEDIA_TYPES,
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: true,
          validUntil: Date.now() + 5 * 60_000,
        };
      },
      onUploadCompleted: async () => {},
    });
    return json(result);
  } catch (error) {
    return json({ error: error.message || "Upload failed" }, 400);
  }
}
