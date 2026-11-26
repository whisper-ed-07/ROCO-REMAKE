// ---------- TURN TIMER ----------
var TURN_TIME_LIMIT = 20;
function startTurnTimer() {
  stopTurnTimer();
  if (!canSubmitPlayerAction() || gameState.waitingForSwitch) return;
  const battleId = gameState.battleId;
  gameState.turnTimeLeft = TURN_TIME_LIMIT;
  var td = document.querySelector("#turn-timer");
  var fill = document.querySelector("#turn-timer-fill");
  var txt = document.querySelector("#turn-timer-text");
  if (td) td.style.display = "flex";
  gameState.turnTimer = setInterval(function() {
    gameState.turnTimeLeft--;
    if (fill) {
      var pct = (gameState.turnTimeLeft / TURN_TIME_LIMIT) * 100;
      fill.style.width = pct + "%";
      fill.className = "turn-timer-fill" + (pct < 10 ? " danger" : pct < 20 ? " warning" : "");
    }
    if (txt) txt.textContent = gameState.turnTimeLeft + "s";
    if (gameState.turnTimeLeft <= 0) {
      clearInterval(gameState.turnTimer);
      if (td) td.style.display = "none";
      if (!canSubmitPlayerAction() || gameState.waitingForSwitch || gameState.battleId !== battleId) return;
      const player = gameState.playerActive;
      if (!player || player.isFainted()) return;
      const skillIdx = player.skills.findIndex(canSelectSkill);
      if (skillIdx >= 0) playerUseSkill(skillIdx);
      else submitPlayerAction(null);
    }
  }, 1000);
}
