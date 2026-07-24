#!/usr/bin/env node
/**
 * 静的ファイル配信 + マルチプロジェクト API
 */
import { createServer } from "node:http";
import {
  readFileSync, writeFileSync, existsSync, statSync, createReadStream,
  mkdirSync, rmSync, cpSync, readdirSync,
} from "node:fs";
import { dirname, join, extname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectsRoot = join(root, "projects");
const registryPath = join(projectsRoot, "index.json");
const legacyScenarioPath = join(root, "scenario.json");
const legacyVideosDir = join(root, "videos");
const port = Number(process.env.PORT || 3000);
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
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const EMPTY_SCENARIO = {
  title: "新規プロジェクト",
  publicUrl: "",
  start: "intro",
  nodes: {
    intro: {
      video: "videos/intro.mp4",
      prompt: "次はどうする?",
      choices: [],
    },
  },
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), "application/json");
}

function sanitizeProjectId(id) {
  const s = String(id || "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) return null;
  return s;
}

function projectDir(id) {
  return join(projectsRoot, id);
}

function scenarioPath(id) {
  return join(projectDir(id), "scenario.json");
}

function videosDir(id) {
  return join(projectDir(id), "videos");
}

function assetsDir(id) {
  return join(projectDir(id), "assets");
}

function readRegistry() {
  if (!existsSync(registryPath)) return { projects: [] };
  return JSON.parse(readFileSync(registryPath, "utf8"));
}

function writeRegistry(data) {
  mkdirSync(projectsRoot, { recursive: true });
  writeFileSync(registryPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function ensureDefaultProject() {
  mkdirSync(projectsRoot, { recursive: true });
  const defDir = projectDir("default");
  const defScenario = scenarioPath("default");
  const defVideos = videosDir("default");

  if (!existsSync(defScenario) && existsSync(legacyScenarioPath)) {
    mkdirSync(defDir, { recursive: true });
    cpSync(legacyScenarioPath, defScenario);
  }
  if (existsSync(legacyVideosDir) && !existsSync(defVideos)) {
    mkdirSync(defVideos, { recursive: true });
    for (const f of readdirSync(legacyVideosDir)) {
      cpSync(join(legacyVideosDir, f), join(defVideos, f), { recursive: true });
    }
  }
  if (!existsSync(defScenario)) {
    mkdirSync(defVideos, { recursive: true });
    writeFileSync(defScenario, JSON.stringify(EMPTY_SCENARIO, null, 2) + "\n", "utf8");
  }

  const reg = readRegistry();
  if (!reg.projects.some((p) => p.id === "default")) {
    let title = "default";
    try { title = JSON.parse(readFileSync(defScenario, "utf8")).title || title; } catch (_) {}
    reg.projects.unshift({ id: "default", title, createdAt: new Date().toISOString() });
    writeRegistry(reg);
  }
}

ensureDefaultProject();

function getProjectId(url) {
  return sanitizeProjectId(url.searchParams.get("project")) || "default";
}

function sanitizeFilename(name, fallback = "upload.mp4") {
  const base = basename(String(name || fallback)).replace(/[^\w\u3000-\u9fff.\-()+ ]+/g, "_");
  const ext = extname(base).toLowerCase();
  const allowed = [".mp4", ".webm", ".mov"];
  if (!allowed.includes(ext)) return (base.replace(/\.[^.]+$/, "") || "upload") + ".mp4";
  return base || fallback;
}

function sanitizeImageFilename(name, fallback = "button.png") {
  const base = basename(String(name || fallback)).replace(/[^\w\u3000-\u9fff.\-()+ ]+/g, "_");
  const ext = extname(base).toLowerCase();
  const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
  if (!allowed.includes(ext)) return (base.replace(/\.[^.]+$/, "") || "button") + ".png";
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
  const projectId = getProjectId(url);
  const kind = url.searchParams.get("kind") || "video";
  const nodeId = url.searchParams.get("nodeId") || "";
  const assetId = url.searchParams.get("assetId") || "";
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
    if (!filename) filename = req.headers["x-filename"] || (kind === "image" ? "button.png" : "upload.mp4");
  }

  if (kind === "image") {
    const adir = assetsDir(projectId);
    mkdirSync(adir, { recursive: true });
    const safe = sanitizeImageFilename(filename);
    const stem = String(assetId || "btn").replace(/[^\w-]+/g, "_").slice(0, 48) || "btn";
    const outName = `${stem}-${Date.now()}${extname(safe) || ".png"}`;
    const outPath = resolve(adir, outName);
    if (!outPath.startsWith(resolve(adir))) {
      return json(res, 403, { ok: false, error: "保存先が不正です" });
    }
    writeFileSync(outPath, data);
    return json(res, 200, {
      ok: true,
      kind: "image",
      path: "assets/" + outName,
      filename: outName,
      size: data.length,
      project: projectId,
    });
  }

  const vdir = videosDir(projectId);
  mkdirSync(vdir, { recursive: true });

  if (nodeId) {
    const ext = extname(sanitizeFilename(filename)).toLowerCase() || ".mp4";
    filename = sanitizeFilename(nodeId + ext, nodeId + ".mp4");
  } else {
    filename = sanitizeFilename(filename);
  }

  const outPath = resolve(vdir, filename);
  if (!outPath.startsWith(resolve(vdir))) {
    return json(res, 403, { ok: false, error: "保存先が不正です" });
  }

  writeFileSync(outPath, data);
  return json(res, 200, { ok: true, path: "videos/" + filename, filename, size: data.length, project: projectId });
}

function handleListProjects(res) {
  const reg = readRegistry();
  for (const p of reg.projects) {
    const sp = scenarioPath(p.id);
    if (existsSync(sp)) {
      try { p.title = JSON.parse(readFileSync(sp, "utf8")).title || p.title; } catch (_) {}
    }
  }
  return json(res, 200, reg);
}

function handleCreateProject(req, res) {
  return readBody(req, 64 * 1024).then((buf) => {
    const body = JSON.parse(buf.toString("utf8"));
    const id = sanitizeProjectId(body.id);
    if (!id) return json(res, 400, { ok: false, error: "ID は英数字・ハイフン・アンダースコアのみ" });
    if (existsSync(projectDir(id))) return json(res, 409, { ok: false, error: "ID が既に存在します" });

    const title = String(body.title || id).trim();
    mkdirSync(videosDir(id), { recursive: true });
    mkdirSync(assetsDir(id), { recursive: true });
    const scenario = { ...EMPTY_SCENARIO, title };
    writeFileSync(scenarioPath(id), JSON.stringify(scenario, null, 2) + "\n", "utf8");

    const reg = readRegistry();
    reg.projects.push({ id, title, createdAt: new Date().toISOString() });
    writeRegistry(reg);
    return json(res, 201, { ok: true, id, title });
  });
}

function handleDeleteProject(url, res) {
  const id = sanitizeProjectId(url.searchParams.get("id"));
  if (!id) return json(res, 400, { ok: false, error: "project id が必要です" });
  if (id === "default") return json(res, 403, { ok: false, error: "default プロジェクトは削除できません" });

  const dir = projectDir(id);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });

  const reg = readRegistry();
  reg.projects = reg.projects.filter((p) => p.id !== id);
  writeRegistry(reg);
  return json(res, 200, { ok: true });
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");

  if (req.method === "OPTIONS") return send(res, 204, "");

  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/api/projects") {
      return handleListProjects(res);
    }

    if (req.method === "POST" && url.pathname === "/api/projects") {
      return await handleCreateProject(req, res);
    }

    if (req.method === "DELETE" && url.pathname === "/api/projects") {
      return handleDeleteProject(url, res);
    }

    if (req.method === "POST" && url.pathname === "/api/scenario") {
      const projectId = getProjectId(url);
      const body = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString("utf8"));
      mkdirSync(projectDir(projectId), { recursive: true });
      writeFileSync(scenarioPath(projectId), JSON.stringify(body, null, 2) + "\n", "utf8");

      const reg = readRegistry();
      const entry = reg.projects.find((p) => p.id === projectId);
      if (entry && body.title) {
        entry.title = body.title;
        writeRegistry(reg);
      }
      return json(res, 200, { ok: true, project: projectId });
    }

    if (req.method === "POST" && url.pathname === "/api/upload") {
      return await handleUpload(req, res, url);
    }

    if (req.method === "GET" && url.pathname === "/api/scenario") {
      const projectId = getProjectId(url);
      const sp = scenarioPath(projectId);
      if (!existsSync(sp)) return send(res, 404, "scenario.json not found");
      return streamFile(res, sp, req);
    }

    if (req.method === "GET") return serveStatic(req, res);
    send(res, 405, "Method Not Allowed");
  } catch (e) {
    json(res, 400, { ok: false, error: e.message });
  }
});

server.listen(port, "0.0.0.0", () => {
  const host = process.env.PUBLIC_URL || `http://localhost:${port}`;
  console.log(`\n  インタラクティブ動画 — サーバー (port ${port})`);
  console.log(`  プロジェクト: ${host}/`);
  console.log(`  プレイヤー:   ${host}/play.html?project=default`);
  console.log(`  エディター:   ${host}/editor/?project=default`);
  console.log(`  分岐マップ:   ${host}/map/?project=default`);
  console.log(`  埋め込み:     ${host}/embed/?project=default\n`);
});
