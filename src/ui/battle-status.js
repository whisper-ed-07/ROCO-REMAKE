var battleVisual = { battleId: null, player: null, ai: null, skillScroll: 0 };
function resetBattleVisual() { closeBloodlinePreview(); clearBattleVisualTasks(); battleVisual = { battleId: null, player: null, ai: null, skillScroll: 0 }; }
function battleMaxHp(pet) { return pet.maxHp + (pet.maxHpBonus || 0); }
function hpPercent(pet) { return Math.max(0, Math.min(100, (pet.hp / battleMaxHp(pet)) * 100)); }
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
  if (text) text.textContent = pet.hp + "/" + battleMaxHp(pet);
  var shieldPct = Math.min(100, pet.shield / battleMaxHp(pet) * 100);
  if (shield) {
    var fill = shield.querySelector(".shield-bar-inner");
    if (pet.shield > 0) {
      if (shield.finishShield) { shield.finishShield(); shield.finishShield = null; fill = shield.querySelector(".shield-bar-inner"); }
      if (!fill) { shield.innerHTML = '<div class="shield-bar-outer"><div class="shield-bar-inner"></div></div><div class="shield-value"></div>'; fill = shield.querySelector(".shield-bar-inner"); if (fill) fill.style.width = shieldPct + "%"; }
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
  if (status) syncBattleStatus(status, pet);
  battleVisual[side] = { pet: pet, hp: pct, shield: pet.shield, shieldPct };
}
function updateBattleUI() {
  var p = gameState.playerActive, a = gameState.aiActive;
  if (battleVisual.battleId !== gameState.battleId) { resetBattleVisual(); battleVisual.battleId = gameState.battleId; }
  updateBattleSide("player", p); updateBattleSide("ai", a);
  var msgs = document.querySelector("#battle-messages");
  if (msgs) renderBattleLog();
  updateBattleHeader();
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

function syncBattleStatus(node, pet) {
  const markup = renderStatusBadges(pet);
  const samePet = node.statusPet === pet;
  if (samePet && node.visualMarkup === markup) return;
  const open = new Set();
  let focused;
  if (samePet) {
    for (const details of node.querySelectorAll("details[data-status-group]")) {
      if (details.open) open.add(details.dataset.statusGroup);
      if (details.firstElementChild === document.activeElement) focused = details.dataset.statusGroup;
    }
  }
  node.statusPet = pet;
  node.visualMarkup = markup;
  node.innerHTML = markup;
  if (!open.size && !focused) return;
  for (const details of node.querySelectorAll("details[data-status-group]")) {
    details.open = open.has(details.dataset.statusGroup);
    if (focused === details.dataset.statusGroup) details.firstElementChild.focus({ preventScroll: true });
  }
}

function renderStatusDetails(group, label, rows) {
  return '<details class="battle-status-details" data-status-group="' + group + '">' +
    '<summary class="status-badge ' + group + '">' + escapeHtml(label) + '</summary>' +
    '<ul>' + rows.map(row => "<li>" + escapeHtml(row) + "</li>").join("") + '</ul></details>';
}

function statusTurnsLabel(turns) {
  return turns === Infinity ? "持续生效" : turns + "回合";
}

function renderImmunityBadge(pet, turn) {
  const coverage = new Map();
  const sources = [];
  for (const { source, statuses, stats, turnsLeft, active } of activeStatusImmunities(pet)) {
    const turns = source === "明念" ? pet.bloodlineData.markThrough - turn + 1 : turnsLeft;
    if (turns <= 0) continue;
    for (const status of statuses) coverage.set(status, Math.max(coverage.get(status) || 0, turns));
    const scope = [];
    if (statuses.length) scope.push(statuses.map(status => STATUS_LABELS[status]).join("、"));
    if (stats) scope.push(stats === true ? "全部负面强化" : stats.map(stat => STAGE_LABELS[stat]).join("、") + "的负面强化");
    const duration = turns === Infinity && active ? "条件生效" : statusTurnsLabel(turns);
    sources.push(source + "（" + duration + "） · " + scope.join("；"));
  }
  if (!sources.length) return "";
  const broad = ABNORMAL_WITHOUT_BIND.every(status => coverage.has(status));
  const full = broad && coverage.has("bind");
  const scope = full ? ABNORMAL_STATUSES : broad ? ABNORMAL_WITHOUT_BIND : [...coverage.keys()];
  const duration = Math.min(...scope.map(status => coverage.get(status)));
  const label = full ? "免疫全部异常" : broad ? "免疫异常" : scope.length === 1 ? "免疫" + STATUS_LABELS[scope[0]]
    : scope.length ? "免疫部分异常" : "免疫负面强化";
  return renderStatusDetails("immune", label + (Number.isFinite(duration) ? " " + statusTurnsLabel(duration) : ""), sources);
}

function renderOtherStatusBadges(pet, turn) {
  const currentRound = turn === gameState.turnCount;
  const ongoing = [];
  const badges = [];
  function show(label, turns, detail) {
    badges.push('<span class="status-badge effect"' + (detail ? ' title="' + uiAttr(detail) + '"' : "") + '>' +
      escapeHtml(label + (turns ? " " + statusTurnsLabel(turns) : "")) + "</span>");
  }
  if (pet.powerDamageImmuneThroughTurn >= turn) show("免疫威力伤害", pet.powerDamageImmuneThroughTurn - turn + 1);
  if (currentRound && pet.invincible) show("免疫伤害", 1);
  if (pet.externalEffectImmuneTurn === turn) show("免疫外来效果", 1);
  if (currentRound && pet.immuneBackhandEffects) show("免疫后手效果", 1);
  else if (currentRound && pet.immuneBackhand) show("免疫后手伤害", 1);
  if (pet.immuneEject || pet.dimoEjectImmuneThrough >= turn) show("免疫驱逐", pet.immuneEject ? 0 : pet.dimoEjectImmuneThrough - turn + 1);
  if (pet.reflectBackhand && !gameState.banEffects?.reflect) show("反弹后手效果");
  if (pet.dimoLethalDodgeThrough >= turn && pet.dodgeLethalLeft > 0) {
    show("闪避致死伤害 ×" + pet.dodgeLethalLeft, pet.dimoLethalDodgeThrough - turn + 1);
  }

  if (!gameState.banEffects?.damageCap) {
    if (pet.damageCapTurns > 0 && Number.isFinite(pet.damageCap)) {
      show("限伤 " + pet.damageCap, pet.damageCapTurns, "单段伤害超过 " + pet.damageCapThreshold + " 时生效");
    } else if (pet.lightWindThroughTurn >= turn && pet.hp < battleMaxHp(pet) * 0.6) {
      show("限伤 150", pet.lightWindThroughTurn - turn + 1);
    } else if (pet.bloodlineData?.jianghuaThrough >= turn) {
      show("限伤", pet.bloodlineData.jianghuaThrough - turn + 1);
    }
  }
  const reduction = pet.getDamageReduction();
  if (reduction > 0) show("减伤 " + reduction + "%", reduction > pet.passiveDamageReduction ? pet.damageReductionTurns : 0);
  if (pet.healInvertTurns > 0 && pet.healInvertPct > 0) show("治疗倒置 " + Math.round(pet.healInvertPct * 100) + "%", pet.healInvertTurns);
  if (pet.dimoFrostRecoveryThrough >= turn) show("回复减半", pet.dimoFrostRecoveryThrough - turn + 1);
  if (pet.statLockedThrough >= turn) show("强化锁定", pet.statLockedThrough - turn + 1);
  if (pet.blockPPRecovery || pet.blockPPRecoveryOnTurn === turn) show("禁止回复 PP", 1);
  else if (!gameState.battleOver && pet.blockPPRecoveryOnTurn === turn + 1) show("下回合禁止回复 PP");

  const switchLocks = [...(pet.switchLockSources || [])].filter(([, through]) => through >= turn);
  const sleepLock = pet.deepSleepLock;
  if (sleepLock && !sleepLock.target.isFainted() && sleepLock.target.status === "deep_sleep" &&
      sleepLock.target.deepSleepToken === sleepLock.token) switchLocks.push(["残念余梦", turn + sleepLock.target.statusTurns - 1]);
  if (pet.switchLocked || switchLocks.length) show("禁止换宠", pet.switchLocked ? 0 : Math.max(...switchLocks.map(([, through]) => through - turn + 1)),
    switchLocks.map(([name]) => name).join("、"));
  if (pet.qlSealMark) show("封灵印记");

  for (const { name, turnsLeft } of pet.turnEffects) {
    if (turnsLeft > 0) ongoing.push(name + " · " + statusTurnsLabel(turnsLeft));
  }
  for (const [skillId, sequence] of pet.skillContinuations) {
    if (sequence.through >= turn) {
      ongoing.push((findSkill(skillId)?.name || skillId) + " · 连续发动 · " + statusTurnsLabel(sequence.through - turn + 1));
    }
  }
  for (const [source, effect] of pet.ppCostEffects || []) {
    if (effect.throughTurn >= turn) {
      ongoing.push(getPPCostSourceLabel(source) + (effect.skill ? " · " + effect.skill.name : "") +
        " · PP 消耗增加 · " + statusTurnsLabel(effect.throughTurn - turn + 1));
    }
  }
  return badges.join("") + (ongoing.length ? renderStatusDetails("effect", "持续效果", ongoing) : "");
}

function battleDisplayTurn() {
  // 选招显示即将行动的回合，结算和结果页显示最后实际进行的回合。
  return gameState.turnCount + (gameState.resolvingTurn || gameState.battleOver ? 0 : 1);
}

function renderStatusBadges(pet) {
  const turn = battleDisplayTurn();
  return renderAbnormalBadges(pet) + renderImmunityBadge(pet, turn) + renderOtherStatusBadges(pet, turn);
}

