// ---------- SKILL SWAP (局外更换技能) ----------
var swapTargetPetId = null;

function renderSkillSwap(app) {
  var allPets = getAllPets();
  var html = '<div class="screen active">' + pageHeader('局外技能更换', 'swap-back') + '<div class="pet-grid" id="swap-pet-grid">';
  allPets.forEach(function(pet) { html += petChoiceCard(pet, 'data-pet-id'); });

  html += '</div><div id="swap-detail" style="display:none;"></div></div>';
  app.innerHTML = html;
  document.querySelector("#swap-back").addEventListener("click", function() { showScreen("menu"); });
  allPets.forEach(function(pet) {
    var card = document.querySelector('[data-pet-id="' + pet.id + '"]');
    if (card) card.addEventListener("click", function() { openSkillSwap(pet); });
  });
}

// 宠物自有技能：优先 ownedSkillIds，其次内置定义，最后当前技能表
function getOwnedSkillIds(pet) {
  if (typeof pet === "string") pet = getAllPets().find(function(p) { return p.id === pet; }) || {};
  if (Array.isArray(pet.ownedSkillIds) && pet.ownedSkillIds.length) return pet.ownedSkillIds.slice();
  var def = DEFAULT_PETS.find(function(p) { return p.id === pet.id; });
  if (def) return def.skillIds.slice();
  return (pet.skillIds || []).slice();
}

function showSkillLimitNotice(trigger) {
  var app = document.querySelector("#app");
  if (app.inert) return;

  var overlay = document.createElement("div");
  overlay.id = "skill-limit-overlay";
  overlay.className = "modal-overlay show";
  overlay.innerHTML = '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="skill-limit-message">' +
    '<h3 id="skill-limit-message">最多选择 4 个技能出战！</h3>' +
    '<div class="form-actions"><button type="button" class="btn btn-primary" id="skill-limit-confirm">确定</button></div></div>';
  document.body.appendChild(overlay);
  app.inert = true;

  prepareLayer(overlay, function(restoreFocus) {
    overlay.remove();
    app.inert = false;
    if (restoreFocus && trigger && trigger.isConnected !== false) trigger.focus({ preventScroll: true });
  });
  function close() { overlay.closeLayer(); }
  var confirmButton = overlay.querySelector("#skill-limit-confirm");
  confirmButton.addEventListener("click", close);
  overlay.addEventListener("click", function(event) {
    if (event.target === overlay) close();
  });
  overlay.addEventListener("keydown", function(event) {
    if (event.key === "Tab" || event.key === "Escape") event.preventDefault();
    if (event.key === "Escape") close();
  });
  confirmButton.focus({ preventScroll: true });
}

function openSkillSwap(pet, keepDraft) {
  swapTargetPetId = pet.id;
  var detail = document.querySelector("#swap-detail");
  var ownedIds = getOwnedSkillIds(pet);
  if (!keepDraft || !swapDraft || swapDraft.petId !== pet.id) {
    // 旧配置若含非本宠技能，打开时直接剔除
    var sanitized = (pet.skillIds || []).filter(function(id) { return ownedIds.indexOf(id) >= 0; }).slice(0, 4);
    swapDraft = { petId: pet.id, ids: sanitized };
  }
  var equippedIds = swapDraft.ids;
  var allSkills = ownedIds.map(function(id) { return findSkill(id); }).filter(Boolean);
  detail.style.display = "block";
  detail.classList.remove("swap-enter");
  if (!keepDraft && !prefersReducedMotion()) { void detail.offsetWidth; detail.classList.add("swap-enter"); }
  var html = '<div class="pet-detail-card"><h3>' + pet.emoji + ' ' + pet.name + ' 技能配置</h3><div class="skill-swap-list">';
  allSkills.forEach(function(skill) {
    var eqIdx = equippedIds.indexOf(skill.id);
    var isEq = eqIdx >= 0;
    var slotNumber = eqIdx + 1;
    var slot = '<span class="skill-slot' + (isEq ? ' skill-order' : '') + '" aria-hidden="true">' + (isEq ? slotNumber : '—') + '</span>';
    var toggleLabel = isEq ? '第' + slotNumber + '格，卸下' : '装备';
    html += '<div class="skill-swap-item' + (isEq ? " equipped" : "") + '" data-skill-id="' + skill.id + '">' + slot + (isEq ? '<span class="swap-move-group"><button class="swap-move" data-move="left" data-skill="' + skill.id + '"' + (eqIdx === 0 ? ' disabled' : '') + '>\u25C0</button><button class="swap-move" data-move="right" data-skill="' + skill.id + '"' + (eqIdx === equippedIds.length - 1 ? ' disabled' : '') + '>\u25B6</button></span>' : '') + '<button type="button" class="skill-swap-name swap-toggle" aria-pressed="' + isEq + '" aria-label="' + toggleLabel + uiAttr(skill.name) + '" style="color:' + (ELEMENTS[skill.element]||{color:"#888"}).color + '">' + escapeHtml(skill.name) + '</button><span class="swap-info">' + (ELEMENTS[skill.element]||{name:'?'}).name + ' · ' + (skill.power ? skill.power + '威力' : '变化') + ' · ' + skill.maxPp + 'PP' + (skill.passiveLabel ? ' · ' + renderSkillPassiveTag(skill) : '') + '</span><button type="button" class="swap-info-btn" aria-label="查看技能详情">i</button></div>';
  });
  html += '</div><div class="swap-help">已装备 <strong>' + equippedIds.length + ' / 4</strong> 个 · ◀ ▶ 调整顺序</div><button class="btn btn-primary" id="swap-save" style="margin-top:12px;width:100%">保存技能配置</button></div>';
  detail.innerHTML = html;
  // Toggle skill equip
  allSkills.forEach(function(skill) {
    var item = detail.querySelector('[data-skill-id="' + skill.id + '"]');
    var info = item && item.querySelector(".swap-info-btn");
    var toggle = item && item.querySelector(".swap-toggle");
    if (info) info.addEventListener("click", function(ev) { ev.stopPropagation(); showSkillDetail(skill); });
    function toggleSkill() {
      var idx = swapDraft.ids.indexOf(skill.id);
      if (idx < 0 && swapDraft.ids.length >= 4) {
        showSkillLimitNotice(toggle);
        return;
      }
      if (idx >= 0) swapDraft.ids.splice(idx, 1);
      else swapDraft.ids.push(skill.id);
      openSkillSwap(pet, true); // 保留草稿并刷新
      var fresh = detail.querySelector('[data-skill-id="' + uiAttr(skill.id) + '"] .swap-toggle');
      if (fresh) fresh.focus({ preventScroll: true });
    }
    if (item) {
      item.addEventListener('click', toggleSkill);
      if (toggle) toggle.addEventListener('click', function(ev) { ev.stopPropagation(); toggleSkill(); });
    }
  });
  detail.querySelectorAll('.swap-move').forEach(function(btn) {
    btn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var sid = btn.getAttribute('data-skill'), dir = btn.getAttribute('data-move') === 'left' ? -1 : 1;
      var i = swapDraft.ids.indexOf(sid), j = i + dir;
      if (i < 0 || j < 0 || j >= swapDraft.ids.length) return;
      swapDraft.ids.splice(i, 1); swapDraft.ids.splice(j, 0, sid);
      openSkillSwap(pet, true);
      var freshItem = detail.querySelector('[data-skill-id="' + uiAttr(sid) + '"]');
      if (freshItem) {
        var arrow = freshItem.querySelector('[data-move="' + btn.getAttribute('data-move') + '"]');
        var nextFocus = arrow && !arrow.disabled ? arrow : freshItem.querySelector('.swap-toggle');
        if (nextFocus) nextFocus.focus({ preventScroll: true });
      }
    });
  });
  detail.querySelector("#swap-save").addEventListener("click", function() {
    var ids = swapDraft.ids.slice(0, 4);
    if (!ids.length) { alert("至少保留 1 个技能！"); return; }
    var base = getAllPets().find(function(p) { return p.id === pet.id; }) || pet;
    var isBuiltin = DEFAULT_PETS.some(function(dp) { return dp.id === pet.id; });
    if (isBuiltin) {
      // R02：内置宠物只保存技能配置，不序列化整只宠物（避免血脉函数丢失）
      var loadouts = loadPetLoadouts();
      loadouts[pet.id] = Object.assign({}, loadouts[pet.id], { skillIds: ids, ownedSkillIds: ownedIds.slice() });
      savePetLoadouts(loadouts);
    } else {
      var customPets = loadCustomPets();
      var ci = customPets.findIndex(function(p) { return p.id === pet.id; });
      var record = ci >= 0 ? customPets[ci] : JSON.parse(JSON.stringify(base));
      record.skillIds = ids;
      record.ownedSkillIds = ownedIds.slice();  // 锁定本宠技能池，后续只能在这批里换
      if (ci >= 0) customPets[ci] = record; else customPets.push(record);
      saveCustomPets(customPets);
    }
    swapDraft = null;
    addMessage(pet.name + " 的技能配置已保存！（" + ids.length + " 个技能）");
    showScreen("skillswap");
  });
}

// ---------- PET MANAGEMENT (simplified) ----------
var mgmtTab = "pets";
function renderPetManagement(app) { app.innerHTML = '<div class="screen active"><div class="screen-header"><button class="back-btn" id="mgmt-back">\u2190</button><span class="screen-title">宠物管理</span></div><div class="mgmt-tabs"><button class="mgmt-tab ' + (mgmtTab === "pets" ? "active" : "") + '" id="tab-pets">\u{1F43E} 宠物列表</button><button class="mgmt-tab ' + (mgmtTab === "skills" ? "active" : "") + '" id="tab-skills">\u2B50 技能列表</button></div><div class="mgmt-list" id="mgmt-list"></div><button class="add-btn" id="mgmt-add">+ 添加' + (mgmtTab === "pets" ? "自定义宠物" : "自定义技能") + '</button></div>'; document.querySelector("#mgmt-back").addEventListener("click", function() { showScreen("menu"); }); document.querySelector("#tab-pets").addEventListener("click", function() { mgmtTab = "pets"; showScreen("pets"); }); document.querySelector("#tab-skills").addEventListener("click", function() { mgmtTab = "skills"; showScreen("pets"); }); document.querySelector("#mgmt-add").addEventListener("click", function() { mgmtTab === "pets" ? showPetForm() : showSkillForm(); }); renderMgmtList(); }

function renderMgmtList() { try { var list = document.querySelector("#mgmt-list"); if (!list) return; list.innerHTML = ""; if (mgmtTab === "pets") { getAllPets().forEach(function(pet) { var isCustom = pet.id ? pet.id.indexOf("pet_") !== 0 : true; var div = document.createElement("div"); div.className = "mgmt-item"; div.innerHTML = '<div class="mgmt-item-emoji">' + pet.emoji + '</div><div class="mgmt-item-info"><div class="mgmt-item-name">' + pet.name + (isCustom ? " \u2728" : "") + (pet.bloodline ? ' <span style="color:var(--gold);font-size: 12px">血脉:' + pet.bloodline.name + '</span>' : '') + '</div><div class="mgmt-item-detail">' + elemIcon(pet.element) + (ELEMENTS[pet.element]||{name:'?'}).name + '系 · Lv.' + (pet.level||'?') + ' · HP:' + (pet.baseStats||pet.stats||{hp:100}).hp + '</div></div><div class="mgmt-item-actions"><button class="edit-pet-btn">编辑</button>' + (isCustom ? '<button class="del-pet-btn" style="color:var(--accent)">删除</button>' : '') + '</div>'; div.querySelector(".edit-pet-btn").addEventListener("click", function() { showPetForm(pet); }); var db = div.querySelector(".del-pet-btn"); if (db) db.addEventListener("click", function() { deletePet(pet.id); }); list.appendChild(div); }); } else { getAllSkills().forEach(function(skill) { var isCustom = skill.id ? skill.id.indexOf("sk_") !== 0 : true; var div = document.createElement("div"); div.className = "mgmt-item"; div.innerHTML = '<div class="mgmt-item-emoji" style="color:' + (ELEMENTS[skill.element]||{color:"#888"}).color + '">\u2726</div><div class="mgmt-item-info"><div class="mgmt-item-name">' + escapeHtml(skill.name) + (isCustom ? " \u2728" : "") + (skill.onUse ? ' <span style="color:var(--accent);font-size: 12px">扩展</span>' : '') + '</div><div class="mgmt-item-detail">' + elemIcon(skill.element) + (ELEMENTS[skill.element]||{name:"?"}).name + '系 · 威力:' + (skill.power || "-") + ' · PP:' + skill.maxPp + '</div></div><div class="mgmt-item-actions"><button class="edit-sk-btn">编辑</button>' + (isCustom ? '<button class="del-sk-btn" style="color:var(--accent)">删除</button>' : '') + '</div>'; div.querySelector(".edit-sk-btn").addEventListener("click", function() { showSkillForm(skill); }); var db2 = div.querySelector(".del-sk-btn"); if (db2) db2.addEventListener("click", function() { deleteSkill(skill.id); }); list.appendChild(div); }); } } catch(e) { console.error("renderMgmtList error:", e); list.innerHTML = "<div style=color:red>加载失败: " + e.message + "</div>"; } }function showPetForm(pet) { removeBodyLayer("modal-overlay"); var isEdit = !!pet; var skills = getAllSkills(); if (pet && pet.stats && !pet.baseStats) pet.baseStats = pet.stats;
  var selSkills = pet ? [...pet.skillIds].slice(0, 4) : []; while (selSkills.length < 4) selSkills.push(""); var elemOpts = ""; Object.entries(ELEMENTS).forEach(function(e) { if (e[0][0] === '_' || !e[1] || !e[1].name) return; elemOpts += '<option value="' + e[0] + '"' + (pet && pet.element === e[0] ? " selected" : "") + '>' + e[1].name + '系</option>'; }); var skOpts = '<option value="">-- 无 --</option>'; skills.forEach(function(s) { skOpts += '<option value="' + s.id + '">' + escapeHtml(s.name) + ' (' + (ELEMENTS[s.element]||{name:'?'}).name + ')</option>'; }); var html = '<div class="modal-overlay show" id="modal-overlay"><div class="modal"><h3>' + (isEdit ? "编辑" : "创建") + '宠物</h3>'; html += '<div class="form-group"><label>名称</label><input id="fp-name" value="' + (pet ? pet.name : "") + '" maxlength="10"></div>'; html += '<div class="form-group"><label>Emoji</label><input id="fp-emoji" value="' + (pet ? pet.emoji : "\u{1F43E}") + '" maxlength="4"></div>'; html += '<div class="form-group"><label>元素</label><select id="fp-element">' + elemOpts + '</select></div>'; html += '<div class="form-group"><label>等级</label><input id="fp-level" type="number" value="' + (pet ? pet.level : 100) + '" min="1" max="100"></div>'; html += '<label style="font-size:12px;color:var(--text2);font-weight:600;">能力值（输入能力值，种族值自动换算）</label><div class="stat-grid">'; [["hp","HP"],["atk",STAGE_LABELS.atk],["def",STAGE_LABELS.def],["spatk",STAGE_LABELS.spatk],["spdef",STAGE_LABELS.spdef],["spd",STAGE_LABELS.spd]].forEach(function(e2) { var baseVal = (pet ? ((pet.baseStats || pet.stats || {})[e2[0]] || 100) : 100); var abilityVal = e2[0] === "hp" ? calcHpAbility(baseVal, (pet ? pet.level : 100) || 100) : calcAbility(baseVal, (pet ? pet.level : 100) || 100); html += '<div class="form-group"><label>' + e2[1] + '</label><input id="fp-' + e2[0] + '" type="number" value="' + abilityVal + '" min="1" max="999" title="能力值（种族值 ' + baseVal + '）"></div>'; }); html += '</div>'; for (var i = 0; i < 4; i++) { var so = skOpts.replace('value="' + selSkills[i] + '"', 'value="' + selSkills[i] + '" selected'); html += '<div class="form-group"><select id="fp-skill-' + i + '">' + so + '</select></div>'; } html += '<div class="form-actions"><button class="btn btn-secondary" id="form-cancel">取消</button><button class="btn btn-primary" id="form-save">' + (isEdit ? "保存" : "创建") + '</button></div></div></div>'; document.body.insertAdjacentHTML("beforeend", html); var formLayer = prepareFormLayer(); formLayer.addEventListener("click", function(e) { if (e.target.id === "modal-overlay") closeModal(); }); document.querySelector("#form-cancel").addEventListener("click", closeModal); document.querySelector("#form-save").addEventListener("click", function() { if (formLayer.layerIsOpen()) savePetForm(isEdit, pet); }); }

function savePetForm(isEdit, orig) { var name = document.querySelector("#fp-name").value.trim(); if (!name) { alert("请输入名称！"); return; } var np = { id: isEdit ? orig.id : ("custom_pet_" + Date.now()), name: name, emoji: document.querySelector("#fp-emoji").value || "\u{1F43E}", element: document.querySelector("#fp-element").value, level: parseInt(document.querySelector("#fp-level").value) || 100, baseStats: { hp: abilityToBase(parseInt(document.querySelector("#fp-hp").value) || calcHpAbility(100, parseInt(document.querySelector("#fp-level").value) || 100), parseInt(document.querySelector("#fp-level").value) || 100, true), atk: abilityToBase(parseInt(document.querySelector("#fp-atk").value) || calcAbility(100, parseInt(document.querySelector("#fp-level").value) || 100), parseInt(document.querySelector("#fp-level").value) || 100, false), def: abilityToBase(parseInt(document.querySelector("#fp-def").value) || calcAbility(100, parseInt(document.querySelector("#fp-level").value) || 100), parseInt(document.querySelector("#fp-level").value) || 100, false), spatk: abilityToBase(parseInt(document.querySelector("#fp-spatk").value) || calcAbility(100, parseInt(document.querySelector("#fp-level").value) || 100), parseInt(document.querySelector("#fp-level").value) || 100, false), spdef: abilityToBase(parseInt(document.querySelector("#fp-spdef").value) || calcAbility(100, parseInt(document.querySelector("#fp-level").value) || 100), parseInt(document.querySelector("#fp-level").value) || 100, false), spd: abilityToBase(parseInt(document.querySelector("#fp-spd").value) || calcAbility(100, parseInt(document.querySelector("#fp-level").value) || 100), parseInt(document.querySelector("#fp-level").value) || 100, false) }, skillIds: [0,1,2,3].map(function(i) { var el = document.querySelector("#fp-skill-" + i); return el ? el.value : ""; }).filter(Boolean) }; np.ownedSkillIds = Array.from(new Set([].concat(isEdit && orig.ownedSkillIds ? orig.ownedSkillIds : [], np.skillIds)));
  // R09：内置宠物编辑写入 loadout（保留血脉函数），不再静默丢弃
  var isBuiltin = isEdit && DEFAULT_PETS.some(function(dp) { return dp.id === orig.id; });
  if (isBuiltin) {
    var loadouts = loadPetLoadouts();
    var lo = loadouts[orig.id] || {};
    lo.name = np.name; lo.emoji = np.emoji; lo.baseStats = np.baseStats; lo.level = np.level;
    if (np.skillIds.length) {
      lo.skillIds = np.skillIds;
      lo.ownedSkillIds = Array.from(new Set(getOwnedSkillIds(orig).concat(np.skillIds)));
    }
    loadouts[orig.id] = lo;
    savePetLoadouts(loadouts);
    closeModal(); showScreen("pets"); return;
  }
  var cp = loadCustomPets(); if (isEdit) { var idx = cp.findIndex(function(p) { return p.id === orig.id; }); if (idx >= 0) cp[idx] = np; } else cp.push(np); saveCustomPets(cp); closeModal(); showScreen("pets"); }

function deletePet(petId) { if (!confirm("确定删除？")) return; saveCustomPets(loadCustomPets().filter(function(p) { return p.id !== petId; })); showScreen("pets"); }

function showSkillForm(skill) { removeBodyLayer("modal-overlay"); var isEdit = !!skill; var isBuiltin = isEdit && DEFAULT_SKILLS.some(function(s) { return s.id === skill.id; }); var elemOpts = ""; Object.entries(ELEMENTS).forEach(function(e) { if (e[0][0] === '_' || !e[1] || !e[1].name) return; elemOpts += '<option value="' + e[0] + '"' + (skill && skill.element === e[0] ? " selected" : "") + '>' + e[1].name + '系</option>'; }); var cats = '<option value="physical"' + (skill && skill.category === "physical" ? " selected" : "") + '>物理</option><option value="special"' + (skill && skill.category === "special" ? " selected" : "") + '>特殊</option><option value="status"' + (skill && skill.category === "status" ? " selected" : "") + '>变化</option>'; var effs = '<option value="">无</option><option value="burn">烧伤</option><option value="freeze">冰冻</option><option value="paralyze">麻痹</option><option value="poison">中毒</option><option value="sleep">睡眠</option><option value="confuse">混乱</option>'; var html = '<div class="modal-overlay show" id="modal-overlay"><div class="modal"><h3>' + (isEdit ? "编辑" : "创建") + '技能</h3>'; html += '<div class="form-group"><label>名称</label><input id="fs-name" value="' + (skill ? escapeHtml(skill.name).replace(/"/g, "&quot;") : "") + '" maxlength="10"></div>'; if (isBuiltin) html += '<p class="form-group">内置技能仅可编辑名称和描述。战斗参数与效果由原有机制决定。</p><fieldset disabled style="border:0;padding:0;margin:0;min-width:0">'; html += '<div class="form-group"><label>元素</label><select id="fs-element">' + elemOpts + '</select></div>'; html += '<div class="form-group"><label>类型</label><select id="fs-category">' + cats + '</select></div>'; html += '<div class="stat-grid"><div class="form-group"><label>威力</label><input id="fs-power" type="number" value="' + (skill ? skill.power : 80) + '" min="0" max="250"></div><div class="form-group"><label>PP</label><input id="fs-pp" type="number" value="' + (skill ? skill.maxPp : 15) + '" min="1" max="40"></div><div class="form-group"><label>命中</label><input id="fs-accuracy" type="number" value="' + (skill ? skill.accuracy : 100) + '" min="30" max="100"></div></div>'; html += '<div class="form-group"><label>效果</label><select id="fs-effect">' + effs + '</select></div>'; html += '<div class="form-group"><label>效果率%</label><input id="fs-effectChance" type="number" value="' + (skill ? skill.effectChance : 0) + '" min="0" max="100"></div>'; if (isBuiltin) html += '</fieldset>'; html += '<div class="form-group"><label>描述</label><textarea id="fs-desc">' + (skill ? escapeHtml(skill.desc || "") : "") + '</textarea></div>'; html += '<div class="form-actions"><button class="btn btn-secondary" id="form-cancel">取消</button><button class="btn btn-primary" id="form-save">' + (isEdit ? "保存" : "创建") + '</button></div></div></div>'; document.body.insertAdjacentHTML("beforeend", html); var formLayer = prepareFormLayer(); formLayer.addEventListener("click", function(e) { if (e.target.id === "modal-overlay") closeModal(); }); document.querySelector("#form-cancel").addEventListener("click", closeModal); document.querySelector("#form-save").addEventListener("click", function() { if (formLayer.layerIsOpen()) saveSkillForm(isEdit, skill); }); }

function saveSkillForm(isEdit, orig) {
  var name = document.querySelector("#fs-name").value.trim();
  if (!name) { alert("请输入名称！"); return; }
  var ns = {
    id: isEdit ? orig.id : ("custom_skill_" + Date.now()),
    name: name,
    desc: document.querySelector("#fs-desc").value.trim()
  };
  var isBuiltin = isEdit && DEFAULT_SKILLS.some(function(s) { return s.id === orig.id; });
  if (!isBuiltin) {
    var pp = parseInt(document.querySelector("#fs-pp").value) || 15;
    Object.assign(ns, {
      element: document.querySelector("#fs-element").value,
      power: parseInt(document.querySelector("#fs-power").value) || 0,
      pp: pp,
      maxPp: pp,
      accuracy: parseInt(document.querySelector("#fs-accuracy").value) || 100,
      category: document.querySelector("#fs-category").value,
      effect: document.querySelector("#fs-effect").value || null,
      effectChance: parseInt(document.querySelector("#fs-effectChance").value) || 0
    });
  }
  var cs = loadCustomSkills();
  var idx = cs.findIndex(function(s) { return s.id === ns.id; });
  if (idx >= 0) cs[idx] = isBuiltin ? Object.assign({}, cs[idx], ns) : ns;
  else cs.push(ns);
  saveCustomSkills(cs);
  closeModal();
  showScreen("pets");
}

function deleteSkill(skillId) { if (!confirm("确定删除？")) return; saveCustomSkills(loadCustomSkills().filter(function(s) { return s.id !== skillId; })); saveCustomPets(loadCustomPets().map(function(p) { p.skillIds = p.skillIds.filter(function(sid) { return sid !== skillId; }); return p; })); showScreen("pets"); }

function prepareFormLayer() {
  var ov = document.querySelector("#modal-overlay"), trigger = document.activeElement, version = uiPageVersion;
  prepareLayer(ov, function(restore) { ov.remove(); if (restore && version === uiPageVersion && trigger && trigger.isConnected !== false && trigger.focus) trigger.focus(); });
  return ov;
}
function closeModal() {
  var ov = document.querySelector("#modal-overlay");
  if (!ov) return;
  if (!ov.layerIsOpen || !ov.closeLayer) { ov.remove(); return; }
  if (!ov.layerIsOpen()) return;
  var save = ov.querySelector("#form-save"); if (save) save.disabled = true;
  ov.closeLayer();
}

