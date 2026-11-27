let selectedOpponentAIId = SOLO_OPPONENT_AIS[0].id;

function renderOpponentAISelect() {
  const options = SOLO_OPPONENT_AIS.map(ai => '<option value="' + uiAttr(ai.id) + '"' +
    (ai.id === selectedOpponentAIId ? ' selected' : '') + '>' + escapeHtml(ai.name) + '</option>').join('');
  return '<div class="opponent-ai-field"><label for="opponent-ai-select">对手 AI</label>' +
    '<select id="opponent-ai-select">' + options + '</select></div>';
}

function renderTeamChoice(app, opponent) {
  var pets = getAllPets(), selected = opponent ? gameState.opponentTeamIds : gameState.selectedTeamIds;
  var back = opponent ? 'opp-back' : 'team-back', ready = opponent ? 'opp-ready' : 'btn-ready';
  var attr = opponent ? 'data-opp-id' : 'data-pet-id';
  const showAI = opponent && menuMode === "solo";
  var content = '<div class="screen active">' + pageHeader(opponent ? '选择对手宠物（1~6只）' : '选择出战宠物（1~6只）', back) +
    (showAI ? renderOpponentAISelect() : '') + '<div class="pet-grid">';
  pets.forEach(function(pet) { content += petChoiceCard(pet, attr, selected.includes(pet.id)); });
  app.innerHTML = content + '</div><div class="team-ready-bar"><div class="selected-count">已选择 <strong>' + selected.length + '</strong> / 6 只</div><button class="btn btn-primary" id="' + ready + '"' + (selected.length ? '' : ' disabled') + '>' + (opponent ? '确认对手并开战！' : '下一步：选择对手') + '</button></div></div>';
  document.querySelector('#' + back).addEventListener('click', function() { showScreen(opponent ? 'team' : 'menu'); });
  document.querySelector('#' + ready).addEventListener('click', function() { opponent ? confirmOpponentAndBattle() : startBattle(); });
  if (showAI) {
    const picker = app.querySelector("#opponent-ai-select");
    picker.addEventListener("change", () => { selectedOpponentAIId = getSoloOpponentAI(picker.value).id; });
  }
  pets.forEach(function(pet) {
    var card = document.querySelector('[' + attr + '="' + uiAttr(pet.id) + '"]');
    if (card) card.addEventListener('click', function() { opponent ? toggleOpponentSelection(pet.id) : toggleTeamSelection(pet.id); });
  });
}
function renderTeamSelect(app) { renderTeamChoice(app, false); }

function focusPetChoice(attr, petId) {
  document.querySelectorAll('[' + attr + ']').forEach(function(card) {
    if (card.getAttribute(attr) === petId) card.focus({ preventScroll: true });
  });
}
function updateTeamChoice(opponent, petId) {
  var selected = opponent ? gameState.opponentTeamIds : gameState.selectedTeamIds;
  var attr = opponent ? 'data-opp-id' : 'data-pet-id';
  document.querySelectorAll('[' + attr + ']').forEach(function(card) {
    var active = selected.indexOf(card.getAttribute(attr)) >= 0;
    card.classList.toggle('selected', active); card.setAttribute('aria-pressed', String(active));
  });
  var count = document.querySelector('.selected-count strong'); if (count) count.textContent = selected.length;
  var ready = document.getElementById(opponent ? 'opp-ready' : 'btn-ready'); if (ready) ready.disabled = selected.length === 0;
  focusPetChoice(attr, petId);
}
function toggleTeamSelection(petId) { var idx = gameState.selectedTeamIds.indexOf(petId); if (idx >= 0) gameState.selectedTeamIds.splice(idx, 1); else if (gameState.selectedTeamIds.length < 6) gameState.selectedTeamIds.push(petId); updateTeamChoice(false, petId); }

function startBattle() { var allPets = getAllPets(); var playerPets = gameState.selectedTeamIds.map(function(id) { return allPets.find(function(p) { return p.id === id; }); }).filter(Boolean); if (playerPets.length < 1) return; gameState.banEffects = null; gameState.playerParty = playerPets.map(function(p) { return new BattlePet(p); }); gameState.playerActive = gameState.playerParty[0]; gameState.opponentTeamIds = []; showScreen("opponent"); }

function renderOpponentSelect(app) { renderTeamChoice(app, true); }

function toggleOpponentSelection(petId) { var idx = gameState.opponentTeamIds.indexOf(petId); if (idx >= 0) gameState.opponentTeamIds.splice(idx, 1); else if (gameState.opponentTeamIds.length < 6) gameState.opponentTeamIds.push(petId); updateTeamChoice(true, petId); }

function confirmOpponentAndBattle() { var allPets = getAllPets(); var aiPets = gameState.opponentTeamIds.map(function(id) { return allPets.find(function(p) { return p.id === id; }); }).filter(Boolean); if (aiPets.length < 1) return; gameState.aiParty = aiPets.map(function(p) { return new BattlePet(p); }); gameState.aiActive = gameState.aiParty[0]; gameState.messages = []; gameState.turnCount = 0; gameState.snapshots = []; gameState.ppHistory = []; gameState.battleOver = false; gameState.waitingForSwitch = false;
  // 新战斗必须清空上一局残留的天气/环境/全局封锁与待结算指令
  gameState.battleId = (gameState.battleId || 0) + 1;
  gameState.battleMode = menuMode === "developer" ? "developer" : "solo";
  gameState.opponentAIId = gameState.battleMode === "solo" ? getSoloOpponentAI(selectedOpponentAIId).id : null;
  gameState.pendingPlayerAction = null;
  gameState.resolvingTurn = false;
  gameState.weather = null; gameState.weatherTurns = 0;
  gameState.field = null; gameState.fieldTurns = 0;
  gameState.banEffects = null;
  gameState.pendingPlayerSkill = null; gameState.pendingAISkill = null; gameState.pendingFirstMove = null;
  gameState.isPlayerTurn = true;
  // R07：清理上一局残留的降华全局状态与延迟效果
  gameState.forceSkillElement = null; gameState.forceSkillElementTurns = 0;
  gameState.jianghuaBuff = null;
  gameState.jianghuaOwners = new Set();
  delete gameState.fieldLockedThrough;
  gameState.wanguHeals = [];
  gameState.qingnianWindows = {};
  [gameState.playerParty, gameState.aiParty].forEach(function(party) {
    (party || []).forEach(function(pet) { pet.pendingNilex = null; });
  });
  if (isDeveloperBattle()) addMessage("━━━ 战斗开始 ━━━", "turn");
  callBloodlineEnter(gameState.playerActive);
  callBloodlineEnter(gameState.aiActive);
  createBattleContext().saveSnapshot();
  createBattleContext().savePPState();
  stopTurnTimer();
  if (!isDeveloperBattle()) addMessage("━━━ 战斗开始 ━━━", "turn");
  showScreen("battle"); }

