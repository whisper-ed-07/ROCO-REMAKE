// ---------- SCREENS ----------
var uiPageVersion = 0;
function prefersReducedMotion() {
  return preferences.motion === "reduce" || matchesSystemPreference("(prefers-reduced-motion: reduce)");
}
function motionDuration(name, fallback) {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return fallback;
  var value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  var number = parseFloat(value);
  return isFinite(number) && /^(?:\d*\.)?\d+\s*(ms|s)$/.test(value) ? number * (/ms$/.test(value) ? 1 : 1000) : fallback;
}
// 仅负责视觉清理，不承载游戏时序。
function finishVisualTransition(el, property, duration, done) {
  var finished = false, timer, media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function finish() {
    if (finished) return; finished = true;
    clearTimeout(timer); el.removeEventListener("transitionend", onEnd);
    if (media && media.removeEventListener) media.removeEventListener("change", onChange);
    else if (media && media.removeListener) media.removeListener(onChange);
    done();
  }
  function onEnd(e) { if (e.target === el && e.propertyName === property) finish(); }
  function onChange(e) { if (e.matches) finish(); }
  if (prefersReducedMotion() || el.isConnected === false) { finish(); return finish; }
  el.addEventListener("transitionend", onEnd);
  if (media && media.addEventListener) media.addEventListener("change", onChange);
  else if (media && media.addListener) media.addListener(onChange);
  timer = setTimeout(finish, duration + 50);
  return finish;
}
// 关闭时先固定正在入场的当前画面，再切换至退出样式。
function freezeLayerEntrance(el) {
  var nodes = [el], modal = el.querySelector(".modal"), saved = [];
  if (modal) nodes.push(modal);
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return function() {};
  nodes.forEach(function(node) {
    var style = node.style;
    if (!style || !style.setProperty || !style.removeProperty || !style.getPropertyValue) return;
    var computed = window.getComputedStyle(node), props = ["opacity", "transform", "animation"];
    var original = props.map(function(prop) { return { name: prop, value: style.getPropertyValue(prop), priority: style.getPropertyPriority(prop) }; });
    var opacity = computed.opacity, transform = computed.transform;
    style.setProperty("opacity", opacity); style.setProperty("transform", transform); style.setProperty("animation", "none");
    saved.push({ node: node, original: original });
  });
  if (saved.length) void el.offsetWidth;
  return function(release) {
    saved.forEach(function(entry) {
      entry.original.forEach(function(prop) {
        if (release && prop.name === "animation") return;
        if (prop.value) entry.node.style.setProperty(prop.name, prop.value, prop.priority);
        else entry.node.style.removeProperty(prop.name);
      });
    });
  };
}
// 捕获具体节点；force 用于重开和页面销毁，避免旧回调影响新弹层。
function prepareLayer(el, onClosed) {
  var state = "open", finish = null, forced = false, restoreStyles = function() {};
  function complete(restoreFocus) { state = "closed"; onClosed(restoreFocus); restoreStyles(false); }
  el.closeLayer = function(force) {
    if (state === "closed") return;
    if (force === true) {
      forced = true;
      if (finish) { finish(); return; }
      complete(false); return;
    }
    if (state !== "open") return;
    state = "closing";
    if (!prefersReducedMotion() && el.isConnected !== false) restoreStyles = freezeLayerEntrance(el);
    el.classList.add("closing"); restoreStyles(true);
    finish = finishVisualTransition(el, "opacity", motionDuration("--motion-state", 140), function() { complete(!forced); });
  };
  el.layerIsOpen = function() { return state === "open"; };
}
function removeBodyLayer(id) {
  var el = document.getElementById(id);
  if (el) { if (el.closeLayer) el.closeLayer(true); else el.remove(); }
}
function focusScreen(app) {
  var battle = app.querySelector("#btn-battle");
  var target = app.querySelector(".screen-title") || (battle && !battle.disabled && battle) || app.querySelector("button");
  if (target && target.focus) { if (target.classList.contains("screen-title")) target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
}
function showScreen(id) {
  var previous = gameState.screen, changed = previous !== id, app = document.querySelector("#app");
  if (changed) {
    uiPageVersion++;

    var intro = document.getElementById("intro-screen");
    if (intro && !(previous === "intro" && id === "menu" && intro.dataset.leaving)) {
      if (intro.finishIntro) intro.finishIntro(); else intro.remove();
    }
  }
  ["skill-detail-overlay", "modal-overlay", "flee-overlay", "skill-limit-overlay"].forEach(removeBodyLayer);
  ["switch-panel", "result-overlay"].forEach(function(key) { var layer = document.getElementById(key); if (layer && layer.closeLayer) layer.closeLayer(true); });
  if (previous === "battle" && id !== "battle") resetBattleVisual();
  gameState.screen = id; app.innerHTML = "";
  switch(id) { case "intro": renderIntro(app); break; case "menu": renderMenu(app); break; case "team": renderTeamSelect(app); break; case "battle": renderBattle(app); break; case "pets": renderPetManagement(app); break; case "opponent": renderOpponentSelect(app); break; case "skillswap": renderSkillSwap(app); break; case "settings": renderSettings(app); break; }
  if (changed && id !== "intro" && previous !== "intro") {
    var screen = app.querySelector(".screen"); if (screen && !prefersReducedMotion()) screen.classList.add("page-enter");
    focusScreen(app);
  }
}

// 主菜单与启动页共用同一枚标志，suffix 用于避免 SVG 渐变 id 冲突
function logoMarkSvg(suffix) {
  suffix = suffix || "";
  var A = "rocoGoldA" + suffix, B = "rocoGoldB" + suffix;
  return '<svg class="roco-mark" viewBox="0 0 170 110" aria-label="ROCO REMAKE"><defs>' +
    '<linearGradient id="' + A + '" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="#ffe9a8"/><stop offset="50%" stop-color="#e2b04a"/><stop offset="100%" stop-color="#b8841a"/></linearGradient>' +
    '<linearGradient id="' + B + '" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="#d9b45c"/><stop offset="50%" stop-color="#a8801f"/><stop offset="100%" stop-color="#6d5210"/></linearGradient>' +
    '</defs><g class="r-back" transform="translate(52,20) rotate(-13 38 42)"><path d="M22,14 V86 M22,14 H54 A20,20 0 0 1 54,54 H22 M48,54 L76,86" stroke="url(#' + B + ')" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +
    '<g class="r-front" transform="translate(24,0) rotate(11 38 42)"><path d="M22,14 V86 M22,14 H54 A20,20 0 0 1 54,54 H22 M48,54 L76,86" stroke="url(#' + A + ')" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
}

// 启动页：logo 居中，点击后交叉淡出进入主菜单
function renderIntro(app) {
  var old = document.getElementById("intro-screen");
  if (old) old.remove();
  var el = document.createElement("div");
  el.id = "intro-screen";
  el.className = "intro-screen";
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", "点击进入 ROCO REMAKE");
  el.innerHTML = '<div class="intro-logo menu-logo">' + logoMarkSvg("Intro") + '</div><div class="intro-rule"></div><div class="intro-hint">点击进入</div>';
  document.body.appendChild(el);
  var go = function() {
    if (el.dataset.leaving) return;
    el.dataset.leaving = "1";
    el.classList.add("leaving");
    showScreen("menu");
    var version = uiPageVersion;
    el.finishIntro = finishVisualTransition(el, "opacity", motionDuration("--motion-intro", 360), function() {
      el.remove();
      if (uiPageVersion === version && gameState.screen === "menu") focusScreen(app);
    });
  };
  el.addEventListener("click", go);
  el.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
  });
  el.focus({ preventScroll: true });
}

function uiAttr(value) { return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function uiIcon(name) {
  var paths = {
    battle: '<path d="m5 3 6 6-2 2-6-6V3h2Zm14 0-6 6 2 2 6-6V3h-2ZM4 20l5-5m6 0 5 5M2 17l5 5m10 0 5-5M9 11l4 4m2-4-4 4"/>',
    skills: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
    pets: '<path d="M4 4h6v16H4zm10 0h6v16h-6M7 8v3m10 2v3"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + '</svg>';
}
function pageHeader(title, backId, actions) {
  return '<div class="screen-header"><button class="back-btn" id="' + backId + '" aria-label="返回上一页">←</button><span class="screen-title">' + title + '</span>' + (actions || '') + '</div>';
}
function petChoiceCard(pet, attr, selected) {
  var el = ELEMENTS[pet.element] || { name: "?", color: "#888" };
  return '<button type="button" class="pet-card' + (selected ? ' selected' : '') + '" ' + attr + '="' + uiAttr(pet.id) + '"' +
    (selected !== undefined ? ' aria-pressed="' + !!selected + '"' : '') + '><span class="pet-card-check" aria-hidden="true">✓</span><span class="pet-card-emoji" aria-hidden="true">' + escapeHtml(pet.emoji) + '</span><span class="pet-card-name">' + escapeHtml(pet.name) + '</span><span class="pet-card-element" style="color:' + el.color + '">' + elemIcon(pet.element) + el.name + '系</span></button>';
}
var menuMode = "solo";
function renderMenu(app) {
  app.innerHTML = '<div class="menu-screen-bg" aria-hidden="true"><div class="aurora-band b1"></div><div class="aurora-band b2"></div><div class="aurora-band b3"></div></div>' +
    '<main class="screen active menu-shell">' +
      '<div class="menu-topline"><span class="menu-brand-mini">ROCO REMAKE</span></div>' +
      '<header class="menu-header"><div class="menu-logo">' + logoMarkSvg('Menu') + '</div><h1 class="menu-title-cn">洛克王国<span>对战重置版</span></h1></header>' +
      '<nav class="menu-actions-area" aria-label="主菜单"><div class="mode-switch" role="group" aria-label="对战模式">' +
        '<button type="button" id="mode-solo">单机模式</button>' +
        '<button type="button" id="mode-online" aria-label="联机模式，暂未开放">联机模式<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg></button>' +
        '<button type="button" id="mode-developer">开发者·测试模式</button></div><div class="menu-buttons">' +
        '<button class="btn btn-primary" id="btn-battle"><span class="menu-action-copy"><span class="menu-action-title">开始对战</span></span><span class="menu-action-arrow" aria-hidden="true">→</span></button>' +
        '<button class="btn btn-secondary" id="btn-swap"><span class="menu-action-copy"><span class="menu-action-title">局外技能更换</span></span><span class="menu-action-arrow" aria-hidden="true">→</span></button>' +
        '<button class="btn btn-secondary" id="btn-pets"><span class="menu-action-copy"><span class="menu-action-title">宠物管理</span></span><span class="menu-action-arrow" aria-hidden="true">→</span></button>' +
      '</div></nav><div class="menu-footer" aria-hidden="true"></div>' +
    '</main>';
  const battle = app.querySelector("#btn-battle");
  const modes = {
    solo: { title: "开始对战", button: app.querySelector("#mode-solo") },
    online: { title: "联机暂未开放", button: app.querySelector("#mode-online") },
    developer: { title: "开始测试", button: app.querySelector("#mode-developer") }
  };
  function selectMode(mode) {
    menuMode = mode;
    for (const [key, option] of Object.entries(modes)) option.button.setAttribute("aria-pressed", String(key === mode));
    battle.disabled = mode === "online";
    battle.querySelector(".menu-action-title").textContent = modes[mode].title;
  }
  selectMode(menuMode);
  for (const [mode, option] of Object.entries(modes)) option.button.addEventListener("click", function() { selectMode(mode); });
  battle.addEventListener('click', function() {
    if (menuMode === "online") return;
    gameState.selectedTeamIds = []; showScreen('team');
  });
  document.querySelector('#btn-swap').addEventListener('click', function() { showScreen('skillswap'); });
  document.querySelector('#btn-pets').addEventListener('click', function() { showScreen('pets'); });
}

