var battleVisual = { battleId: null, player: null, ai: null, skillScroll: 0 };
function resetBattleVisual() { closeBloodlinePreview(); clearBattleVisualTasks(); battleVisual = { battleId: null, player: null, ai: null, skillScroll: 0 }; }
function hpPercent(pet) { return Math.max(0, Math.min(100, (pet.hp / pet.maxHp) * 100)); }
function setMarkupIfChanged(el, html) { if (el && el.visualMarkup !== html) { el.innerHTML = html; el.visualMarkup = html; } }
function enterBattleSprite(sprite) {
  if (sprite.finishEnter) sprite.finishEnter();
  if (prefersReducedMotion()) return;
  sprite.classList.remove("pet-enter"); void sprite.offsetWidth; sprite.classList.add("pet-enter");
  sprite.finishEnter = battleVisualTask(sprite, motionDuration("--motion-panel", 180), function() { sprite.classList.remove("pet-enter"); sprite.finishEnter = null; });
}
function syncBattleIdentity(side, pet) {
  var sprite = document.querySelector("#" + side + "-sprite"), info = document.querySelector("#" + side + "-info");
  if (!sprite) return;
  if (info) syncBattleBloodline(info.querySelector(".battle-bloodline-slot"), pet);
  if (sprite.visualPet === pet) return;
  var changed = sprite.visualPet !== undefined;
  if (sprite.finishHit) sprite.finishHit();
  if (sprite.finishEnter) sprite.finishEnter();
  sprite.classList.remove("hit", "pet-enter"); sprite.textContent = pet.emoji;
  sprite.visualPet = pet;
  var el = ELEMENTS[pet.element], name = info && info.querySelector(".pet-info-name");
  var level = info && info.querySelector(".pet-info-lv"), element = info && info.querySelector(".pet-info-element");
  if (name) name.textContent = pet.name;
  if (level) level.textContent = "Lv." + pet.level;
  if (info && el) info.style.borderLeft = "3px solid " + el.color;
  if (element && el) { element.style.background = el.bg; element.style.color = el.color; element.innerHTML = elemIcon(pet.element) + el.name; }
  if (changed) enterBattleSprite(sprite);
}
function updateBattleSide(side, pet) {
  var bar = document.querySelector("#" + side + "-hp-bar");
  if (!pet || !bar) return;
  syncBattleIdentity(side, pet);
  var ghost = bar.parentNode.querySelector(".hp-bar-ghost"), text = document.querySelector("#" + side + "-hp-text");
  var shield = document.querySelector("#" + side + "-shield"), marks = document.querySelector("#" + side + "-marks"), status = document.querySelector("#" + side + "-status");
  var pct = hpPercent(pet), previous = battleVisual[side], fresh = !previous || previous.pet !== pet;
  if (!ghost) { ghost = document.createElement("div"); ghost.className = "hp-bar-ghost"; ghost.style.width = pct + "%"; bar.parentNode.insertBefore(ghost, bar); }
  if (fresh) { bar.style.transition = "none"; ghost.style.transition = "none"; bar.style.width = pct + "%"; ghost.style.width = pct + "%"; void bar.offsetWidth; bar.style.transition = ""; ghost.style.transition = ""; }
  else if (pct !== previous.hp) {
    if (pct > previous.hp || prefersReducedMotion()) { ghost.style.transition = "none"; ghost.style.width = pct + "%"; void ghost.offsetWidth; ghost.style.transition = ""; }
    else ghost.style.width = pct + "%";
    bar.style.width = pct + "%";
  }
  bar.className = "hp-bar-inner" + (pct < 25 ? " critical" : pct < 50 ? " low" : "");
  if (text) text.textContent = pet.hp + "/" + pet.maxHp;
  if (shield) {
    var shieldPct = Math.min(100, pet.shield / pet.maxHp * 100);
    var fill = shield.querySelector(".shield-bar-inner");
    if (pet.shield > 0) {
      if (shield.finishShield) { shield.finishShield(); shield.finishShield = null; fill = shield.querySelector(".shield-bar-inner"); }
      if (!fill) { shield.innerHTML = '<div class="shield-bar-outer"><div class="shield-bar-inner"></div></div><div class="shield-value"></div>'; fill = shield.querySelector(".shield-bar-inner"); if (fill) fill.style.width = Math.min(100, pet.shield / pet.maxHp * 100) + "%"; }
      else if (fresh) { fill.style.transition = "none"; fill.style.width = shieldPct + "%"; void fill.offsetWidth; fill.style.transition = ""; }
      else if (previous.shieldPct !== shieldPct) fill.style.width = shieldPct + "%";
      var value = shield.querySelector(".shield-value"); if (value) value.textContent = "🛡️" + pet.shield;
    } else if (fill && fresh) { shield.innerHTML = ""; }
    else if (fill && previous && previous.shield > 0) {
      fill.style.width = "0%";
      var shieldValue = shield.querySelector(".shield-value"); if (shieldValue) shieldValue.textContent = "";
      shield.finishShield = battleVisualTask(shield, motionDuration("--motion-hp", 280), function() { shield.innerHTML = ""; shield.finishShield = null; });
    }
  }
  if (marks) marks.textContent = Object.keys(pet.marks).length > 0 ? Object.entries(pet.marks).map(function(e) { return e[0] + ":" + e[1]; }).join(" ") : "";
  setMarkupIfChanged(status, renderStatusBadges(pet));
  battleVisual[side] = { pet: pet, hp: pct, shield: pet.shield, shieldPct: Math.min(100, pet.shield / pet.maxHp * 100) };
}
function updateBattleUI() {
  var p = gameState.playerActive, a = gameState.aiActive;
  if (battleVisual.battleId !== gameState.battleId) { resetBattleVisual(); battleVisual.battleId = gameState.battleId; }
  updateBattleSide("player", p); updateBattleSide("ai", a);
  var msgs = document.querySelector("#battle-messages");
  if (msgs) renderBattleLog();
  // 天气/环境显示
  var wEl = document.querySelector("#battle-weather");
  if (wEl) {
    var wParts = [];
    if (gameState.weather) {
      var wInfo = WEATHER_DISPLAY[gameState.weather];
      if (wInfo) wParts.push('<span class="w-item has-weather"><span class="w-icon" aria-hidden="true">' + wInfo[0] + '</span><span>' + wInfo[1] + '</span><span class="w-turns">' + (gameState.weatherTurns || 0) + '\u56de\u5408</span></span>');
    }
    if (gameState.field) {
      var fInfo = {"dream":["\u{1F319}","\u68a6\u5883"],"shunhua":["\u2728","\u77ac\u534e"]}[gameState.field] || null;
      if (!fInfo) fInfo = ["\u2753", "\u672a\u77e5\u73af\u5883"];
      wParts.push('<span class="w-item has-field"><span class="w-icon" aria-hidden="true">' + fInfo[0] + '</span><span>' + fInfo[1] + '</span><span class="w-turns">' + (gameState.fieldTurns || 0) + '\u56de\u5408</span></span>');
    }
    wEl.hidden = wParts.length === 0;
    setMarkupIfChanged(wEl, wParts.join(""));
  }
  var pSt = document.querySelector("#player-stages"); if (pSt && p) pSt.innerHTML = renderStages(p);
  var aSt = document.querySelector("#ai-stages"); if (aSt && a) aSt.innerHTML = renderStages(a);
}

function renderStages(pet) {
  if (!pet) return "";
  var h = '<div class="stage-grid">';
  Object.entries(STAGE_LABELS).forEach(function([stat, label]) {
    var v = pet[stat + "Stage"] || 0;
    h += '<span class="stage-pill' + (v > 0 ? " up" : v < 0 ? " down" : "") + '">' + label + (v > 0 ? "+" + v : v < 0 ? v : "\u00b10") + "</span>";
  });
  return h + "</div>";
}

function renderAbnormalBadges(pet) {
  var h = "";
  if (pet.status) {
    var label = STATUS_LABELS[pet.status] || pet.status;
    // 有时限状态：显示剩余回合
    if (["sleep", "deep_sleep", "fear"].includes(pet.status) && pet.statusTurns > 0) label += " " + pet.statusTurns + "回合";
    if (pet.status === "freeze") label += "（待解冻）";
    h += '<span class="status-badge ' + pet.status + '">' + label + "</span>";
  }
  if (pet.confuseTurns > 0) h += '<span class="status-badge confuse">混乱 ' + pet.confuseTurns + "回合</span>";
  if (pet.bindTurns > 0) h += '<span class="status-badge bind">束缚 ' + pet.bindTurns + "回合</span>";
  if (pet.leechSeed) h += '<span class="status-badge poison">寄生</span>';
  if (pet.poisoned) h += '<span class="status-badge poison">中毒</span>';
  return h;
}

function renderStatusBadges(pet) {
  let h = renderAbnormalBadges(pet);
  const immunityBadges = new Map();
  for (const { source, statuses, turnsLeft } of activeStatusImmunities(pet)) {
    const key = statuses.slice().sort().join(",");
    const badge = immunityBadges.get(key);
    if (badge) {
      badge.sources.push(source);
      badge.turnsLeft = Math.max(badge.turnsLeft, turnsLeft);
    } else {
      immunityBadges.set(key, { sources: [source], statuses, turnsLeft });
    }
  }
  for (const { sources, statuses, turnsLeft } of immunityBadges.values()) {
    const label = ABNORMAL_WITHOUT_BIND.every(status => statuses.includes(status)) ? "免疫异常"
      : statuses.length === 6 ? "免疫控制"
      : "免疫" + STATUS_LABELS[statuses[0]] + "等";
    const tooltip = uiAttr(sources.join("、") + " · " + statuses.map(status => STATUS_LABELS[status]).join("、"));
    h += '<span class="status-badge immune" title="' + tooltip + '">' + label +
      (turnsLeft === Infinity ? "" : " " + turnsLeft + "回合") + "</span>";
  }
  return h;
}

