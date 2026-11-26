// ---------- BATTLE UI ----------
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

