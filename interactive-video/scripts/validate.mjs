#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scenarioPath = join(root, "scenario.json");

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✅ " + msg);
}

if (!existsSync(scenarioPath)) fail("scenario.json が見つかりません");

let scenario;
try {
  scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
} catch (e) {
  fail("scenario.json の JSON が不正です: " + e.message);
}

if (!scenario.title) console.warn("⚠ title が未設定です");
if (!scenario.start) fail("start（開始ノードID）が必要です");
if (!scenario.nodes || typeof scenario.nodes !== "object") fail("nodes オブジェクトが必要です");

const ids = Object.keys(scenario.nodes);
if (!ids.includes(scenario.start)) fail(`start "${scenario.start}" が nodes に存在しません`);

const referenced = new Set([scenario.start]);
let errors = 0;
let warnings = 0;

for (const [id, node] of Object.entries(scenario.nodes)) {
  if (!node.video) {
    console.error(`❌ nodes.${id}: video パスが必要です`);
    errors++;
    continue;
  }
  const videoPath = join(root, node.video);
  if (!existsSync(videoPath)) {
    console.warn(`⚠ nodes.${id}: 動画が見つかりません (${node.video}) — npm run demo:videos で生成できます`);
    warnings++;
  }

  const choices = node.choices || [];
  if (node.ending && choices.length) {
    console.warn(`⚠ nodes.${id}: ending と choices が両方設定されています`);
    warnings++;
  }
  for (const c of choices) {
    if (!c.label) {
      console.error(`❌ nodes.${id}: choice に label が必要です`);
      errors++;
    }
    if (!c.next) {
      console.error(`❌ nodes.${id}: choice に next が必要です`);
      errors++;
    } else if (!scenario.nodes[c.next]) {
      console.error(`❌ nodes.${id}: next "${c.next}" が nodes に存在しません`);
      errors++;
    } else {
      referenced.add(c.next);
    }
  }
}

const unreachable = ids.filter((id) => id !== scenario.start && !referenced.has(id));
for (const id of unreachable) {
  console.warn(`⚠ 到達不能なノード: ${id}`);
  warnings++;
}

if (errors) {
  console.error(`\n検証失敗: エラー ${errors} 件, 警告 ${warnings} 件`);
  process.exit(1);
}

ok(`"${scenario.title || "無題"}" — ノード ${ids.length} 個, 警告 ${warnings} 件`);
console.log("   プレイヤー: npm start → http://localhost:3000");
console.log("   エディター: http://localhost:3000/editor/");
console.log("   埋め込み:  http://localhost:3000/embed/");
