// ---------- WEATHER SYSTEM ----------
function processField() {
  if (gameState.field && gameState.fieldTurns <= 0) {
    addMessage((FIELD_DISPLAY[gameState.field]?.[1] || gameState.field) + "环境已结束。", "system");
    gameState.field = null;
  }
}

// 天气/环境计时在回合末统一递减，保证"持续 N 回合"恰好结算 N 次
function tickEnvironments() {
  [gameState.playerActive, gameState.aiActive].forEach(function(pet) {
    if (!pet) return;
    if (pet.damageCapTurns > 0) pet.damageCapTurns--;
    if (pet.damageReductionTurns > 0) pet.damageReductionTurns--;
    if (pet.healInvertTurns > 0) pet.healInvertTurns--;
  });
  if (gameState.weather) {
    gameState.weatherTurns--;
    if (gameState.weatherTurns <= 0) {
      addMessage((WEATHER_DISPLAY[gameState.weather]?.[1] || gameState.weather) + "天气已结束。", "system");
      gameState.weather = null;
      gameState.weatherTurns = 0;
    }
  }
  if (gameState.field) {
    gameState.fieldTurns--;
    if (gameState.fieldTurns <= 0) {
      gameState.fieldTurns = 0;
      processField();
    }
  }
  if (gameState.forceSkillElement) {
    gameState.forceSkillElementTurns--;
    if (gameState.forceSkillElementTurns <= 0) {
      gameState.forceSkillElement = null; gameState.forceSkillElementTurns = 0;
      if (gameState.jianghuaBuff && gameState.jianghuaBuff.active) {
        gameState.jianghuaBuff.active = false;
        [gameState.playerParty, gameState.aiParty].forEach(function(party) {
          (party || []).forEach(function(pet) {
            pet.healMod = Math.max(0, (pet.healMod || 1) - 1.0);
            pet.dmgMod = Math.max(0, (pet.dmgMod || 1) - 1.0);
          });
        });
      }
      addMessage("降华的光系同调消散了...");
    }
  }
}

function processWeather() {
  if (!gameState.weather || gameState.weatherTurns <= 0) return;
  var p = gameState.playerActive, a = gameState.aiActive;
  switch(gameState.weather) {
    case "sandstorm":
      [p,a].forEach(function(pet) {
        if (pet && !pet.isFainted() && ["earth","steel","rock"].indexOf(pet.element) < 0) {
          addMessage("沙暴侵袭" + battlePetName(pet) + "！", "status", battlePetSide(pet));
          createBattleContext().doFixedDamage(pet, Math.floor(pet.maxHp / 16));
        }
      });
      break;
    case "hailstorm":
      [p,a].forEach(function(pet) {
        if (pet && !pet.isFainted() && pet.element !== "ice") {
          addMessage("冰雹砸落" + battlePetName(pet) + "！", "status", battlePetSide(pet));
          createBattleContext().doFixedDamage(pet, Math.floor(pet.maxHp / 16));
        }
      });
      break;
  }
}

function getWeatherDamageMod(atkEl, defEl) {
  if (!gameState.weather) return 1.0;
  switch(gameState.weather) {
    case "sunny": return atkEl === "fire" ? 1.5 : atkEl === "water" ? 0.5 : 1.0;
    case "rainy": return atkEl === "water" ? 1.5 : atkEl === "fire" ? 0.5 : 1.0;
    default: return 1.0;
  }
}

function hasPowerDamageImmunity(pet) {
  return pet.powerDamageImmuneThroughTurn >= gameState.turnCount;
}

