// ---------- INIT ----------
// ---------- 偏好设置 ----------
var FONT_OPTIONS_CN = [
  { id: 'default', name: '思源宋体', fam: 'Noto Serif SC', url: "family=Noto+Serif+SC:wght@700;900" },
  { id: 'kuaiLe', name: '黄油体', fam: 'ZCOOL QingKe HuangYou', url: "family=ZCOOL+QingKe+HuangYou" },
  { id: 'maShan', name: '毛笔体', fam: 'Ma Shan Zheng', url: "family=Ma+Shan+Zheng" },
  { id: 'wenKai', name: '文楷体', fam: 'LXGW WenKai TC', url: "family=LXGW+WenKai+TC:wght@700" },
  { id: 'longCang', name: '瘦金体', fam: 'Long Cang', url: "family=Long+Cang" },
  { id: 'zcoolKuaiLe', name: '快乐体', fam: 'ZCOOL KuaiLe', url: "family=ZCOOL+KuaiLe" },
  { id: 'zhiMang', name: '行书体', fam: 'Zhi Mang Xing', url: "family=Zhi+Mang+Xing" },
  { id: 'liuJian', name: '狂草体', fam: 'Liu Jian Mao Cao', url: "family=Liu+Jian+Mao+Cao" },
  { id: 'xiaoWei', name: '小薇体', fam: 'ZCOOL XiaoWei', url: "family=ZCOOL+XiaoWei" },
  { id: 'notoSans', name: '黑体', fam: 'Noto Sans SC', url: "family=Noto+Sans+SC:wght@900" },
  { id: 'system', name: '系统字体', fam: 'Microsoft YaHei' }
];
var FONT_OPTIONS_EN = [
  { id: 'cinzel', name: 'Cinzel', fam: 'Cinzel', url: "family=Cinzel:wght@700;900" },
  { id: 'orbitron', name: 'Orbitron', fam: 'Orbitron', url: "family=Orbitron:wght@700;900" },
  { id: 'pressStart', name: 'Press Start 2P', fam: 'Press Start 2P', url: "family=Press+Start+2P" },
  { id: 'bebas', name: 'Bebas Neue', fam: 'Bebas Neue', url: "family=Bebas+Neue" },
  { id: 'oswald', name: 'Oswald', fam: 'Oswald', url: "family=Oswald:wght@600;700" },
  { id: 'marcellus', name: 'Marcellus', fam: 'Marcellus', url: "family=Marcellus" },
  { id: 'spectral', name: 'Spectral', fam: 'Spectral', url: "family=Spectral:wght@700;800" },
  { id: 'teko', name: 'Teko', fam: 'Teko', url: "family=Teko:wght@600;700" },
  { id: 'audiowide', name: 'Audiowide', fam: 'Audiowide', url: "family=Audiowide" },
  { id: 'unifraktur', name: 'UnifrakturCook', fam: 'UnifrakturCook', url: "family=UnifrakturCook:wght@700" },
  { id: 'system', name: '系统字体', fam: 'Arial' }
];
function fontChoices(options) {
  return Object.fromEntries(options.map(function(font) { return [font.id, font.name]; }));
}
var settingFields = {
  theme: { label: "主题", key: "roco_theme", initial: "dark", choices: { dark: "暗色", light: "亮色", system: "跟随系统" } },
  motion: { label: "动态效果", key: "roco_motion", initial: "system", choices: { system: "跟随系统", reduce: "减少动效" } },
  cn: { label: "中文字体", key: "roco_font_cn", initial: "default", choices: fontChoices(FONT_OPTIONS_CN) },
  en: { label: "英文字体", key: "roco_font_en", initial: "cinzel", choices: fontChoices(FONT_OPTIONS_EN) },
  logSize: { label: "日志高度", key: "roco_log_size", initial: "standard", choices: { standard: "标准", expanded: "加高" } },
  logText: { label: "日志字号", key: "roco_log_text", initial: "standard", choices: { standard: "标准", large: "大字" } },
  floatNumbers: { label: "战斗数值飘字", key: "roco_float_numbers", initial: "on", choices: { on: "显示", off: "隐藏" } }
};
var preferences = {};
Object.entries(settingFields).forEach(function(entry) {
  var field = entry[1], value;
  try { value = localStorage.getItem(field.key); } catch (_) {}
  preferences[entry[0]] = Object.hasOwn(field.choices, value) ? value : field.initial;
});

function matchesSystemPreference(query) {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}
function applyTheme() {
  var choice = preferences.theme;
  var light = choice === "light" || (choice === "system" && matchesSystemPreference("(prefers-color-scheme: light)"));
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
}
function applyMotion() {
  document.documentElement.setAttribute("data-motion", preferences.motion);
  document.documentElement.setAttribute("data-reduced-motion", String(prefersReducedMotion()));
}
function applyFont(lang) {
  var options = lang === "cn" ? FONT_OPTIONS_CN : FONT_OPTIONS_EN;
  var font = options.find(function(item) { return item.id === preferences[lang]; });
  var cssId = "font-" + lang + "-" + font.id;
  if (font.url && !document.getElementById(cssId)) {
    var link = document.createElement("link");
    link.id = cssId; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?" + font.url + "&display=swap";
    document.head.appendChild(link);
  }
  var family = "'" + font.fam + "'";
  if (lang === "cn") family += font.id === "system" ? ", 'PingFang SC', sans-serif" : ", 'Microsoft YaHei', serif";
  var style = document.documentElement.style;
  style.setProperty("--font-game-" + lang, family);
  style.setProperty("--title-font-" + lang, family);
}
function applyPreference(name) {
  switch (name) {
    case "theme": applyTheme(); break;
    case "motion": applyMotion(); break;
    case "cn": case "en": applyFont(name); break;
    case "logSize": document.documentElement.setAttribute("data-log-size", preferences.logSize); break;
    case "logText": document.documentElement.setAttribute("data-log-text", preferences.logText); break;
  }
}
function setPreference(name, value) {
  var field = settingFields[name];
  if (!Object.hasOwn(field.choices, value)) return false;
  preferences[name] = value;
  applyPreference(name);
  try { localStorage.setItem(field.key, value); return true; } catch (_) { return false; }
}

function choiceRow(name) {
  var field = settingFields[name], id = "setting-" + name;
  var buttons = Object.entries(field.choices).map(function(option) {
    return '<button type="button" data-setting="' + name + '" data-value="' + option[0] + '" aria-pressed="' + (preferences[name] === option[0]) + '">' + option[1] + '</button>';
  });
  return '<div class="setting-row"><span class="setting-label" id="' + id + '">' + field.label + '</span><div class="setting-choices" role="group" aria-labelledby="' + id + '">' + buttons.join("") + '</div></div>';
}
function fontField(lang) {
  var field = settingFields[lang];
  var options = Object.entries(field.choices).map(function(option) {
    return '<option value="' + option[0] + '"' + (preferences[lang] === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
  });
  return '<div class="font-field"><label for="font-' + lang + '">' + field.label + '</label><select id="font-' + lang + '">' + options.join("") + '</select></div>';
}

var settingsOrigin = "menu", settingsScrollY = 0;
function renderSettings(app) {
  var resetButton = '<button type="button" class="settings-reset" id="settings-reset">恢复默认设置</button>';
  app.innerHTML = '<main class="screen active settings-screen">' + pageHeader("设置", "settings-back", resetButton) +
    '<div class="settings-grid"><section class="settings-group"><h2>界面外观</h2>' + choiceRow("theme") + choiceRow("motion") + '</section>' +
    '<section class="settings-group"><h2>战斗显示</h2>' + choiceRow("logSize") + choiceRow("logText") + choiceRow("floatNumbers") + '<p class="motion-note">减少动效时自动隐藏飘字</p></section>' +
    '<section class="settings-group font-settings"><h2>字体</h2><div class="font-fields">' + fontField("cn") + fontField("en") +
    '<div class="font-preview" role="img" aria-label="中英文字体预览"><strong>洛克王国</strong><span>ROCO REMAKE</span></div></div></section></div>' +
    '<p role="status" class="settings-feedback"></p></main>';
  var choices = app.querySelectorAll("[data-setting]");
  var reset = app.querySelector("#settings-reset");
  var status = app.querySelector(".settings-feedback");
  function refresh() {
    choices.forEach(function(btn) {
      btn.setAttribute("aria-pressed", String(preferences[btn.getAttribute("data-setting")] === btn.getAttribute("data-value")));
    });
    ["cn", "en"].forEach(function(lang) { app.querySelector("#font-" + lang).value = preferences[lang]; });
    reset.disabled = Object.keys(settingFields).every(function(name) { return preferences[name] === settingFields[name].initial; });
  }
  function leave() {
    showScreen(settingsOrigin);
    var entry = document.getElementById("settings-btn");
    if (entry) entry.focus({ preventScroll: true });
    if (window.scrollTo) window.scrollTo({ top: settingsScrollY, behavior: "instant" });
  }
  function report(saved, message) {
    status.textContent = saved ? message : "当前浏览器无法保存偏好，设置仅在本次打开期间生效。";
    refresh();
  }
  choices.forEach(function(btn) {
    btn.addEventListener("click", function() {
      report(setPreference(btn.getAttribute("data-setting"), btn.getAttribute("data-value")), "");
    });
  });
  ["cn", "en"].forEach(function(lang) {
    var select = app.querySelector("#font-" + lang);
    select.addEventListener("change", function() { report(setPreference(lang, select.value), ""); });
  });
  reset.addEventListener("click", function() {
    var saved = true;
    Object.keys(settingFields).forEach(function(name) {
      if (!setPreference(name, settingFields[name].initial)) saved = false;
    });
    report(saved, "已恢复默认设置");
    app.querySelector("#settings-back").focus({ preventScroll: true });
  });
  app.querySelector("#settings-back").addEventListener("click", leave);
  app.querySelector(".settings-screen").addEventListener("keydown", function(event) {
    if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); leave(); }
  });
  refresh();
}
function initSettings() {
  // 保留历史版本标记。禁用本地存储时，界面偏好仍可在本次游戏内使用。
  try {
    ["roco_v5", "pbg_v4_loaded"].forEach(function(key) {
      if (!localStorage.getItem(key)) localStorage.setItem(key, "1");
    });
  } catch (_) {}
  Object.keys(settingFields).forEach(applyPreference);
  if (window.matchMedia) {
    [["(prefers-color-scheme: light)", applyTheme], ["(prefers-reduced-motion: reduce)", applyMotion]].forEach(function(pair) {
      var media = window.matchMedia(pair[0]);
      if (media.addEventListener) media.addEventListener("change", pair[1]);
      else if (media.addListener) media.addListener(pair[1]);
    });
  }
  var btn = document.createElement("button");
  btn.className = "settings-btn"; btn.id = "settings-btn"; btn.type = "button";
  btn.textContent = "⚙"; btn.title = "设置"; btn.setAttribute("aria-label", "设置");
  document.body.appendChild(btn);
  btn.addEventListener("click", function() {
    if (!["menu", "team", "opponent", "pets", "skillswap"].includes(gameState.screen) ||
        document.querySelector("#intro-screen, #swap-save, .modal-overlay")) return;
    settingsOrigin = gameState.screen; settingsScrollY = window.scrollY || 0;
    showScreen("settings");
    if (window.scrollTo) window.scrollTo({ top: 0, behavior: "instant" });
  });
}

