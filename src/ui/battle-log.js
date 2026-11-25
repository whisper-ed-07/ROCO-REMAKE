// ---------- HELPERS ----------
function $(sel) { return document.querySelector(sel); }
// 文本高亮：把关键词变成标签，数字加粗
function decorateMessage(text) {
  return escapeHtml(text)
    .replace(/命中要害/g, '<i class="tag crit">暴击</i>')
    .replace(/效果拔群/g, '<i class="tag super">克制</i>')
    .replace(/效果不佳/g, '<i class="tag weak">抵抗</i>')
    .replace(/没有效果/g, '<i class="tag immune">免疫</i>')
    .replace(/(\d+)\s*点伤害/g, '<b class="n">$1</b> 点伤害');
}

function isDeveloperBattle() { return gameState.battleMode === "developer"; }

function renderDeveloperBattleLog(list) {
  const messages = gameState.messages;
  if (list.logSource !== messages || list.logCount > messages.length) {
    list.innerHTML = "";
    list.logSource = messages;
    list.logCount = 0;
  }
  let out = "";
  const types = ["action", "damage", "heal", "status", "system", "turn"];
  for (let i = list.logCount; i < messages.length; i++) {
    const raw = messages[i];
    const text = typeof raw === "string" ? raw : raw.text;
    const logType = raw.type || classifyMessage(text);
    const type = types.includes(logType) ? logType : "system";
    const side = raw.side === "player" ? '<span class="msg-side player">我</span>' :
      raw.side === "ai" ? '<span class="msg-side ai">敌</span>' : '<span class="msg-side"></span>';
    out += '<div class="msg ' + type + '"><span class="developer-log-index" aria-hidden="true">' +
      (i + 1) + '</span>' + side + '<span class="msg-text">' + escapeHtml(text) + '</span></div>';
  }
  if (out) {
    list.insertAdjacentHTML("beforeend", out);
    list.logCount = messages.length;
  }
  const count = document.querySelector("#developer-log-count");
  if (count) count.textContent = "完整日志 · " + messages.length + " 条";
}

function renderBattleLog() {
  var msgs = document.querySelector("#battle-messages");
  if (!msgs) return;
  var jump = document.querySelector("#log-jump");
  var atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
  var prevTop = msgs.scrollTop;
  if (isDeveloperBattle()) {
    renderDeveloperBattleLog(msgs);
    msgs.scrollTop = atBottom ? msgs.scrollHeight : prevTop;
    if (jump) jump.hidden = atBottom;
    return;
  }
  var arr = gameState.messages.slice(-200);
  var filter = gameState.logFilter || "all";
  var collapsed = null;
  var out = "";
  arr.forEach(function(raw) {
    var m = typeof raw === "string" ? { text: raw, type: classifyMessage(raw), side: "system", turn: 0 } : raw;
    var type = m.type || "system", side = m.side || "system";
    if (filter === "action" && type === "system") return;
    if (filter === "system" && type !== "system" && type !== "turn") return;
    if (type === "turn") {
      collapsed = (gameState.logCollapsed && gameState.logCollapsed[m.turn]) ? m.turn : null;
      out += '<div class="msg turn' + (collapsed !== null ? " turn-collapsed" : "") + '" data-turn="' + m.turn + '"><span class="msg-text">' + escapeHtml(m.text) + '</span><span class="turn-caret">' + (collapsed !== null ? "▸" : "▾") + '</span></div>';
      return;
    }
    var hidden = collapsed !== null && m.turn === collapsed;
    var badge = side === "player" ? '<span class="msg-side player">我</span>' : side === "ai" ? '<span class="msg-side ai">敌</span>' : '<span class="msg-side"></span>';
    out += '<div class="msg ' + type + ' side-' + side + (hidden ? " collapsed" : "") + '">' + badge + '<span class="msg-text">' + decorateMessage(m.text) + '</span></div>';
  });
  if (!out) out = '<div class="msg system"><span class="msg-side"></span><span class="msg-text">暂无记录</span></div>';
  setMarkupIfChanged(msgs, out);
  if (atBottom) msgs.scrollTop = msgs.scrollHeight; else msgs.scrollTop = prevTop;
  if (jump) jump.hidden = atBottom;
  Array.prototype.forEach.call(document.querySelectorAll(".log-tab"), function(b) {
    b.classList.toggle("active", b.getAttribute("data-filter") === filter);
  });
}

function copyBattleLog() {
  var text = gameState.messages.map(function(m) { return typeof m === "string" ? m : m.text; }).join("\n");
  var btn = document.querySelector("#log-copy");
  var done = function() { if (!btn) return; var old = btn.textContent; btn.textContent = "已复制"; setTimeout(function() { btn.textContent = old; }, 1200); };
  var fallback = function() {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
  else fallback();
}

// ---------- 战斗日志消息 ----------
// 统一消息模型：{ text, type: action|damage|heal|status|system|turn, side: player|ai|system, turn }
function classifyMessage(text) {
  var s = String(text);
  if (/^━+/.test(s)) return "turn";
  if (/造成|伤害|固伤|反伤|攻击了自己/.test(s)) return "damage";
  if (/回复|治疗|护盾|吸收了/.test(s)) return "heal";
  if (/免疫|陷入|混乱|烧伤|冰冻|麻痹|中毒|睡眠|恐惧|束缚|寄生|强化|提升|降低|级/.test(s)) return "status";
  if (/天气|环境|回合|换宠|换上|先手|后手|倒下了|战斗开始|逃跑|解除/.test(s)) return "system";
  return "action";
}
let developerLogFramePending = false;
function addMessage(msg, type, side) {
  var text = String(msg);
  gameState.messages.push({
    text: text,
    type: type || classifyMessage(text),
    side: side || gameState.currentActingSide || "system",
    turn: gameState.turnCount || 0
  });
  if (isDeveloperBattle() && gameState.screen === "battle" && !developerLogFramePending) {
    developerLogFramePending = true;
    requestAnimationFrame(function() {
      developerLogFramePending = false;
      if (isDeveloperBattle() && gameState.screen === "battle") renderBattleLog();
    });
  }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var battleVisualTasks = [];
function clearBattleVisualTasks() { battleVisualTasks.slice().forEach(function(finish) { finish(); }); }
function battleVisualTask(node, duration, cleanup) {
  var done = false, timer, media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function finish() {
    if (done) return; done = true; clearTimeout(timer);
    if (media && media.removeEventListener) media.removeEventListener("change", changed);
    else if (media && media.removeListener) media.removeListener(changed);
    battleVisualTasks = battleVisualTasks.filter(function(task) { return task !== finish; }); cleanup();
  }
  function changed(e) { if (e.matches) finish(); }
  if (prefersReducedMotion() || node.isConnected === false) { finish(); return finish; }
  battleVisualTasks.push(finish);
  if (media && media.addEventListener) media.addEventListener("change", changed);
  else if (media && media.addListener) media.addListener(changed);
  timer = setTimeout(finish, duration);
  return finish;
}
function spawnFloatText(pet, text, type) {
  var spriteId = pet === gameState.playerActive ? "#player-sprite" : pet === gameState.aiActive ? "#ai-sprite" : null;
  if (!spriteId) return;
  var sprite = document.querySelector(spriteId);
  if (!sprite) return;
  syncBattleIdentity(spriteId === "#player-sprite" ? "player" : "ai", pet);
  if (prefersReducedMotion()) return;
  if (type === "dmg") {
    if (sprite.finishHit) sprite.finishHit();
    sprite.classList.remove("hit", "pet-enter"); void sprite.offsetWidth; sprite.classList.add("hit");
    var active = true;
    sprite.finishHit = function() { if (active) { active = false; sprite.classList.remove("hit"); } };
    var finishHit = sprite.finishHit;
    battleVisualTask(sprite, motionDuration("--motion-panel", 180), finishHit);
  }
  if (preferences.floatNumbers === "off") return;
  var colors = { dmg:"#ff4757", heal:"#2ed573", shield:"#4dc9f6" };
  var el = document.createElement("div");
  el.className = "float-text"; el.textContent = (type === "dmg" ? "-" : "+") + text;
  el.style.color = colors[type] || "#fff"; sprite.appendChild(el);
  battleVisualTask(el, motionDuration("--motion-float", 700), function() { el.remove(); });
}

