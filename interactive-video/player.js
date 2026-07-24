/* global getProjectId, scenarioUrl, videoUrl, withProject, isLocalDev */

const $ = (s) => document.querySelector(s);

const player = $("#player");
const overlay = $("#overlay");
const choicesEl = $("#choices");
const promptEl = $("#prompt");
const promptSubEl = $("#promptSub");
const fill = $("#fill");
const progress = $("#progress");
const hint = $("#hint");
const ending = $("#ending");
const historyEl = $("#history");
const hotspotLayer = $("#hotspotLayer");
const sceneTitle = $("#sceneTitle");
const timeLabel = $("#timeLabel");

const projectId = getProjectId();

function mediaUrl(relPath, id) {
  return videoUrl(relPath, id);
}

let scenario = null;
let current = null;
let history = [];
let choicesShown = false;
let activeHotspotKeys = new Set();
let shownHotspotKeys = new Set();

const ENDING_LABELS = {
  good: "GOOD END",
  bad: "BAD END",
  true: "TRUE END",
  normal: "END",
};

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

let fullAppMode = false;

async function setLinks() {
  fullAppMode = await hasProjectApi();
  if (!fullAppMode) {
    $("#adminBar").style.display = "none";
    $("#projectBadge").style.display = "none";
    return;
  }
  $("#adminBar").style.display = "";
  $("#projectBadge").style.display = "";
  $("#linkEditor").href = withProject("editor/", projectId);
  $("#linkMap").href = withProject("map/", projectId);
  $("#linkEmbed").href = withProject("embed/", projectId);
  $("#projectBadge").textContent = projectId;
}

async function boot() {
  await setLinks();
  try {
    scenario = await loadScenarioData(projectId);
    document.title = scenario.title || "インタラクティブ動画";
    bindControls();
    restart();
  } catch {
    hint.textContent = `プロジェクト "${projectId}" を読み込めませんでした。`;
    hint.style.display = "grid";
  }
}

function restart() {
  history = [];
  const nodeParam = new URLSearchParams(location.search).get("node");
  const start = nodeParam && scenario.nodes[nodeParam] ? nodeParam : scenario.start;
  go(start, null);
}

function resetNodeUi() {
  choicesShown = false;
  activeHotspotKeys = new Set();
  shownHotspotKeys = new Set();
  hotspotLayer.innerHTML = "";
  overlay.classList.remove("show");
  ending.classList.remove("show");
}

function go(nodeId, choiceLabel) {
  const node = scenario.nodes[nodeId];
  if (!node) {
    hint.style.display = "grid";
    hint.textContent = "ノードが見つかりません: " + nodeId;
    return;
  }
  current = nodeId;
  history.push({ node: nodeId, label: choiceLabel });
  resetNodeUi();
  hint.style.display = "none";
  renderHistory();

  if (node.sceneTitle || node.title) {
    sceneTitle.textContent = node.sceneTitle || node.title;
    sceneTitle.classList.add("show");
    setTimeout(() => sceneTitle.classList.remove("show"), 2800);
  }

  player.src = videoUrl(node.video, projectId);
  player.onerror = () => {
    if (typeof isHostedApp === "function" && isHostedApp()) {
      const fb = staticVideoUrl(node.video, projectId);
      if (fb && player.src !== fb) player.src = fb;
    }
  };
  if (node.poster) player.poster = videoUrl(node.poster, projectId);
  player.muted = scenario.player?.muted ?? false;
  $("#btnMute").textContent = player.muted ? "🔇" : "🔊";

  const autoplay = scenario.player?.autoplay !== false;
  if (autoplay) player.play().catch(() => {});
}

function showChoices(node) {
  if (node.ending) {
    showEnding(node);
    return;
  }
  const choices = node.choices || [];
  if (!choices.length) {
    showEnding(node);
    return;
  }
  promptEl.textContent = node.prompt || "次はどうする?";
  promptSubEl.textContent = node.promptSub || "ボタンをクリック（キー 1〜9 でも選択可）";
  choicesEl.innerHTML = "";
  choices.forEach((c, i) => {
    const allowedIn = new Set(["none", "fade-in", "fade-in-slow", "pop", "rise"]);
    const appear = allowedIn.has(c.appear) ? c.appear : "rise";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice variant-" + (c.variant || "primary") + " fx-in-" + appear;
    if (appear !== "none") {
      b.classList.add("stagger-fx");
      b.style.animationDelay = `${i * 0.06}s`;
    }
    b.dataset.choiceIndex = String(i + 1);
    if (c.image) {
      b.classList.add("choice-img-btn");
      const img = document.createElement("img");
      img.src = mediaUrl(c.image, projectId);
      img.alt = c.label || "選択";
      img.draggable = false;
      b.appendChild(img);
      if (c.label) {
        const cap = document.createElement("span");
        cap.className = "choice-caption";
        cap.textContent = c.label;
        b.appendChild(cap);
      }
    } else {
      b.textContent = c.label;
    }
    b.onclick = () => {
      if (c.action === "link" || c.link) {
        const url = c.link;
        if (!url) return;
        if (c.openInNewTab !== false) window.open(url, "_blank", "noopener,noreferrer");
        else location.href = url;
        return;
      }
      go(c.next, c.label);
    };
    choicesEl.appendChild(b);
  });
  overlay.classList.add("show");
  choicesShown = true;
}

function showEnding(node) {
  const type = node.endingType || "normal";
  const badge = $("#endBadge");
  badge.className = "badge b-" + type;
  badge.textContent = ENDING_LABELS[type] || "END";
  $("#endTitle").textContent = node.endingTitle || "おわり";
  const labels = history.filter((h) => h.label).map((h) => h.label);
  $("#endPath").textContent = labels.length ? "あなたの選択: " + labels.join(" → ") : "";
  ending.classList.add("show");
  player.pause();
}

const HOTSPOT_FX_OUT_MS = {
  "fade-out": 400,
  "fade-out-shrink": 420,
  "fade-out-slow": 850,
};

function hotspotAppearClass(h) {
  const allowed = new Set(["none", "fade-in", "fade-in-slow", "pop", "rise"]);
  const mode = allowed.has(h.appear) ? h.appear : "pop";
  return `fx-in-${mode}`;
}

function removeHotspotWithEffect(el, h, done) {
  const allowedOut = new Set(["none", "fade-out", "fade-out-slow", "fade-out-shrink"]);
  const mode = allowedOut.has(h.disappear) ? h.disappear : "none";
  if (!el || mode === "none") {
    el?.remove();
    done?.();
    return;
  }
  if (el.classList.contains("is-leaving")) return;
  el.classList.forEach((c) => {
    if (c.startsWith("fx-in-")) el.classList.remove(c);
  });
  el.classList.add("is-leaving", `fx-out-${mode}`);
  el.style.pointerEvents = "none";
  const ms = HOTSPOT_FX_OUT_MS[mode] || 400;
  window.setTimeout(() => {
    el.remove();
    done?.();
  }, ms);
}

function dismissHotspot(btn, h, key, afterRemove) {
  removeHotspotWithEffect(btn, h, () => {
    shownHotspotKeys.add(key);
    activeHotspotKeys.delete(key);
    afterRemove?.();
  });
}

function createHotspotButton(h, key) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.hotspot = key;
  btn.className =
    "hotspot " +
    hotspotAppearClass(h) +
    (h.image ? " hotspot-img-btn" : " choice variant-" + (h.variant || "accent"));
  btn.style.left = (h.x ?? 50) + "%";
  btn.style.top = (h.y ?? 68) + "%";
  const w = Number(h.width);
  if (h.image) {
    const img = document.createElement("img");
    img.src = mediaUrl(h.image, projectId);
    img.alt = h.label || "ボタン";
    img.draggable = false;
    if (Number.isFinite(w) && w > 0) img.style.width = w + "%";
    else img.style.width = "min(22vw, 180px)";
    if (Number(h.height) > 0) img.style.height = h.height + "%";
    btn.appendChild(img);
    if (h.label) btn.title = h.label;
  } else {
    btn.textContent = h.label || "Button";
  }
  btn.onclick = (e) => {
    e.stopPropagation();
    if (h.action === "link" || h.link) {
      const url = h.link;
      dismissHotspot(btn, h, key, () => {
        if (url) {
          if (h.openInNewTab !== false) window.open(url, "_blank", "noopener,noreferrer");
          else location.href = url;
        }
      });
      return;
    }
    dismissHotspot(btn, h, key, () => {
      player.pause();
      if (h.next) go(h.next, h.label || h.image || "ボタン");
    });
  };
  return btn;
}

function renderHotspots(node, t) {
  const list = node.hotspots || [];
  list.forEach((h, i) => {
    const key = `${current}:${i}`;
    const until = h.at + (h.duration ?? 86400);
    if (t < h.at) {
      hotspotLayer.querySelector(`[data-hotspot="${key}"]`)?.remove();
      activeHotspotKeys.delete(key);
      return;
    }
    if (t > until) {
      const el = hotspotLayer.querySelector(`[data-hotspot="${key}"]`);
      if (el) removeHotspotWithEffect(el, h, () => activeHotspotKeys.delete(key));
      else activeHotspotKeys.delete(key);
      return;
    }
    if (shownHotspotKeys.has(key)) return;
    if (hotspotLayer.querySelector(`[data-hotspot="${key}"]`)) return;
    hotspotLayer.appendChild(createHotspotButton(h, key));
    activeHotspotKeys.add(key);
  });
}

function maybeShowTimedChoices(node, t) {
  if (choicesShown || node.ending) return;
  const at = node.choicesAt;
  if (at === undefined || at === null || at === "end") return;
  const sec = Number(at);
  if (!Number.isFinite(sec) || t < sec) return;
  player.pause();
  showChoices(node);
}

player.addEventListener("playing", () => {
  hint.style.display = "none";
});

$("#stage").addEventListener("click", (e) => {
  if (e.target.closest("#overlay.show, #ending.show, #topActions, #controls, .choice, .btn, .hotspot")) return;
  if (player.paused) player.play().catch(() => {});
});

function renderHistory() {
  historyEl.innerHTML = "";
  history.forEach((h, i) => {
    if (i > 0) {
      const s = document.createElement("span");
      s.className = "sep";
      s.textContent = "→";
      historyEl.appendChild(s);
    }
    const c = document.createElement("span");
    c.className = "crumb";
    c.textContent = h.label ? h.label : scenario.nodes[h.node].endingTitle || h.node;
    historyEl.appendChild(c);
  });
  if (isLocalDev() || fullAppMode) {
    const link = document.createElement("a");
    link.href = withProject("map/", projectId);
    link.target = "_blank";
    link.textContent = "🗺 分岐マップ";
    historyEl.appendChild(link);
  }
}

player.addEventListener("timeupdate", () => {
  const node = scenario.nodes[current];
  const t = player.currentTime;
  if (player.duration) {
    fill.style.width = (t / player.duration) * 100 + "%";
  }
  timeLabel.textContent = `${fmtTime(t)} / ${fmtTime(player.duration)}`;
  renderHotspots(node, t);
  maybeShowTimedChoices(node, t);
});

player.addEventListener("ended", () => {
  const node = scenario.nodes[current];
  if (node.ending) {
    showEnding(node);
    return;
  }
  showChoices(node);
});

function bindControls() {
  $("#btnPlay").onclick = () => {
    if (player.paused) player.play().catch(() => {});
    else player.pause();
  };
  player.addEventListener("play", () => {
    $("#btnPlay").textContent = "⏸";
  });
  player.addEventListener("pause", () => {
    $("#btnPlay").textContent = "▶";
  });

  $("#btnMute").onclick = () => {
    player.muted = !player.muted;
    $("#btnMute").textContent = player.muted ? "🔇" : "🔊";
  };

  $("#volume").oninput = (e) => {
    player.volume = Number(e.target.value);
    player.muted = false;
    $("#btnMute").textContent = "🔊";
  };

  $("#btnFs").onclick = () => {
    const el = $("#stage");
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  };

  $("#btnSkipChoices").onclick = () => {
    const node = scenario.nodes[current];
    if (!node || node.ending) return;
    player.pause();
    showChoices(node);
  };

  $("#replay").onclick = restart;
  $("#endRestart").onclick = restart;
  $("#endBack").onclick = () => {
    if (history.length < 2) {
      restart();
      return;
    }
    history.pop();
    const prev = history.pop();
    go(prev.node, prev.label);
  };

  $("#btnShare").onclick = async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      $("#btnShare").textContent = "✓ コピー済";
      setTimeout(() => {
        $("#btnShare").textContent = "🔗 共有";
      }, 1600);
    } catch {
      prompt("このURLをコピー:", url);
    }
  };

  progress.onclick = (e) => {
    if (!player.duration) return;
    const rect = progress.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    player.currentTime = Math.max(0, Math.min(player.duration, ratio * player.duration));
  };

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (player.paused) player.play().catch(() => {});
      else player.pause();
    }
    if (e.key.toLowerCase() === "f") $("#btnFs").click();
    if (e.key.toLowerCase() === "m") $("#btnMute").click();
    if (!overlay.classList.contains("show")) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const btn = choicesEl.querySelector(`[data-choice-index="${n}"]`);
      btn?.click();
    }
  });
}

boot();
