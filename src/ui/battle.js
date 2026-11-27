setBattlePresentation({
  actionSubmitted() {
    document.querySelectorAll("#battle-actions button").forEach(button => { button.disabled = true; });
  },
  awaitingAction() { renderBattleActions(); },
  roundStarted() {
    const indicator = document.querySelector("#turn-indicator");
    if (indicator) indicator.style.display = "none";
  },
  timerStopped() {
    const timer = document.querySelector("#turn-timer");
    if (timer) timer.style.display = "none";
  },
  switchSelected() {
    const panel = document.querySelector("#switch-panel");
    if (panel?.closeLayer) panel.closeLayer(true);
    else if (panel) panel.classList.remove("show");
  },
  activePetChanged({ reason }) {
    if (reason === "voluntary") updateBattleUI();
    else renderBattle(document.querySelector("#app"));
  },
  elementChanged() { renderBattle(document.querySelector("#app")); },
  refresh() { updateBattleUI(); },
  floatText(pet, text, type) { spawnFloatText(pet, text, type); },
  messageAdded() { scheduleDeveloperBattleLog(); },
  battleEnding() { closeBloodlinePreview(); },
  battleEnded(playerWin, fled) { showBattleResult(playerWin, fled); }
});

function showBattleResult(playerWin, fled) {
  if (isDeveloperBattle()) {
    renderBattleLog();
    const leave = document.querySelector("#flee-btn");
    if (leave) { leave.textContent = "返回主菜单"; leave.title = "返回主菜单"; }
  }
  document.querySelector("#result-overlay").classList.add("show");
  document.querySelector("#result-emoji").textContent = fled ? "" : playerWin ? "\u{1F3C6}" : "\u{1F494}";
  const result = document.querySelector("#result-text");
  result.textContent = fled ? "测试结束" : playerWin ? "你赢了！" : "你输了...";
  result.className = "result-text " + (fled ? "" : playerWin ? "win" : "lose");
  const actions = document.querySelector("#battle-actions");
  if (actions) actions.innerHTML = "";
}

function displayedPercent(node, fallback) {
  if (!node) return fallback;
  if (typeof window !== "undefined" && window.getComputedStyle && node.parentNode && node.parentNode.getBoundingClientRect) {
    var width = node.parentNode.getBoundingClientRect().width, current = parseFloat(window.getComputedStyle(node).width);
    if (width > 0 && isFinite(current)) return Math.max(0, Math.min(100, current / width * 100));
  }
  var value = parseFloat(node.style.width); return isFinite(value) ? value : fallback;
}
function renderBattle(app) {
  closeBloodlinePreview();
  var p = gameState.playerActive, a = gameState.aiActive;
  var sameBattle = battleVisual.battleId === gameState.battleId;
  if (!sameBattle) { resetBattleVisual(); battleVisual.battleId = gameState.battleId; }
  var oldSkills = sameBattle && document.querySelector(".battle-skill-list"); if (oldSkills) battleVisual.skillScroll = oldSkills.scrollLeft;
  var previousPlayer = sameBattle && battleVisual.player && battleVisual.player.pet === p;
  var previousAi = sameBattle && battleVisual.ai && battleVisual.ai.pet === a;
  const fullLog = isDeveloperBattle();
  const leaveLabel = fullLog && gameState.battleOver ? "返回主菜单" : "逃跑";
  var oldLog = sameBattle && document.querySelector("#battle-messages"), logTop = oldLog && oldLog.scrollTop;
  var logBottom = !oldLog || oldLog.scrollHeight - oldLog.scrollTop - oldLog.clientHeight < 40;
  var pBar = document.querySelector("#player-hp-bar"), aBar = document.querySelector("#ai-hp-bar");
  var pStart = previousPlayer ? displayedPercent(pBar, hpPercent(p)) : hpPercent(p);
  var aStart = previousAi ? displayedPercent(aBar, hpPercent(a)) : hpPercent(a);
  var pGhost = previousPlayer && pBar ? displayedPercent(pBar.parentNode.querySelector(".hp-bar-ghost"), pStart) : pStart;
  var aGhost = previousAi && aBar ? displayedPercent(aBar.parentNode.querySelector(".hp-bar-ghost"), aStart) : aStart;
  clearBattleVisualTasks();
  const noElement = { name:"无属系", color:"#a6b0c1", bg:"transparent" };
  var pEl = ELEMENTS[p.element] || noElement, aEl = ELEMENTS[a.element] || noElement;
  const logTools = fullLog ? '<span class="developer-log-count" id="developer-log-count">完整日志</span>' :
    '<button class="log-tab active" data-filter="all">全部</button><button class="log-tab" data-filter="action">行动</button><button class="log-tab" data-filter="system">系统</button>';
  const logAttributes = fullLog ? ' tabindex="0" role="region" aria-label="完整战斗日志"' : "";
  var html =
    '<div class="battle-bg screen active">' +
    '<div class="battle-weather" id="battle-weather" role="status" hidden></div>' +
    // 顶栏：回合指示 + 倒计时 + 逃跑
    '<div class="battle-top">' +
      '<div class="turn-indicator" id="turn-indicator" style="display:none"></div>' +
      '<div class="turn-timer" id="turn-timer" style="display:none"><span>\u23F3</span><div class="turn-timer-bar"><div class="turn-timer-fill" id="turn-timer-fill" style="width:100%"></div></div><span id="turn-timer-text">20s</span></div>' +
      '<button class="flee-btn" id="flee-btn" title="' + leaveLabel + '">' + (leaveLabel === "逃跑" ? "\u{1F3C3} " : "") + leaveLabel + '</button>' +
    '</div>' +
    // 双宠对置行：玩家左 / 舞台中 / 敌方右
    '<div class="battle-row">' +
      '<div class="battle-side player-side">' +
        '<div class="pet-sprite player" id="player-sprite">' + p.emoji + '</div>' +
        '<div class="pet-info-card" id="player-info" style="border-left:3px solid ' + pEl.color + '">' +
          '<div class="pet-info-top"><span class="pet-info-name">' + p.name + '</span><span class="pet-info-lv">Lv.' + p.level + '</span><span class="pet-info-element" style="background:' + pEl.bg + ';color:' + pEl.color + '">' + elemIcon(p.element) + pEl.name + '</span></div>' +
          '<div class="battle-bloodline-slot"></div>' +
          '<div class="hp-bar-outer"><div class="hp-bar-ghost" style="width:' + pGhost + '%"></div><div class="hp-bar-inner" id="player-hp-bar" style="width:' + pStart + '%"></div></div>' +
          '<div id="player-shield"></div>' +
          '<div class="hp-text" id="player-hp-text">' + p.hp + '/' + p.maxHp + '</div>' +
          '<div class="marks-display" id="player-marks"></div>' +
          '<div id="player-status"></div>' +
          '<div class="stages-bar" id="player-stages"></div>' +
        '</div>' +
      '</div>' +
      '<div class="battle-stage"><div class="stage-vs">VS</div><div class="battle-ground"></div></div>' +
      '<div class="battle-side enemy-side">' +
        '<div class="pet-sprite opponent" id="ai-sprite">' + a.emoji + '</div>' +
        '<div class="pet-info-card" id="ai-info" style="border-left:3px solid ' + aEl.color + '">' +
          '<div class="pet-info-top"><span class="pet-info-name">' + a.name + '</span><span class="pet-info-lv">Lv.' + a.level + '</span><span class="pet-info-element" style="background:' + aEl.bg + ';color:' + aEl.color + '">' + elemIcon(a.element) + aEl.name + '</span></div>' +
          '<div class="battle-bloodline-slot"></div>' +
          '<div class="hp-bar-outer"><div class="hp-bar-ghost" style="width:' + aGhost + '%"></div><div class="hp-bar-inner" id="ai-hp-bar" style="width:' + aStart + '%"></div></div>' +
          '<div id="ai-shield"></div>' +
          '<div class="hp-text" id="ai-hp-text">' + a.hp + '/' + a.maxHp + '</div>' +
          '<div class="marks-display" id="ai-marks"></div>' +
          '<div id="ai-status"></div>' +
          '<div class="stages-bar" id="ai-stages"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    // 底部战斗台：日志左 / 技能面板右
    '<div class="battle-bottom">' +
      '<div class="battle-log"><div class="log-tools">' + logTools +
      '<button class="log-copy" id="log-copy">复制</button></div><div class="battle-messages' + (fullLog ? " developer-log" : "") +
      '" id="battle-messages"' + logAttributes + '></div><button class="log-jump" id="log-jump" hidden>回到最新</button></div>' +
      '<div class="battle-panel"><div class="battle-actions" id="battle-actions"></div></div>' +
    '</div>' +
    // 替换面板
    '<div class="switch-panel" id="switch-panel"><div style="font-size:13px;color:var(--text2);text-align:center;margin-bottom:4px;">选择替换的宠物：</div><div id="switch-list"></div><button class="btn btn-secondary btn-small" id="switch-cancel">取消</button></div>' +
    '</div>' +
    '<div class="result-overlay" id="result-overlay"><div class="result-emoji" id="result-emoji"></div><div class="result-text" id="result-text"></div><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;"><button class="btn btn-secondary" id="result-close">\u{1F4CB} 继续查看</button><button class="btn btn-primary" id="result-back">\u{1F519} 返回主菜单</button></div></div>';
  app.innerHTML = html;
  const logPlaceholder = document.querySelector("#battle-messages");
  if (fullLog && oldLog && logPlaceholder !== oldLog) logPlaceholder?.replaceWith?.(oldLog);
  var jumpBtn = document.querySelector("#log-jump");
  if (jumpBtn) jumpBtn.addEventListener("click", function() { var mm = document.querySelector("#battle-messages"); if (mm) mm.scrollTop = mm.scrollHeight; jumpBtn.hidden = true; });
  Array.prototype.forEach.call(document.querySelectorAll(".log-tab"), function(b) {
    b.addEventListener("click", function() { gameState.logFilter = b.getAttribute("data-filter"); updateBattleUI(); });
  });
  var copyBtn = document.querySelector("#log-copy");
  if (copyBtn) copyBtn.addEventListener("click", copyBattleLog);
  var msgsEl = document.querySelector("#battle-messages");
  if (fullLog && msgsEl) msgsEl.onscroll = function() {
    if (jumpBtn) jumpBtn.hidden = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 40;
  };
  if (!fullLog && msgsEl) msgsEl.addEventListener("click", function(e) {
    var t = e.target && e.target.closest ? e.target.closest(".msg.turn") : null;
    if (!t) return;
    var tn = t.getAttribute("data-turn");
    gameState.logCollapsed = gameState.logCollapsed || {};
    gameState.logCollapsed[tn] = !gameState.logCollapsed[tn];
    updateBattleUI();
  });
  if (previousPlayer && pStart !== hpPercent(p)) battleVisual.player.hp = pStart;
  if (previousAi && aStart !== hpPercent(a)) battleVisual.ai.hp = aStart;
  void app.offsetWidth;
  renderBattleActions();
  updateBattleUI();
  if (previousPlayer && pGhost !== hpPercent(p)) { var pg = document.querySelector("#player-hp-bar").parentNode.querySelector(".hp-bar-ghost"); if (pg) pg.style.width = hpPercent(p) + "%"; }
  if (previousAi && aGhost !== hpPercent(a)) { var ag = document.querySelector("#ai-hp-bar").parentNode.querySelector(".hp-bar-ghost"); if (ag) ag.style.width = hpPercent(a) + "%"; }
  if (oldLog) { var newLog = document.querySelector("#battle-messages"); if (newLog) { newLog.scrollTop = logBottom ? newLog.scrollHeight : logTop; var jump = document.querySelector("#log-jump"); if (jump) jump.hidden = logBottom; } }
  if (sameBattle && !prefersReducedMotion()) {
    [previousPlayer ? null : "#player-sprite", previousAi ? null : "#ai-sprite"].forEach(function(selector) {
      var sprite = selector && document.querySelector(selector);
      if (sprite) enterBattleSprite(sprite);
    });
  }
  ["result-overlay", "switch-panel"].forEach(function(id) {
    var layer = document.getElementById(id);
    prepareLayer(layer, function() { layer.classList.remove("show", "closing"); });
  });
  document.querySelector("#result-back").addEventListener("click", function() { showScreen("menu"); });
  document.querySelector("#result-close").addEventListener("click", function() { var layer = document.querySelector("#result-overlay"); if (!layer.layerIsOpen()) return; layer.querySelectorAll("button").forEach(function(button) { button.disabled = true; }); layer.closeLayer(); var act = document.querySelector("#battle-actions"); if (act) act.innerHTML = "<div style=text-align:center;padding:16px;color:var(--text2);font-size:13px>战斗已结束，可滚动上方日志回顾战况</div>"; });
  document.querySelector("#switch-cancel").addEventListener("click", function() { if (!gameState.waitingForSwitch) return; gameState.waitingForSwitch = false; var panel = document.querySelector("#switch-panel"); panel.querySelectorAll("button").forEach(function(button) { button.disabled = true; }); panel.closeLayer(); startTurnTimer(); });
  document.querySelector("#flee-btn").addEventListener("click", function() {
    if (fullLog && gameState.battleOver) showScreen("menu");
    else showFleeConfirm();
  });
}

// ========== 逃跑确认弹窗 ==========
function showFleeConfirm() {
  closeBloodlinePreview();
  var old = document.getElementById('flee-overlay');
  if (old && old.layerIsOpen && old.layerIsOpen()) return;
  removeBodyLayer('flee-overlay');
  var ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.id = 'flee-overlay';
  ov.innerHTML = '<div class="modal"><h3>\u{1F3C3} 逃跑确认</h3><p style="text-align:center;color:var(--text2);margin-bottom:16px;line-height:1.8;">确定要逃跑吗？<br>' + (isDeveloperBattle() ? "结束测试后可继续查看完整日志。" : "本次战斗进度将不会保留。") + '</p><div class="form-actions"><button class="btn btn-secondary" id="flee-cancel">取消</button><button class="btn btn-danger" id="flee-confirm">确认逃跑</button></div></div>';
  document.body.appendChild(ov);
  var trigger = document.activeElement, version = uiPageVersion;
  prepareLayer(ov, function(restore) { ov.remove(); if (restore && version === uiPageVersion && trigger && trigger.isConnected !== false && trigger.focus) trigger.focus(); });
  function cancel() { if (!ov.layerIsOpen()) return; ov.querySelector("#flee-confirm").disabled = true; ov.closeLayer(); }
  ov.querySelector("#flee-cancel").addEventListener("click", cancel);
  ov.querySelector("#flee-confirm").addEventListener("click", function() {
    if (!ov.layerIsOpen()) return;
    ov.closeLayer(true);
    gameState.pendingPlayerAction = null;
    gameState.pendingPlayerSkill = null;
    gameState.pendingAISkill = null;
    if (isDeveloperBattle()) { endBattle(false, true); return; }
    gameState.battleOver = true;
    stopTurnTimer();
    showScreen("menu");
  });
  ov.addEventListener("click", function(e) { if (e.target === ov) cancel(); });
}

function renderBattleActions() { if (!canSubmitPlayerAction()) return; var container = document.querySelector("#battle-actions"); if (!container) return; var oldList = container.querySelector(".battle-skill-list"); if (oldList) battleVisual.skillScroll = oldList.scrollLeft; container.innerHTML = ""; var player = gameState.playerActive; if (!player || player.isFainted()) return;
  // 异常状态可自动跳过；没有可选技能时仍可通过换宠或空过行动。
  const noAvailableSkill = !player.skills.some(canSelectSkill);
  if (["sleep", "deep_sleep", "freeze", "fear"].includes(player.status) && !noAvailableSkill) {
    var reason = (player.status==="sleep"?"正在睡觉":player.status==="deep_sleep"?"正在沉睡":player.status==="freeze"?"被冰冻":player.status==="fear"?"被恐惧":player.status==="paralyze"?"麻痹无法行动":"无法行动");
    document.querySelector("#battle-actions").innerHTML = "<div style=text-align:center;padding:20px;color:var(--text2);font-size:14px>"+player.name+reason+"<br>自动跳过...</div>";
    stopTurnTimer();
    const battleId = gameState.battleId;
    gameState.autoSkipTimer = setTimeout(function() {
      if (!canSubmitPlayerAction() || gameState.battleId !== battleId || gameState.playerActive !== player) return;
      submitPlayerAction(null);
    }, 800);
    return;
  }
  startTurnTimer();
  var skillList = document.createElement('div'); skillList.className = 'battle-skill-list';
  skillList.setAttribute('aria-label', '出战技能，按第一至第四格排列');
  var utilities = document.createElement('div'); utilities.className = 'battle-utility-list';
  container.appendChild(skillList); container.appendChild(utilities);
  player.skills.forEach(function(skill, idx) {
    const element = getEffectiveSkillElement(player, skill.element);
    const displaySkill = element === skill.element ? skill : { ...skill, element };
    var el = ELEMENTS[element] || {color: '#a6b0c1',bg: 'transparent'};
    var prio = getSkillPriority(skill), prioStr = prio > 8 ? '+' + (prio-8) : prio < 8 ? '-' + (8-prio) : '±0';
    var card = document.createElement('div'); card.className = 'skill-card';
    var btn = document.createElement('button');
    const sealed = isSkillSealed(skill, gameState.turnCount + 1);
    btn.disabled = !canSelectSkill(skill);
    btn.className = 'skill-btn' + (btn.disabled ? ' no-pp' : '');
    btn.style.setProperty('--el',el.color);
    var slotNumber = idx + 1;
    btn.setAttribute('aria-label', '第' + slotNumber + '格：使用' + skill.name + '，剩余' + skill.pp + 'PP' + (skill.passiveLabel ? '，' + skill.passiveLabel : '') + (sealed ? '，封技' : ''));
    btn.innerHTML = '<div class="skill-btn-header"><div class="skill-btn-icon" style="background:' + el.bg + '">' + getSkillIcon(displaySkill) + '</div><div class="skill-btn-name">' + escapeHtml(skill.name) + '</div><div class="skill-btn-prio ' + (prio > 8 ? 'fast' : prio < 8 ? 'slow' : 'normal') + '">' + prioStr + '</div></div><div class="skill-btn-body"><span class="skill-power">' + (sealed ? '封技' : skill.power ? '威力 ' + Math.round(getSkillPower(skill,skill.power)*100)/100 : '变化') + '</span>' + renderSkillPassiveTag(skill) + '<span class="skill-pp-info"><span class="' + (skill.pp/skill.maxPp < .3 ? 'pp-empty' : '') + '">' + skill.pp + '</span> / ' + skill.maxPp + ' PP</span></div>';
    btn.addEventListener('click', function() { btn.classList.add('pressed'); btn.classList.add('selected'); playerUseSkill(idx); });
    var slot = document.createElement('span');
    slot.className = 'skill-slot-label skill-order'; slot.textContent = String(slotNumber);
    slot.setAttribute('aria-hidden', 'true');
    var info = document.createElement('button'); info.className = 'skill-info'; info.textContent = 'i';
    info.setAttribute('aria-label', '查看' + skill.name + '的技能详情');
    info.addEventListener('click', function() { showSkillDetail(displaySkill,info); });
    card.appendChild(btn); card.appendChild(slot); card.appendChild(info); skillList.appendChild(card);
  });
  if (noAvailableSkill) {
    var pass = document.createElement('button'); pass.className = 'action-btn'; pass.id = 'battle-pass'; pass.textContent = '跳过回合';
    pass.addEventListener('click', function() { if (canSubmitPlayerAction() && !gameState.waitingForSwitch) submitPlayerAction(null); });
    utilities.appendChild(pass);
  }
  var swBtn = document.createElement('button'); swBtn.className = 'action-btn';
  if (player.bindTurns > 0) { swBtn.textContent = '🔒 束缚中'; swBtn.disabled = true; }
  else if (hasSwitchLock(player)) { swBtn.textContent = '🔒 换宠锁定'; swBtn.disabled = true; }
  else { swBtn.textContent = '↔ 换宠'; swBtn.addEventListener('click', showSwitchPanel); }
  utilities.appendChild(swBtn);
  skillList.scrollLeft = battleVisual.skillScroll || 0;
}

function showSwitchPanel() { if (!canSubmitPlayerAction() || gameState.waitingForSwitch) return; var panel = document.querySelector("#switch-panel"), list = document.querySelector("#switch-list"); if (!panel || !list) return; gameState.waitingForSwitch = true; if (panel.closeLayer) panel.closeLayer(true); prepareLayer(panel, function() { panel.classList.remove("show", "closing"); }); document.querySelector("#switch-cancel").disabled = false; panel.classList.add("show"); list.innerHTML = ""; gameState.playerParty.forEach(function(pet, idx) { if (pet === gameState.playerActive) return; var btn = document.createElement("button"); btn.className = "switch-pet-btn" + (pet.isFainted() ? " fainted" : ""); btn.disabled = pet.isFainted(); var hpPct = Math.max(0, (pet.hp / pet.maxHp) * 100); var hpCls = hpPct < 25 ? " critical" : hpPct < 50 ? " low" : ""; var stBadges = renderAbnormalBadges(pet); btn.innerHTML = '<span class="switch-emoji">' + pet.emoji + '</span><div class="switch-pet-info"><span style="font-weight:700">' + pet.name + ' <span style="font-size: 12px;color:var(--text2)">Lv.' + pet.level + '</span></span><div class="switch-pet-hpwrap"><div class="switch-pet-hpbar"><div class="switch-pet-hpfill' + hpCls + '" style="width:' + hpPct + '%"></div></div><span style="font-size: 12px;color:var(--text2)">' + pet.hp + '/' + pet.maxHp + '</span></div><div class="switch-pet-status">' + stBadges + '</div></div>'; btn.addEventListener("click", function() { playerSwitch(idx); }); list.appendChild(btn); }); }

// ---------- SKILL DETAIL (完整机制展示) ----------
function renderSkillPassiveTag(skill) {
  return skill.passiveLabel ? '<span class="skill-passive-tag">' + escapeHtml(skill.passiveLabel) + '</span>' : "";
}
var CATEGORY_NAMES = { physical: "物理", special: "魔法", status: "变化" };
function skillMetaText(skill) {
  const elementLabel = skill.element === null ? "无属系" : (ELEMENTS[skill.element]?.name || "?") + "系";
  var acc = skill.semiSure ? "半必中" : (skill.accuracy >= 100 ? "必中" : (skill.accuracy || 100) + "%");
  var parts = [elementLabel, CATEGORY_NAMES[skill.category] || skill.category, skill.maxPp + "PP", "先手" + fmtPriority(getSkillPriority(skill)), acc];
  if (skill.power) parts.push("基础威力 " + Math.round(getSkillPower(skill, skill.power) * 100) / 100);
  return parts.join(" · ");
}
function showSkillDetail(skill, trigger) {
  if (!skill) return;
  closeBloodlinePreview();
  var old = document.getElementById('skill-detail-overlay');
  if (old) { if (old.closeLayer) old.closeLayer(true); else old.remove(); }
  var returnFocus = trigger || document.activeElement;
  var ov = document.createElement('div'); ov.className = 'modal-overlay show'; ov.id = 'skill-detail-overlay';
  var builtin = DEFAULT_SKILLS.find(function(s) { return s.id === skill.id; });
  const original = gameState.screen === "battle" && Object.hasOwn(ORIGINAL_SKILL_TEXT, skill.id)
    ? ORIGINAL_SKILL_TEXT[skill.id] : undefined;
  const bodyLabel = original === undefined ? '技能机制正文' : '技能原文';
  let description = original === undefined
    ? escapeHtml(skill.detail || skill.desc || '暂无说明')
    : '<span class="skill-detail-original">' + escapeHtml(original) + '</span>';
  if (skill.bloodlineDetail) description = '<strong class="skill-bloodline-detail">' + escapeHtml(skill.bloodlineDetail) + '</strong>\n\n' + description;
  if (original === undefined && builtin && skill.detail && skill.desc && skill.desc !== builtin.desc) description = escapeHtml(skill.desc) + '\n\n' + description;
  ov.innerHTML = '<div class="modal skill-detail" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title"><h3 id="skill-detail-title">' + escapeHtml(skill.name) + '</h3><div class="skill-detail-meta">' + skillMetaText(skill) + (skill.passiveLabel ? ' · ' + renderSkillPassiveTag(skill) : '') + '</div><div class="skill-detail-body" tabindex="0" aria-label="' + bodyLabel + '">' + description + '</div><div class="form-actions"><button class="btn btn-secondary" id="skill-detail-close">关闭</button></div></div>';
  document.body.appendChild(ov);
  var version = uiPageVersion;
  prepareLayer(ov, function(restore) {
    document.removeEventListener('keydown', onKey); ov.remove();
    if (restore && uiPageVersion === version && returnFocus && returnFocus.isConnected !== false && returnFocus.focus) returnFocus.focus();
  });
  function close() { ov.closeLayer(); }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      var items = ov.querySelectorAll('button:not([disabled]), [tabindex="0"]'), first = items[0], last = items[items.length-1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  ov.querySelector('#skill-detail-close').addEventListener('click', function() { close(); });
  ov.addEventListener('click', function(e) { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey);
  ov.querySelector('#skill-detail-close').focus();
}

