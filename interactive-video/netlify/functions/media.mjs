import { blobGetBytes, blobKey } from "../lib/blob-store.mjs";

const MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function sanitizeProjectId(id) {
  const s = String(id || "").trim();
  return /^[a-zA-Z0-9_-]+$/.test(s) ? s : null;
}

export default async (req) => {
  const url = new URL(req.url);
  const projectId = sanitizeProjectId(url.searchParams.get("project"));
  let path = url.searchParams.get("path") || "";
  path = path.replace(/^\/+/, "").replace(/\.\./g, "");
  if (!projectId || !path) {
    return new Response("Bad Request", { status: 400 });
  }

  const key = blobKey(projectId, path);
  const buf = await blobGetBytes(key);
  if (!buf) return new Response("Not Found", { status: 404 });

  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const total = buf.byteLength;
  const range = req.headers.get("range");

  if (range && /^bytes=/.test(range)) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (start < total && end < total) {
        const slice = buf.slice(start, end + 1);
        return new Response(slice, {
          status: 206,
          headers: {
            "Content-Type": type,
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(slice.byteLength),
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }
  }

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
