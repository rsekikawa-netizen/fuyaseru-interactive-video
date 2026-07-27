import { getStore } from "@netlify/blobs";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const STORE = "interactive-video-data";

export function store() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  const opts = { name: STORE, consistency: "strong" };
  if (siteID) opts.siteID = siteID;
  if (token) opts.token = token;
  return getStore(opts);
}

export function blobKey(projectId, relPath) {
  return `p/${projectId}/${relPath.replace(/^\/+/, "")}`;
}

export async function blobGetText(key) {
  const s = store();
  return s.get(key, { type: "text" });
}

export async function blobGetBytes(key) {
  const s = store();
  return s.get(key, { type: "arrayBuffer" });
}

export async function blobSet(key, data, metadata = {}) {
  const s = store();
  await s.set(key, data, metadata);
}

export async function blobDelete(key) {
  const s = store();
  await s.delete(key);
}

export async function blobList(prefix) {
  const s = store();
  const { blobs } = await s.list({ prefix });
  return blobs;
}

/** Git 上の projects/ を Blob に同期（ビルド時） */
export async function seedFromFilesystem(projectsRoot) {
  const regPath = join(projectsRoot, "index.json");
  if (existsSync(regPath)) {
    await blobSet("registry.json", readFileSync(regPath, "utf8"), {
      contentType: "application/json",
    });
  }
  const walk = async (dir, projectId) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        await walk(full, projectId);
        continue;
      }
      const rel = relative(join(projectsRoot, projectId), full).replace(/\\/g, "/");
      const key = blobKey(projectId, rel);
      const buf = readFileSync(full);
      const ct = name.endsWith(".json")
        ? "application/json"
        : name.endsWith(".mp4")
          ? "video/mp4"
          : "application/octet-stream";
      await blobSet(key, buf, { contentType: ct });
    }
  };
  if (!existsSync(projectsRoot)) return;
  for (const name of readdirSync(projectsRoot)) {
    const full = join(projectsRoot, name);
    if (!statSync(full).isDirectory()) continue;
    await walk(full, name);
  }
}
