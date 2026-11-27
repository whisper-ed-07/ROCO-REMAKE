// ---------- TURN TIMER ----------
var TURN_TIME_LIMIT = 20;
function startTurnTimer() {
  if (!canSubmitPlayerAction()) return;
  if (gameState.turnTimer !== null && gameState.turnTimer !== undefined) {
    renderTurnTimer();
    return;
  }
  const battleId = gameState.battleId;
  const round = gameState.turnCount;
  const deadline = Date.now() + TURN_TIME_LIMIT * 1000;
  gameState.turnTimeLeft = TURN_TIME_LIMIT;
  renderTurnTimer();
  const timer = setInterval(function() {
    if (gameState.turnTimer !== timer || gameState.battleId !== battleId || gameState.turnCount !== round) {
      clearInterval(timer);
      return;
    }
    gameState.turnTimeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    renderTurnTimer();
    if (gameState.turnTimeLeft > 0) return;
    stopTurnTimer();
    if (!canSubmitPlayerAction()) return;
    const player = gameState.playerActive;
    if (!player || player.isFainted()) return;
    if (gameState.waitingForSwitch) {
      gameState.waitingForSwitch = false;
      battlePresentation.switchSelected?.();
    }
    const available = player.skills.filter(canSelectSkill);
    if (!available.length) { submitPlayerAction(null); return; }
    const move = available[Math.floor(Math.random() * available.length)];
    addMessage("选招超时，随机选中「" + move.name + "」。");
    playerUseSkill(player.skills.indexOf(move));
  }, 1000);
  gameState.turnTimer = timer;
}

function renderTurnTimer() {
  const timer = document.querySelector("#turn-timer");
  const fill = document.querySelector("#turn-timer-fill");
  const text = document.querySelector("#turn-timer-text");
  if (timer) timer.style.display = "flex";
  if (fill) {
    const pct = gameState.turnTimeLeft / TURN_TIME_LIMIT * 100;
    fill.style.width = pct + "%";
    fill.className = "turn-timer-fill" + (pct < 10 ? " danger" : pct < 20 ? " warning" : "");
  }
  if (text) text.textContent = gameState.turnTimeLeft + "s";
}
