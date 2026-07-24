#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[2] || "default";
const projectDir = join(root, "projects", projectId);
const scenarioPath = join(projectDir, "scenario.json");

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✅ " + msg);
}

if (!existsSync(scenarioPath)) fail(`projects/${projectId}/scenario.json が見つかりません`);

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
  const videoPath = join(projectDir, node.video);
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
    if (!c.label && !c.image) {
      console.error(`❌ nodes.${id}: choice に label または image が必要です`);
      errors++;
    }
    const isLink = c.action === "link" || (c.link && !c.next);
    if (isLink) {
      if (!c.link) {
        console.error(`❌ nodes.${id}: link 動作の choice に link（URL）が必要です`);
        errors++;
      }
    } else if (!c.next) {
      console.error(`❌ nodes.${id}: choice に next が必要です（または link を指定）`);
      errors++;
    } else if (!scenario.nodes[c.next]) {
      console.error(`❌ nodes.${id}: next "${c.next}" が nodes に存在しません`);
      errors++;
    } else {
      referenced.add(c.next);
    }
  }
  for (const h of node.hotspots || []) {
    if (!h.label && !h.image) {
      console.error(`❌ nodes.${id}: hotspot に label または image が必要です`);
      errors++;
    }
    if (!Number.isFinite(Number(h.at))) {
      console.error(`❌ nodes.${id}: hotspot.at（秒）が必要です`);
      errors++;
    }
    const isLink = h.action === "link" || (h.link && !h.next);
    if (isLink) {
      if (!h.link) {
        console.error(`❌ nodes.${id}: link 動作の hotspot に link（URL）が必要です`);
        errors++;
      }
    } else if (!h.next) {
      console.error(`❌ nodes.${id}: hotspot に next が必要です（または link を指定）`);
      errors++;
    } else if (!scenario.nodes[h.next]) {
      console.error(`❌ nodes.${id}: hotspot next "${h.next}" が nodes に存在しません`);
      errors++;
    } else {
      referenced.add(h.next);
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

ok(`[${projectId}] "${scenario.title || "無題"}" — ノード ${ids.length} 個, 警告 ${warnings} 件`);
console.log(`   プレイヤー: npm start → http://localhost:3000/play.html?project=${projectId}`);
console.log(`   エディター: http://localhost:3000/editor/?project=${projectId}`);
console.log(`   埋め込み:  http://localhost:3000/embed/?project=${projectId}`);
