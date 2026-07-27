import {
  blobGetText,
  blobSet,
  blobGetBytes,
  blobKey,
  blobList,
  blobDelete,
} from "../lib/blob-store.mjs";

const MAX_UPLOAD = 6 * 1024 * 1024;
const EMPTY_SCENARIO = {
  title: "新規プロジェクト",
  publicUrl: "https://fuyaseru-interactive-video.netlify.app",
  start: "intro",
  nodes: {
    intro: {
      video: "videos/intro.mp4",
      prompt: "次はどうする?",
      choices: [],
    },
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Filename",
  };
}

function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function sanitizeProjectId(id) {
  const s = String(id || "").trim();
  return /^[a-zA-Z0-9_-]+$/.test(s) ? s : null;
}

async function readRegistry() {
  const raw = await blobGetText("registry.json");
  if (!raw) return { projects: [{ id: "default", title: "サンプル分岐動画" }] };
  return JSON.parse(raw);
}

async function writeRegistry(reg) {
  await blobSet("registry.json", JSON.stringify(reg, null, 2) + "\n", {
    contentType: "application/json",
  });
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

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "/api");
  const pathname = path.startsWith("/api") ? path : "/api" + path;

  try {
    if (req.method === "GET" && pathname === "/api/projects") {
      const reg = await readRegistry();
      for (const p of reg.projects) {
        const sc = await blobGetText(blobKey(p.id, "scenario.json"));
        if (sc) {
          try {
            p.title = JSON.parse(sc).title || p.title;
          } catch (_) {}
        }
      }
      return jsonResponse(200, reg);
    }

    if (req.method === "POST" && pathname === "/api/projects") {
      const body = await req.json();
      const id = sanitizeProjectId(body.id);
      if (!id) return jsonResponse(400, { ok: false, error: "ID は英数字・ハイフン・アンダースコアのみ" });
      const reg = await readRegistry();
      if (reg.projects.some((p) => p.id === id)) {
        return jsonResponse(409, { ok: false, error: "ID が既に存在します" });
      }
      const title = String(body.title || id).trim();
      const scenario = { ...EMPTY_SCENARIO, title };
      await blobSet(blobKey(id, "scenario.json"), JSON.stringify(scenario, null, 2) + "\n", {
        contentType: "application/json",
      });
      reg.projects.push({ id, title, createdAt: new Date().toISOString() });
      await writeRegistry(reg);
      return jsonResponse(201, { ok: true, id, title });
    }

    if (req.method === "DELETE" && pathname === "/api/projects") {
      const id = sanitizeProjectId(url.searchParams.get("id"));
      if (!id) return jsonResponse(400, { ok: false, error: "project id が必要です" });
      if (id === "default") return jsonResponse(403, { ok: false, error: "default は削除できません" });
      const reg = await readRegistry();
      reg.projects = reg.projects.filter((p) => p.id !== id);
      await writeRegistry(reg);
      const listed = await blobList(`p/${id}/`);
      for (const b of listed) await blobDelete(b.key);
      return jsonResponse(200, { ok: true });
    }

    if (req.method === "GET" && pathname === "/api/scenario") {
      const projectId = sanitizeProjectId(url.searchParams.get("project")) || "default";
      let sc = await blobGetText(blobKey(projectId, "scenario.json"));
      if (!sc) {
        const origin = new URL(req.url).origin;
        const staticRes = await fetch(
          `${origin}/projects/${encodeURIComponent(projectId)}/scenario.json`,
          { cache: "no-store" }
        );
        if (staticRes.ok) sc = await staticRes.text();
      }
      if (!sc) {
        return jsonResponse(404, { ok: false, error: "scenario.json not found" });
      }
      return new Response(sc, {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders() },
      });
    }

    if (req.method === "POST" && pathname === "/api/scenario") {
      const projectId = sanitizeProjectId(url.searchParams.get("project")) || "default";
      const body = await req.json();
      await blobSet(blobKey(projectId, "scenario.json"), JSON.stringify(body, null, 2) + "\n", {
        contentType: "application/json",
      });
      const reg = await readRegistry();
      const entry = reg.projects.find((p) => p.id === projectId);
      if (entry && body.title) {
        entry.title = body.title;
        await writeRegistry(reg);
      }
      return jsonResponse(200, { ok: true, project: projectId });
    }

    if (req.method === "POST" && pathname === "/api/upload") {
      const projectId = sanitizeProjectId(url.searchParams.get("project")) || "default";
      const kind = url.searchParams.get("kind") || "video";
      const nodeId = url.searchParams.get("nodeId") || "";
      const assetId = url.searchParams.get("assetId") || "";

      // --- 分割アップロード（チャンク結合）: Netlify Functions の約4.5MB制限を回避 ---
      const uploadId = url.searchParams.get("uploadId");
      const chunkIndexRaw = url.searchParams.get("chunkIndex");
      const chunkCount = parseInt(url.searchParams.get("chunkCount") || "0", 10);
      if (uploadId && chunkIndexRaw !== null && chunkCount > 0) {
        const uid = String(uploadId).replace(/[^\w-]+/g, "_").slice(0, 80);
        const idx = parseInt(chunkIndexRaw, 10);
        if (!Number.isInteger(idx) || idx < 0 || idx >= chunkCount) {
          return jsonResponse(400, { ok: false, error: "chunkIndex が不正です" });
        }
        const chunk = Buffer.from(await req.arrayBuffer());
        if (chunk.length > MAX_UPLOAD) {
          return jsonResponse(413, { ok: false, error: "チャンクが大きすぎます" });
        }
        await blobSet(blobKey(projectId, `_uploads/${uid}/${idx}`), chunk, {
          contentType: "application/octet-stream",
        });
        // 最終チャンク以外は受領のみ返す
        if (idx < chunkCount - 1) {
          return jsonResponse(200, { ok: true, received: idx, chunkCount });
        }
        // 最終チャンク到達 → 全チャンクを結合
        const filenameC = url.searchParams.get("filename") || (kind === "image" ? "button.png" : "upload.mp4");
        const parts = await Promise.all(
          Array.from({ length: chunkCount }, (_, i) =>
            blobGetBytes(blobKey(projectId, `_uploads/${uid}/${i}`)),
          ),
        );
        if (parts.some((p) => !p)) {
          return jsonResponse(400, {
            ok: false,
            error: "チャンクが欠落しています。もう一度アップロードしてください。",
          });
        }
        const full = Buffer.concat(parts.map((b) => Buffer.from(b)));
        // 一時チャンクを削除
        await Promise.all(
          Array.from({ length: chunkCount }, (_, i) =>
            blobDelete(blobKey(projectId, `_uploads/${uid}/${i}`)),
          ),
        );
        if (kind === "image") {
          const ext = (filenameC.split(".").pop() || "png").toLowerCase();
          const stem = String(assetId || "btn").replace(/[^\w-]+/g, "_").slice(0, 48) || "btn";
          const outName = `${stem}-${Date.now()}.${ext}`;
          const rel = `assets/${outName}`;
          await blobSet(blobKey(projectId, rel), full, {
            contentType: "image/" + (ext === "jpg" ? "jpeg" : ext),
          });
          return jsonResponse(200, {
            ok: true, kind: "image", path: rel, filename: outName, size: full.length, project: projectId,
          });
        }
        const ext = (filenameC.split(".").pop() || "mp4").toLowerCase();
        const base = nodeId ? `${nodeId}.${ext}` : filenameC.replace(/[^\w　-鿿.\-()+ ]+/g, "_");
        const rel = `videos/${base}`;
        await blobSet(blobKey(projectId, rel), full, { contentType: "video/mp4" });
        return jsonResponse(200, {
          ok: true, path: rel, filename: base, size: full.length, project: projectId,
        });
      }

      const type = req.headers.get("content-type") || "";
      let data;
      let filename = url.searchParams.get("filename") || "";

      if (type.startsWith("multipart/form-data")) {
        const boundary = /boundary=(.+)$/.exec(type)?.[1];
        if (!boundary) return jsonResponse(400, { ok: false, error: "multipart boundary が不正です" });
        const raw = Buffer.from(await req.arrayBuffer());
        if (raw.length > MAX_UPLOAD) {
          return jsonResponse(413, {
            ok: false,
            error: "Netlify 無料枠では1ファイル約6MBまでです。大きい動画は分割するか Render 版をご利用ください。",
          });
        }
        const filePart = parseMultipart(raw, boundary).find((p) => p.name === "file" && p.data.length);
        if (!filePart) return jsonResponse(400, { ok: false, error: "ファイルが見つかりません" });
        data = filePart.data;
        if (!filename) filename = filePart.filename;
      } else {
        data = Buffer.from(await req.arrayBuffer());
        if (data.length > MAX_UPLOAD) {
          return jsonResponse(413, { ok: false, error: "ファイルが大きすぎます（上限 6MB）" });
        }
        if (!filename) filename = req.headers.get("x-filename") || (kind === "image" ? "button.png" : "upload.mp4");
      }

      if (kind === "image") {
        const ext = (filename.split(".").pop() || "png").toLowerCase();
        const stem = String(assetId || "btn").replace(/[^\w-]+/g, "_").slice(0, 48) || "btn";
        const outName = `${stem}-${Date.now()}.${ext}`;
        const rel = `assets/${outName}`;
        await blobSet(blobKey(projectId, rel), data, {
          contentType: "image/" + (ext === "jpg" ? "jpeg" : ext),
        });
        return jsonResponse(200, {
          ok: true,
          kind: "image",
          path: rel,
          filename: outName,
          size: data.length,
          project: projectId,
        });
      }

      const ext = (filename.split(".").pop() || "mp4").toLowerCase();
      const base = nodeId ? `${nodeId}.${ext}` : filename.replace(/[^\w\u3000-\u9fff.\-()+ ]+/g, "_");
      const rel = `videos/${base}`;
      await blobSet(blobKey(projectId, rel), data, { contentType: "video/mp4" });
      return jsonResponse(200, {
        ok: true,
        path: rel,
        filename: base,
        size: data.length,
        project: projectId,
      });
    }

    return jsonResponse(404, { ok: false, error: "Not found" });
  } catch (e) {
    return jsonResponse(400, { ok: false, error: e.message });
  }
};
