#!/usr/bin/env node
/**
 * ffmpeg で scenario.json に合わせたデモ用 mp4 を自動生成します。
 * ffmpeg が PATH にない場合はインストール手順を表示して終了します。
 */
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = join(root, "videos");
const scenario = JSON.parse(readFileSync(join(root, "scenario.json"), "utf8"));

function hasFfmpeg() {
  const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8", shell: true });
  return r.status === 0;
}

const COLORS = {
  intro: "0x1a3a5c",
  forest: "0x1f4a2e",
  sea: "0x0d3d5c",
  cabin: "0x3d2817",
  river: "0x1a2a3a",
  dive: "0x0a2540",
  lighthouse: "0x4a3a1a",
};

function makeVideo(outPath, label, color, seconds = 4) {
  if (existsSync(outPath)) {
    console.log("⏭  スキップ (既存): " + outPath);
    return;
  }
  mkdirSync(dirname(outPath), { recursive: true });
  const safe = label.replace(/'/g, "\\'");
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${color}:s=1280x720:d=${seconds}`,
    "-vf", `drawtext=text='${safe}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outPath,
  ];
  console.log("🎬 生成中: " + outPath);
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", shell: true, stdio: "inherit" });
  if (r.status !== 0) process.exit(1);
}

if (!hasFfmpeg()) {
  console.error(`
ffmpeg が見つかりません。以下のいずれかでインストールしてください:

  Windows (winget):
    winget install Gyan.FFmpeg

  Windows (chocolatey):
    choco install ffmpeg

  macOS:
    brew install ffmpeg

インストール後、ターミナルを再起動して npm run demo:videos を再実行してください。
`);
  process.exit(1);
}

mkdirSync(videosDir, { recursive: true });

for (const [id, node] of Object.entries(scenario.nodes)) {
  const rel = node.video.replace(/^videos[\\/]/, "");
  const out = join(videosDir, rel);
  const title = node.endingTitle || id;
  const color = COLORS[id] || "0x222222";
  makeVideo(out, title, color);
}

console.log("\n✅ デモ動画の生成が完了しました。npm start でプレイヤーを開いてください。");
