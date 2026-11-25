

window.onerror = function(msg, url, line, col, err) {
  document.body.innerHTML = "<div style='color:lime;background:#111;padding:20px;font-family:monospace;font-size:14px;white-space:pre-wrap'><h2 style='color:red'>JS ERROR</h2><b>Line " + line + ":" + col + "</b><br>" + msg + "<br><br><pre>" + (err&&err.stack||"") + "</pre></div>";
  return false;
};
// ============================================================
//  宠物对战 V3 - 完整机制引擎
//  分段伤害·状态回溯·PP历史·固伤反转·限伤·禁暴·恐惧·元素丢失·局外换技能
// ============================================================


