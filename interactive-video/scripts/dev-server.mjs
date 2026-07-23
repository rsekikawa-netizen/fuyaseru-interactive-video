#!/usr/bin/env node
/**
 * 静的ファイル配信 + scenario.json 保存 + 動画アップロード API
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream, mkdirSync } from "node:fs";
import { dirname, join, extname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = join(root, "videos");
const port = Number(process.env.PORT || 3000);
const scenarioPath = join(root, "scenario.json");
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), "application/json");
}

function sanitizeFilename(name, fallback = "upload.mp4") {
  const base = basename(String(name || fallback)).replace(/[^\w\u3000-\u9fff.\-()+ ]+/g, "_");
  const ext = extname(base).toLowerCase();
  const allowed = [".mp4", ".webm", ".mov"];
  if (!allowed.includes(ext)) return (base.replace(/\.[^.]+$/, "") || "upload") + ".mp4";
  return base || fallback;
}

async function readBody(req, limit = MAX_UPLOAD_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error(`ファイルが大きすぎます（上限 ${Math.round(limit / 1024 / 1024)}MB）`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, boundary) {
  const parts = [];
  const delim = Buffer.from("--" + boundary);
  let start = buffer.indexOf(delim);
  while (start !== -1) {
    const next = buffer.indexOf(delim, start + delim.length);
    if (next === -1) break;
    const slice = buffer.subarray(start + delim.length, next);
    const headerEnd = slice.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headers = slice.subarray(0, headerEnd).toString("utf8");
      const body = slice.subarray(headerEnd + 4);
      const trimmed = body.subarray(0, Math.max(0, body.length - 2));
      parts.push({
        name: /name="([^"]+)"/.exec(headers)?.[1] || "",
        filename: /filename="([^"]+)"/.exec(headers)?.[1] || "",
        data: trimmed,
      });
    }
    start = next;
  }
  return parts;
}

async function handleUpload(req, res, url) {
  mkdirSync(videosDir, { recursive: true });
  const nodeId = url.searchParams.get("nodeId") || "";
  let filename = url.searchParams.get("filename") || "";
  let data;

  const type = req.headers["content-type"] || "";
  if (type.startsWith("multipart/form-data")) {
    const boundary = /boundary=(.+)$/.exec(type)?.[1];
    if (!boundary) return json(res, 400, { ok: false, error: "multipart boundary が不正です" });
    const raw = await readBody(req);
    const filePart = parseMultipart(raw, boundary).find((p) => p.name === "file" && p.data.length);
    if (!filePart) return json(res, 400, { ok: false, error: "ファイルが見つかりません" });
    data = filePart.data;
    if (!filename) filename = filePart.filename;
  } else {
    data = await readBody(req);
    if (!filename) filename = req.headers["x-filename"] || "upload.mp4";
  }

  if (nodeId) {
    const ext = extname(sanitizeFilename(filename)).toLowerCase() || ".mp4";
    filename = sanitizeFilename(nodeId + ext, nodeId + ".mp4");
  } else {
    filename = sanitizeFilename(filename);
  }

  const outPath = resolve(videosDir, filename);
  if (!outPath.startsWith(resolve(videosDir))) {
    return json(res, 403, { ok: false, error: "保存先が不正です" });
  }

  writeFileSync(outPath, data);
  return json(res, 200, { ok: true, path: "videos/" + filename, filename, size: data.length });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = resolve(root, "." + urlPath);
  if (!filePath.startsWith(root)) return send(res, 403, "Forbidden");
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    const index = join(filePath, "index.html");
    if (existsSync(index)) return streamFile(res, index, req);
    return send(res, 404, "Not Found");
  }
  streamFile(res, filePath, req);
}

function streamFile(res, filePath, req) {
  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const stat = statSync(filePath);
  const total = stat.size;
  const range = req?.headers?.range;

  if (range && (ext === ".mp4" || ext === ".webm" || ext === ".mov")) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (start >= total || end >= total) {
        res.writeHead(416, { "Content-Range": `bytes */${total}` });
        return res.end();
      }
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Cache-Control": "public, max-age=3600",
      });
      return createReadStream(filePath, { start, end }).pipe(res);
    }
  }

  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": total,
    "Accept-Ranges": "bytes",
    "Cache-Control": ext === ".json" ? "no-store" : "public, max-age=3600",
  });
  if (req && total > 1024 * 1024) createReadStream(filePath).pipe(res);
  else res.end(readFileSync(filePath));
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");

  if (req.method === "OPTIONS") return send(res, 204, "");

  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "POST" && url.pathname === "/api/scenario") {
      const body = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString("utf8"));
      writeFileSync(scenarioPath, JSON.stringify(body, null, 2) + "\n", "utf8");
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/upload") {
      return await handleUpload(req, res, url);
    }

    if (req.method === "GET" && url.pathname === "/api/scenario") {
      if (!existsSync(scenarioPath)) return send(res, 404, "scenario.json not found");
      return streamFile(res, scenarioPath, req);
    }

    if (req.method === "GET") return serveStatic(req, res);
    send(res, 405, "Method Not Allowed");
  } catch (e) {
    json(res, 400, { ok: false, error: e.message });
  }
});

server.listen(port, () => {
  console.log(`\n  インタラクティブ動画 — 開発サーバー`);
  console.log(`  プレイヤー:  http://localhost:${port}`);
  console.log(`  エディター:  http://localhost:${port}/editor/`);
  console.log(`  分岐マップ:  http://localhost:${port}/map/`);
  console.log(`  埋め込み:    http://localhost:${port}/embed/\n`);
});
