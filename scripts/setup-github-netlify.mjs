#!/usr/bin/env node
/**
 * GitHub リポジトリ作成 + Secrets 設定 + push
 * 使い方: node scripts/setup-github-netlify.mjs
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SITE_ID = "57f33c36-fe0a-429b-979d-f2a310a09ba5";
const REPO_NAME = "fuyaseru-interactive-video";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: true, ...opts });
  if (r.status !== 0) {
    console.error(r.stdout || r.stderr);
    throw new Error(`Failed: ${cmd} ${args.join(" ")}`);
  }
  return (r.stdout || "").trim();
}

function getNetlifyToken() {
  const cfg = join(homedir(), "AppData", "Roaming", "netlify", "Config", "config.json");
  const data = JSON.parse(readFileSync(cfg, "utf8"));
  const token = data?.users?.[data?.userId]?.auth?.token;
  if (!token) throw new Error("Netlify トークンが見つかりません。先に netlify login を実行してください。");
  return token;
}

console.log("\n=== GitHub + Netlify 自動デプロイ設定 ===\n");

try {
  run("gh", ["auth", "status"]);
} catch {
  console.log("GitHub 未ログイン。以下を実行してください:\n");
  console.log("  gh auth login -h github.com -p https -w\n");
  console.log("ログイン後、このスクリプトを再実行してください。\n");
  process.exit(1);
}

const token = getNetlifyToken();
const root = join(process.cwd());

console.log("[1/4] GitHub リポジトリ作成...");
try {
  run("gh", ["repo", "create", REPO_NAME, "--public", "--source", root, "--remote", "origin", "--push"]);
} catch {
  console.log("  リポジトリ既存の可能性。remote を確認して push します...");
  run("git", ["remote", "remove", "origin"], { stdio: "ignore" });
  try { run("git", ["remote", "add", "origin", `https://github.com/${run("gh", ["api", "user", "-q", ".login"])}/${REPO_NAME}.git`]); } catch (_) {}
  run("git", ["push", "-u", "origin", "main"]);
}

console.log("[2/4] GitHub Secrets 設定...");
run("gh", ["secret", "set", "NETLIFY_AUTH_TOKEN", "--body", token]);
run("gh", ["secret", "set", "NETLIFY_SITE_ID", "--body", SITE_ID]);

console.log("[3/4] GitHub Actions 有効化確認...");
console.log("  https://github.com/" + run("gh", ["api", "user", "-q", ".login"]) + "/" + REPO_NAME + "/actions");

console.log("[4/4] 完了!\n");
console.log("以降: git push するだけで Netlify に自動反映されます。\n");
