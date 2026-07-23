#!/usr/bin/env node
/**
 * videos/ 内の mp4 を Web 向けに最適化（faststart + yuv420p）
 * 使い方: npm run optimize
 *         npm run optimize -- videos/intro.mp4  （1ファイル指定）
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = join(root, "videos");
const args = process.argv.slice(2);

function collectMp4(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => extname(f).toLowerCase() === ".mp4")
    .map((f) => join(dir, f));
}

const targets = args.length
  ? args.map((p) => resolve(root, p))
  : collectMp4(videosDir);

if (!targets.length) {
  console.error("最適化する mp4 がありません。videos/ に動画を置くか、パスを指定してください。");
  process.exit(1);
}

for (const input of targets) {
  if (!existsSync(input)) {
    console.error("❌ 見つかりません: " + input);
    continue;
  }
  const tmp = join(dirname(input), "_opt_" + basename(input));
  console.log("⚙  最適化: " + input);
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", input, "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", tmp],
    { stdio: "inherit", shell: true }
  );
  if (r.status !== 0) {
    console.error("❌ 失敗: " + input);
    continue;
  }
  spawnSync("cmd", ["/c", "move", "/Y", tmp, input], { shell: true });
  console.log("✅ 完了: " + input);
}
