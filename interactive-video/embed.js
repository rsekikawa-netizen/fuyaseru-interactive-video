/**
 * LP埋め込み用コード生成
 */
function normalizePublicUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function getEmbedPlayerUrl(scenario, fallbackOrigin) {
  const base = normalizePublicUrl(scenario?.publicUrl) || normalizePublicUrl(fallbackOrigin);
  return base ? base + "/" : "";
}

function isLocalUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
}

function buildIframeEmbed(playerUrl, opts = {}) {
  const height = opts.height || 620;
  const title = opts.title || "インタラクティブ動画";
  return `<iframe
  src="${playerUrl}"
  width="100%"
  height="${height}"
  style="border:0;border-radius:12px;max-width:1100px;display:block;margin:0 auto;"
  allow="autoplay; fullscreen"
  loading="lazy"
  title="${title}">
</iframe>`;
}

function buildResponsiveEmbed(playerUrl, opts = {}) {
  const title = opts.title || "インタラクティブ動画";
  return `<!-- レスポンシブ埋め込み（LP推奨） -->
<div style="position:relative;width:100%;max-width:1100px;margin:0 auto;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;box-shadow:0 8px 32px rgba(0,0,0,.15);">
  <iframe
    src="${playerUrl}"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;"
    allow="autoplay; fullscreen"
    loading="lazy"
    title="${title}">
  </iframe>
</div>`;
}

function buildFullPageSnippet(playerUrl, opts = {}) {
  const title = opts.title || "インタラクティブ動画";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin:0; background:#0d0f14; min-height:100vh; display:grid; place-items:center; padding:16px; box-sizing:border-box; }
  </style>
</head>
<body>
${buildResponsiveEmbed(playerUrl, opts)}
</body>
</html>`;
}

if (typeof module !== "undefined") module.exports = {
  normalizePublicUrl, getEmbedPlayerUrl, isLocalUrl,
  buildIframeEmbed, buildResponsiveEmbed, buildFullPageSnippet,
};
