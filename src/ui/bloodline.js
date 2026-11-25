// ---------- BATTLE UI ----------
// 正文逐字摘自 pets/*.txt 的血脉段落，内嵌以便本地单文件运行。
const BLOODLINE_ORIGINALS = {
  pet_qingling: `获得（5*双方阵亡宠物数）%减伤，max=（60-双方存活宠物数）%，每次双方同时使用变化技能或威力技能时，自身获得（双方使用技能先手值）点“微灵”印记，max=（100+双方技能PP为空数*20）（此处max仅代表此项效果所获取的上限，下同）
①.每次使用威力技能后判定
⑴若使用技能先手
删除对方全体技能1PP，追加（30+双方正负面强化数*20+自身8%最大精力值）点固伤
⑶若使用技能后手
倒置对方下次治疗（多段治疗取最高），并且删除对方先手使用技能3PP
②.每次使用变化技能后
额外回复200点精力值.若使用技能PP≤4，则恢复威力技能2PP，额外倒置对方治疗2回合`,
  pet_jydm: `（1）：携带技能分别使用1次后（若极尽降华PP为空，则分别使用其余技能1次即可触发），标记对方4回合并将自身技能使用次数清零。若标记回合内再次触发，则重新标记且标记回合增加1回合（无上限，每次叠加回合后自身获得一层光明之印）（标记光明之印数量为m）
（2）：标记回合内，获得（15m+50）点精力上限增幅与15%治疗与输出加成，增加5%速度能力值，并且免疫控制效果以及魔攻与速度类负面强化，每回合恢复全体技能1PP,每次造成伤害都会追加（40+15*双方所有强化数）点固定伤害
（3）“降华”回合内，携带的技能使用1次即可触发“明念”，（2）的精力上限增幅额外增加100点.处于降华的第1回合时，自身免疫一切伤害与效果（正/负面效果）.期间场上锁定为无天气/环境效果，对强行召唤3次的敌方宠物造成999点固伤`,
  pet_qy: `每次上场后，都会视首格技能为清翎覆尘/残风临霜进入清念状态/残脉状态，获得相应血脉，此后每隔5回合进入持续1回合的血脉切换期，血脉切换回合内单独回复99点精力，若期间使用翼系/冰系技能即可将血脉切换至清念/残脉
若判定失败或未携带2技能中的任意1个，则只获得以下效果
永久免疫异常，获得20%威力伤害减免与固定伤害减免
以下为血脉具体效果
清念
①每回合治疗双方，具体值为：（60+10%最大精力+清风之念层数*40+0.1*双方速度差+清翎覆尘PP损失数*50），每治疗2次后就会获得1层清风之念
②使用任意技能（包括清翎覆尘）若PP值低于最大值的30%，都会消耗“清风之念”回复满该技能PP.回复PP损耗至20%以下或最大PP值＜4的技能，需消耗所有清风之念”，反之，则消耗（PP损耗数-3）层，最少消耗0层
③每次使用翼系技能后
⑴.在3回合内免疫异常状态与负面强化，若使用技能PP＜8，还会净化自身并且回复除清翎覆尘外的所有技能1PP
⑵.在3回合内降低25%速度，获得30%所有类型伤害减免，持续4回合（仅在清翎覆尘PP=0时可叠加，最多叠加2次）
⑶.在4回合内每回合回复自身10%最大精力，对敌方治疗，具体值为（0.2*双方已损精力）
上述数值均向上取整
残脉
①每回合对双方造成（0.3*自身上回合所受所有伤害中最高的2段总值+50*自身PP为空技能数）点固定伤害，若对方拥有减/限伤，则只触发：治疗对方，具体值为（0.3*自身上回合所受所有伤害总值+30+50*本回合主被动使用技能次数），若自身精力值＜500且残凤临霜PP≠4，则倒置本次治疗
②自身每次受到伤害后，若精力值＞200，则在伤害结算完毕后回复30%最大精力，
②每次使用冰系技能后
⑴.在2回合内免疫异常状态（可叠加），若使用技能PP值≤4，则净化自身并回复300点精力值，每次使用间隔若小于2回合，则降低30%回复效果
⑵.删除对方全体技能1PP，若使用技能PP值=1，则额外删除全体技能（3+双方正负面强化等级*2）点PP，此后清除（强制）双方正负面强化`,
  pet_bmhs: `①每回合在受到第n段伤害后恢复（30-4n）%已损精力值，若有任意一段伤害>自身当前精力值，则在全部伤害结算完毕后保留1点精力并将自身驱逐，同时减少全体技能4PP
②每次受到固定伤害时，先反转此伤害的30%为治疗，再受到伤害.受到威力伤害时，令其无法暴击且使对方在下回合无法回复PP
③在②的基础上，若受到克制伤害，则降低40%`
};

const BLOODLINE_TEMP_RULES = {
  pet_qy: "当前裁定中，低 PP 回满至少消耗 1 层清风之念。清念沉脉清空后直到自身结算，跳过血脉的两种 PP 回复。",
  pet_bmhs: "当前裁定中，有存活后备且能成功驱逐时，才保留 1 点精力并扣除 PP。"
};

let bloodlinePreview = null;
let bloodlineHover = null;

function cancelBloodlineHover(trigger) {
  if (!bloodlineHover || (trigger && bloodlineHover.trigger !== trigger)) return;
  clearTimeout(bloodlineHover.timer);
  bloodlineHover = null;
}

function closeBloodlinePreview(restoreFocus = false) {
  cancelBloodlineHover();
  const view = bloodlinePreview;
  if (!view) return;
  if (restoreFocus && view.panel.contains(document.activeElement) && view.trigger.isConnected) {
    view.trigger.focus({ preventScroll: true });
  }
  bloodlinePreview = null;
  clearTimeout(view.dismissTimer);
  view.trigger.setAttribute("aria-expanded", "false");
  view.trigger.removeAttribute("aria-controls");
  view.panel.remove();
  document.removeEventListener("pointerdown", view.onOutside);
  document.removeEventListener("keydown", view.onKey);
  window.removeEventListener("resize", view.place);
  window.removeEventListener("scroll", view.place);
}

function dismissBloodlinePreviewSoon(trigger) {
  const view = bloodlinePreview;
  if (!view || view.trigger !== trigger || view.pinned) return;
  clearTimeout(view.dismissTimer);
  view.dismissTimer = setTimeout(function() {
    if (bloodlinePreview !== view || view.panel.contains(document.activeElement)) return;
    if (trigger === document.activeElement && trigger.matches(":focus-visible")) return;
    closeBloodlinePreview();
  }, 160);
}

function showBloodlinePreview(trigger, name, original, ruling) {
  if (!trigger.isConnected || gameState.screen !== "battle") return;
  if (bloodlinePreview && bloodlinePreview.trigger === trigger) {
    clearTimeout(bloodlinePreview.dismissTimer);
    return bloodlinePreview;
  }
  closeBloodlinePreview();

  const panel = document.createElement("section");
  panel.className = "bloodline-preview";
  panel.id = "battle-bloodline-preview";
  panel.tabIndex = -1;
  panel.setAttribute("aria-labelledby", "battle-bloodline-preview-title");
  const title = document.createElement("h3");
  title.id = "battle-bloodline-preview-title";
  title.textContent = name;
  const body = document.createElement("pre");
  body.className = "bloodline-preview-body";
  body.textContent = original;
  panel.appendChild(title);
  if (ruling) {
    const update = document.createElement("p");
    update.className = "bloodline-preview-ruling";
    update.textContent = ruling;
    panel.appendChild(update);
  }
  panel.appendChild(body);
  document.body.appendChild(panel);
  trigger.setAttribute("aria-expanded", "true");
  trigger.setAttribute("aria-controls", panel.id);

  const view = { trigger, panel, pinned: false };
  bloodlinePreview = view;
  view.place = function() {
    const anchor = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (!trigger.isConnected || anchor.bottom <= 0 || anchor.top >= viewportHeight) {
      closeBloodlinePreview();
      return;
    }
    const gutter = 12, gap = 8;
    const below = viewportHeight - anchor.bottom - gap - gutter;
    const above = anchor.top - gap - gutter;
    const openBelow = below >= 180 || below >= above;
    const space = openBelow ? below : above;
    const maxHeight = Math.min(420, space >= 120 ? space : viewportHeight - 2 * gutter);
    panel.style.maxWidth = viewportWidth - 2 * gutter + "px";
    panel.style.maxHeight = maxHeight + "px";
    const left = Math.min(anchor.left, viewportWidth - gutter - panel.offsetWidth);
    const top = openBelow ? anchor.bottom + gap : anchor.top - gap - panel.offsetHeight;
    panel.style.left = Math.max(gutter, left) + "px";
    panel.style.top = Math.max(gutter, Math.min(top, viewportHeight - gutter - panel.offsetHeight)) + "px";
  };
  view.onOutside = function(event) {
    if (!panel.contains(event.target) && !trigger.contains(event.target)) closeBloodlinePreview();
  };
  view.onKey = function(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeBloodlinePreview(true);
    }
  };
  panel.addEventListener("pointerenter", () => clearTimeout(view.dismissTimer));
  panel.addEventListener("pointerleave", () => dismissBloodlinePreviewSoon(trigger));
  panel.addEventListener("focusout", function(event) {
    if (event.relatedTarget && event.relatedTarget !== trigger && !panel.contains(event.relatedTarget)) closeBloodlinePreview();
  });
  document.addEventListener("pointerdown", view.onOutside);
  document.addEventListener("keydown", view.onKey);
  window.addEventListener("resize", view.place);
  window.addEventListener("scroll", view.place, { passive: true });
  view.place();
  return bloodlinePreview === view ? view : null;
}

function syncQingyuBloodlineMode(entry, pet) {
  // 原初血脉没有清念或残脉形态，保持两段名称为中性色。
  const mode = pet.bloodlineData?.modeEntered ? pet.bloodlineData.mode : "";
  if (entry.dataset.mode === mode) return;
  entry.dataset.mode = mode;
  entry.setAttribute("aria-label", mode ? "血脉 清念/残脉，当前" + mode : "血脉 清念/残脉");
}

function syncBattleBloodline(slot, pet) {
  if (!slot) return;
  if (slot.bloodlinePet === pet) {
    if (slot.qingyuBloodline) syncQingyuBloodlineMode(slot.qingyuBloodline, pet);
    return;
  }
  slot.bloodlinePet = pet;
  slot.qingyuBloodline = null;
  if (bloodlinePreview && slot.contains(bloodlinePreview.trigger)) closeBloodlinePreview();
  if (bloodlineHover && slot.contains(bloodlineHover.trigger)) cancelBloodlineHover();
  slot.innerHTML = "";
  if (!pet.bloodline || !pet.bloodline.name) return;

  const name = pet.bloodline.name;
  const original = Object.hasOwn(BLOODLINE_ORIGINALS, pet.id) ? BLOODLINE_ORIGINALS[pet.id] : "";
  const entry = document.createElement(original ? "button" : "span");
  entry.className = "battle-bloodline-chip";
  const label = document.createElement("span");
  label.className = "battle-bloodline-label";
  label.textContent = "血脉";
  const value = document.createElement("strong");
  if (pet.id === "pet_qy" && name === "清念/残脉") {
    for (const part of ["清念", "/", "残脉"]) {
      const fragment = document.createElement("span");
      fragment.textContent = part;
      if (part !== "/") {
        fragment.className = "qingyu-bloodline-form";
        fragment.dataset.form = part;
      }
      value.appendChild(fragment);
    }
    slot.qingyuBloodline = entry;
    syncQingyuBloodlineMode(entry, pet);
  } else {
    value.textContent = name;
  }
  entry.appendChild(label);
  entry.appendChild(value);
  slot.appendChild(entry);
  if (!original) return;

  entry.type = "button";
  entry.classList.add("battle-bloodline-trigger");
  entry.setAttribute("aria-expanded", "false");
  const open = () => showBloodlinePreview(entry, name, original, BLOODLINE_TEMP_RULES[pet.id]);
  entry.addEventListener("pointerenter", function(event) {
    if (event.pointerType !== "mouse") return;
    if (bloodlinePreview && bloodlinePreview.trigger === entry) {
      clearTimeout(bloodlinePreview.dismissTimer);
      return;
    }
    cancelBloodlineHover();
    bloodlineHover = { trigger: entry, timer: setTimeout(function() {
      bloodlineHover = null;
      open();
    }, 280) };
  });
  entry.addEventListener("pointerleave", function() {
    cancelBloodlineHover(entry);
    dismissBloodlinePreviewSoon(entry);
  });
  entry.addEventListener("focus", function() { if (entry.matches(":focus-visible")) open(); });
  entry.addEventListener("blur", () => dismissBloodlinePreviewSoon(entry));
  entry.addEventListener("click", function() {
    cancelBloodlineHover(entry);
    if (bloodlinePreview && bloodlinePreview.trigger === entry && bloodlinePreview.pinned) {
      closeBloodlinePreview();
      return;
    }
    const view = open();
    if (view) {
      view.pinned = true;
      view.panel.focus({ preventScroll: true });
    }
  });
}

