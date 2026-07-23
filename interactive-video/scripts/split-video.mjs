#!/usr/bin/env node
/**
 * 1本の動画を時間指定で切り出します。
 *
 * 使い方:
 *   npm run split -- input.mp4 00:00:00 00:00:08 videos/scene1.mp4
 *   npm run split -- input.mp4 00:00:08 00:00:16 videos/scene2.mp4
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [input, start, end, output] = process.argv.slice(2);

if (!input || !start || !end || !output) {
  console.log(`
動画切り出しツール (ffmpeg)

使い方:
  npm run split -- <入力.mp4> <開始> <終了> <出力.mp4>

例:
  npm run split -- raw/full.mp4 00:00:00 00:00:08 videos/intro.mp4
  npm run split -- raw/full.mp4 00:00:08 00:00:16 videos/forest.mp4

時刻形式: HH:MM:SS または秒数 (例: 8)
`);
  process.exit(0);
}

const inPath = resolve(input);
const outPath = resolve(output);

if (!existsSync(inPath)) {
  console.error("❌ 入力ファイルが見つかりません: " + inPath);
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });

console.log(`✂️  ${start} → ${end} を切り出し: ${outPath}`);
const r = spawnSync(
  "ffmpeg",
  ["-y", "-i", inPath, "-ss", start, "-to", end, "-c", "copy", outPath],
  { stdio: "inherit", shell: true }
);

if (r.status !== 0) process.exit(1);
console.log("✅ 完了");
