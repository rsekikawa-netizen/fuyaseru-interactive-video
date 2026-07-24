/** プロジェクト ID の取得・パス生成（共有） */
function getProjectId() {
  const p = new URLSearchParams(location.search).get("project");
  if (p) return p;
  const m = location.pathname.match(/\/projects\/([^/]+)/);
  return m ? m[1] : "default";
}

/** クラウド本番（Netlify / Render）— 保存データは API 経由 */
function isHostedApp() {
  return /\.netlify\.app$/i.test(location.hostname) || /\.onrender\.com$/i.test(location.hostname);
}

function projectRoot(id) {
  id = id || getProjectId();
  return `/projects/${encodeURIComponent(id)}/`;
}

function scenarioUrl(id) {
  id = id || getProjectId();
  if (isHostedApp()) {
    return `/api/scenario?project=${encodeURIComponent(id)}&_=${Date.now()}`;
  }
  return `${projectRoot(id)}scenario.json?_=${Date.now()}`;
}

function videoUrl(relPath, id) {
  if (!relPath) return "";
  if (/^https?:\/\//.test(relPath)) return relPath;
  const clean = relPath.replace(/^\//, "");
  id = id || getProjectId();
  if (isHostedApp()) {
    let path = clean;
    if (clean.startsWith("projects/")) {
      const m = clean.match(/^projects\/[^/]+\/(.+)$/);
      if (m) path = m[1];
    }
    if (path.startsWith("videos/") || path.startsWith("assets/")) {
      return `/api/media?project=${encodeURIComponent(id)}&path=${encodeURIComponent(path)}`;
    }
  }
  if (clean.startsWith("projects/")) return "/" + clean;
  return projectRoot(id) + clean;
}

function withProject(href, id) {
  id = id || getProjectId();
  const u = new URL(href, location.origin);
  u.searchParams.set("project", id);
  return u.pathname + u.search + u.hash;
}

/** localhost / 127.0.0.1 の開発サーバー上か */
function isLocalDev() {
  return /^localhost$|^127\.0\.0\.1$/i.test(location.hostname);
}

let _projectApiReady = null;

/** Node サーバー（作成・保存・UP）が使えるか — クラウド本番も true */
async function hasProjectApi() {
  if (isLocalDev() || isHostedApp()) return true;
  if (_projectApiReady !== null) return _projectApiReady;
  try {
    const r = await fetch("/api/projects", { cache: "no-store" });
    _projectApiReady = r.ok;
  } catch {
    _projectApiReady = false;
  }
  return _projectApiReady;
}

if (typeof module !== "undefined") module.exports = { getProjectId, projectRoot, scenarioUrl, videoUrl, withProject, isLocalDev, hasProjectApi };
