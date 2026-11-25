// ---------- STORAGE ----------
const STORAGE_KEY_PETS = "pbg_custom_pets";
const STORAGE_KEY_SKILLS = "pbg_custom_skills";
function loadCustomPets() { try { var d = JSON.parse(localStorage.getItem(STORAGE_KEY_PETS)); return Array.isArray(d) ? d.filter(function(p){return p&&p.id;}) : []; } catch(e) { return []; } }
function saveCustomPets(pets) { localStorage.setItem(STORAGE_KEY_PETS, JSON.stringify(pets)); }
const STORAGE_KEY_LOADOUTS = "pbg_pet_loadouts";
function loadPetLoadouts() { try { var d = JSON.parse(localStorage.getItem(STORAGE_KEY_LOADOUTS)); return d && typeof d === "object" ? d : {}; } catch (e) { return {}; } }
function savePetLoadouts(map) { localStorage.setItem(STORAGE_KEY_LOADOUTS, JSON.stringify(map)); }
function loadCustomSkills() { try { var d = JSON.parse(localStorage.getItem(STORAGE_KEY_SKILLS)); return Array.isArray(d) ? d.filter(function(s){return s&&s.id;}) : []; } catch(e) { return []; } }
function saveCustomSkills(skills) { localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(skills)); }
function getAllSkills() {
  var custom = loadCustomSkills();
  var builtinIds = new Set(DEFAULT_SKILLS.map(function(s) { return s.id; }));
  var defaults = DEFAULT_SKILLS.map(function(skill) {
    var saved = custom.find(function(s) { return s.id === skill.id; });
    if (!saved) return skill;
    var merged = Object.assign({}, skill);
    if (typeof saved.name === "string" && saved.name.trim()) merged.name = saved.name;
    if (typeof saved.desc === "string") merged.desc = saved.desc;
    return merged;
  });
  return defaults.concat(custom.filter(function(s) { return !builtinIds.has(s.id); }));
}
function getAllPets() {
  var loadouts = loadPetLoadouts();
  var saved = loadCustomPets();
  var builtinIds = new Set(DEFAULT_PETS.map(function(p) { return p.id; }));
  var knownSkillIds = new Set(DEFAULT_SKILLS.concat(loadCustomSkills()).map(function(s) { return s.id; }));
  var custom = saved.filter(function(p) { return !builtinIds.has(p.id); });
  var defaults = DEFAULT_PETS.map(function(dp) {
    // 旧档按需读入，保留原始记录及内置血脉函数；新档优先。
    var legacy = saved.find(function(p) { return p.id === dp.id; });
    var lo = loadouts[dp.id];
    if (!legacy && !lo) return dp;
    var merged = Object.assign({}, dp);
    var ownedSkillIds = dp.skillIds;
    [legacy, lo].filter(Boolean).forEach(function(record) {
      ["name", "emoji"].forEach(function(key) {
        if (typeof record[key] === "string" && record[key].trim()) merged[key] = record[key];
      });
      if (Number.isInteger(record.level) && record.level > 0) merged.level = record.level;
      var stats = record.baseStats || record.stats;
      if (stats) {
        merged.baseStats = Object.assign({}, merged.baseStats);
        Object.keys(dp.baseStats).forEach(function(key) {
          if (Number.isFinite(stats[key]) && stats[key] >= 0) merged.baseStats[key] = stats[key];
        });
      }
      if (Array.isArray(record.ownedSkillIds) && record.ownedSkillIds.length) {
        ownedSkillIds = Array.from(new Set(dp.skillIds.concat(record.ownedSkillIds))).filter(function(id) {
          return knownSkillIds.has(id);
        });
      }
    });
    merged.ownedSkillIds = ownedSkillIds;
    // 丢弃无效或重复槽位，同时保持合法技能的原始顺序。
    [legacy, lo].filter(Boolean).forEach(function(record) {
      if (!Array.isArray(record.skillIds)) return;
      var ids = Array.from(new Set(record.skillIds)).filter(function(id) { return ownedSkillIds.includes(id); });
      if (ids.length) merged.skillIds = ids.slice(0, 4);
    });
    return merged;
  });
  return defaults.concat(custom);
}
function findSkill(id) { return getAllSkills().find(s => s.id === id); }
function findPet(id) { return getAllPets().find(p => p.id === id); }



