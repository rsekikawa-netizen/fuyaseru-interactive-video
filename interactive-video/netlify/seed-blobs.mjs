#!/usr/bin/env node
/** Netlify ビルド時: projects/ → Blobs */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { seedFromFilesystem } from "./lib/blob-store.mjs";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectsRoot = join(appRoot, "projects");

if (!process.env.NETLIFY) {
  console.log("seed-blobs: skip (not Netlify build)");
  process.exit(0);
}

console.log("seed-blobs: syncing projects/ to Netlify Blobs…");
await seedFromFilesystem(projectsRoot);
console.log("seed-blobs: done");
