

window.onerror = function(msg, url, line, col, err) {
  document.body.innerHTML = "<div style='color:lime;background:#111;padding:20px;font-family:monospace;font-size:14px;white-space:pre-wrap'><h2 style='color:red'>JS ERROR</h2><b>Line " + line + ":" + col + "</b><br>" + msg + "<br><br><pre>" + (err&&err.stack||"") + "</pre></div>";
  return false;
};
// ============================================================
//  宠物对战 V3 - 完整机制引擎
//  分段伤害·状态回溯·PP历史·固伤反转·限伤·禁暴·恐惧·元素丢失·局外换技能
// ============================================================


// ---------- ELEMENT DEFINITIONS ----------
// ---------- ABILITY FORMULA ----------
// 种族值 → 能力值转换
// 能力值 = floor( (种族值×2 + 50) × 等级/100 ) + 等级 + 10
function calcAbility(baseStat, level) { return Math.floor((baseStat * 2 + 50) * level / 100) + level + 10; }
// 精力独特公式：通用公式 + 100（替代装备系统的精力加成）
function calcHpAbility(baseStat, level) { return calcAbility(baseStat, level) + 100; }
function calcAllStats(baseStats, level) { return { hp: calcHpAbility(baseStats.hp, level), atk: calcAbility(baseStats.atk, level), def: calcAbility(baseStats.def, level), spatk: calcAbility(baseStats.spatk, level), spdef: calcAbility(baseStats.spdef, level), spd: calcAbility(baseStats.spd, level) }; }
// 能力值→种族值反推（用于编辑界面输入能力值后存储种族值）
function abilityToBase(ability, level, isHp) {
  var hpBonus = isHp ? 100 : 0;
  var base = ((ability - hpBonus - level - 10) * 100 / level - 50) / 2;
  return Math.max(0, Math.round(base));
}

const ELEMENTS = {
  // Element emojis for UI display
  // 端游风格属系图标（自制 SVG：属性色圆底 + 白色符号，含三种神系）
  _icon: {
    divine_fire: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OS41IiBmaWxsPSIjMjYxZDI0Ii8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDciIGZpbGw9IiNmZmUzOWIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MSIgZmlsbD0iIzc5NTIzMyIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjM2IiBmaWxsPSIjZmZiOThmIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMzEiIGZpbGw9IiNhZDRlMjkiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1MCA1MCkgc2NhbGUoLjgpIHRyYW5zbGF0ZSgtNTAgLTUwKSI+PHBhdGggZD0iTTUwIDE2IEM2MCAzNCA3NiA0MiA3NiA1OCBDNzYgNzMgNjQgODQgNTAgODQgQzM2IDg0IDI0IDczIDI0IDU4IEMyNCA0NiAzMyA0MCAzOSAzMSBDNDEgNDAgNDUgNDUgNTAgNDcgQzQ3IDM4IDQ3IDI3IDUwIDE2WiIgZmlsbD0iI2ZmZiIvPjwvZz48L3N2Zz4=",
    divine_grass: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OS41IiBmaWxsPSIjMjYxZDI0Ii8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDciIGZpbGw9IiNmZmUzOWIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MSIgZmlsbD0iIzc5NTIzMyIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjM2IiBmaWxsPSIjYzBlZDlkIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMzEiIGZpbGw9IiMzZDgxMzciLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1MCA1MCkgc2NhbGUoLjgpIHRyYW5zbGF0ZSgtNTAgLTUwKSI+PHBhdGggZD0iTTUwIDg2IEMzMCA4NiAyMCA2OSAyMiA0OSBDMjQgMzAgMzggMTcgNTAgMTQgQzYyIDE3IDc2IDMwIDc4IDQ5IEM4MCA2OSA3MCA4NiA1MCA4NloiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNNTAgMjIgVjgyIiBzdHJva2U9IiM3OGM4NTAiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9nPjwvc3ZnPg==",
    divine_water: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OS41IiBmaWxsPSIjMjYxZDI0Ii8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDciIGZpbGw9IiNmZmUzOWIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MSIgZmlsbD0iIzc5NTIzMyIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjM2IiBmaWxsPSIjYjVkYmZmIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMzEiIGZpbGw9IiMzNjZiYjkiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1MCA1MCkgc2NhbGUoLjgpIHRyYW5zbGF0ZSgtNTAgLTUwKSI+PHBhdGggZD0iTTUwIDE0IEM1MCAxNCA3NiA0NCA3NiA2MSBDNzYgNzUgNjQgODYgNTAgODYgQzM2IDg2IDI0IDc1IDI0IDYxIEMyNCA0NCA1MCAxNCA1MCAxNFoiIGZpbGw9IiNmZmYiLz48L2c+PC9zdmc+",
    normal: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2E4YTg3OCIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE1IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSIyMiIgcj0iNyIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNzgiIHI9IjciIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyMiIgY3k9IjUwIiByPSI3IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNzgiIGN5PSI1MCIgcj0iNyIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==",
    fire: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2YwODAzMCIvPjxwYXRoIGQ9Ik01MCAxNiBDNjAgMzQgNzYgNDIgNzYgNTggQzc2IDczIDY0IDg0IDUwIDg0IEMzNiA4NCAyNCA3MyAyNCA1OCBDMjQgNDYgMzMgNDAgMzkgMzEgQzQxIDQwIDQ1IDQ1IDUwIDQ3IEM0NyAzOCA0NyAyNyA1MCAxNloiIGZpbGw9IiNmZmYiLz48L3N2Zz4=",
    water: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iIzY4OTBmMCIvPjxwYXRoIGQ9Ik01MCAxNCBDNTAgMTQgNzYgNDQgNzYgNjEgQzc2IDc1IDY0IDg2IDUwIDg2IEMzNiA4NiAyNCA3NSAyNCA2MSBDMjQgNDQgNTAgMTQgNTAgMTRaIiBmaWxsPSIjZmZmIi8+PC9zdmc+",
    grass: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iIzc4Yzg1MCIvPjxwYXRoIGQ9Ik01MCA4NiBDMzAgODYgMjAgNjkgMjIgNDkgQzI0IDMwIDM4IDE3IDUwIDE0IEM2MiAxNyA3NiAzMCA3OCA0OSBDODAgNjkgNzAgODYgNTAgODZaIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTUwIDIyIFY4MiIgc3Ryb2tlPSIjNzhjODUwIiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==",
    electric: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2Y4ZDAzMCIvPjxwb2x5Z29uIHBvaW50cz0iNTcsMTIgMjgsNTUgNDUsNTUgMzksODggNzIsNDMgNTQsNDMiIGZpbGw9IiNmZmYiLz48L3N2Zz4=",
    ice: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iIzk4ZDhkOCIvPjxnIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI3IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik01MCAxNCBWODYiLz48cGF0aCBkPSJNMTkgMzIgTDgxIDY4Ii8+PHBhdGggZD0iTTgxIDMyIEwxOSA2OCIvPjwvZz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI5IiBmaWxsPSIjZmZmIi8+PC9zdmc+",
    fighting: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2MwMzAyOCIvPjxyZWN0IHg9IjI4IiB5PSI0MCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjM2IiByeD0iMTMiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIzMiIgeT0iMzAiIHdpZHRoPSIxMSIgaGVpZ2h0PSIxNCIgcng9IjUuNSIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjQ0LjUiIHk9IjI3IiB3aWR0aD0iMTEiIGhlaWdodD0iMTciIHJ4PSI1LjUiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSI1NyIgeT0iMzAiIHdpZHRoPSIxMSIgaGVpZ2h0PSIxNCIgcng9IjUuNSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==",
    poison: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2EwNDBhMCIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNDQiIHI9IjI1IiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iMzciIHk9IjYyIiB3aWR0aD0iMjYiIGhlaWdodD0iMTgiIHJ4PSI1IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNDEiIGN5PSI0NCIgcj0iNyIgZmlsbD0iI2EwNDBhMCIvPjxjaXJjbGUgY3g9IjU5IiBjeT0iNDQiIHI9IjciIGZpbGw9IiNhMDQwYTAiLz48L3N2Zz4=",
    earth: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2UwYzA2OCIvPjxwb2x5Z29uIHBvaW50cz0iMTgsNzYgMzgsNDAgNTAsNTggNjIsMzQgODIsNzYiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIxNiIgeT0iNzYiIHdpZHRoPSI2OCIgaGVpZ2h0PSI3IiByeD0iMy41IiBmaWxsPSIjZmZmIi8+PC9zdmc+",
    rock: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2I4YTAzOCIvPjxwb2x5Z29uIHBvaW50cz0iMjQsNjQgMzMsNDAgNTIsMzMgNzAsNDMgNzYsNjQiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIyMiIgeT0iNjQiIHdpZHRoPSI1NiIgaGVpZ2h0PSI5IiByeD0iMyIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==",
    flying: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2E4OTBmMCIvPjxwYXRoIGQ9Ik0yMiA2NCBDNDAgNDAgNjQgMjggODQgMzIgQzcyIDQzIDYzIDUwIDU3IDY2IEM0NiA1OCAzMyA2MSAyMiA2NFoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=",
    bug: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2E4YjgyMCIvPjxlbGxpcHNlIGN4PSI1MCIgY3k9IjU4IiByeD0iMjEiIHJ5PSIyNSIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzAiIHI9IjExIiBmaWxsPSIjZmZmIi8+PGcgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjQuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48cGF0aCBkPSJNNTAgMjEgTDQxIDEwIi8+PHBhdGggZD0iTTUwIDIxIEw1OSAxMCIvPjwvZz48cGF0aCBkPSJNNTAgMzQgVjgyIiBzdHJva2U9IiNhOGI4MjAiIHN0cm9rZS13aWR0aD0iNCIvPjwvc3ZnPg==",
    ghost: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iIzcwNTg5OCIvPjxwYXRoIGQ9Ik01MCAxOCBDMzQgMTggMjUgMzMgMjUgNTAgVjgyIEwzNiA3MyBMNDcgODIgTDU5IDczIEw3MCA4MiBMNzUgNzMgVjUwIEM3NSAzMyA2NiAxOCA1MCAxOFoiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSI0MSIgY3k9IjQ2IiByPSI1IiBmaWxsPSIjNzA1ODk4Ii8+PGNpcmNsZSBjeD0iNTkiIGN5PSI0NiIgcj0iNSIgZmlsbD0iIzcwNTg5OCIvPjwvc3ZnPg==",
    dragon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iIzcwMzhmOCIvPjxwYXRoIGQ9Ik01MCAxNCBMNjMgMzggTDg4IDMwIEw3MiA1MiBMODggNzYgTDYwIDY4IEw1MCA4OCBMNDAgNjggTDEyIDc2IEwyOCA1MiBMMTIgMzAgTDM3IDM4WiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==",
    dark: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iIzcwNTg0OCIvPjxwYXRoIGQ9Ik01MCAzMCBDMzUgMzAgMjUgNDMgMjUgNTcgQzI1IDcyIDM3IDg0IDUwIDg0IEM2MyA4NCA3NSA3MiA3NSA1NyBDNzUgNDMgNjUgMzAgNTAgMzBaIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTMwIDM0IEwxOCAxMiBMNDEgMjNaIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTcwIDM0IEw4MiAxMiBMNTkgMjNaIiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNDEiIGN5PSI1NCIgcj0iNC41IiBmaWxsPSIjNzA1ODQ4Ii8+PGNpcmNsZSBjeD0iNTkiIGN5PSI1NCIgcj0iNC41IiBmaWxsPSIjNzA1ODQ4Ii8+PC9zdmc+",
    steel: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2I4YjhkMCIvPjxnIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjQ0IiB5PSIxMiIgd2lkdGg9IjEyIiBoZWlnaHQ9Ijc2IiByeD0iNCIvPjxyZWN0IHg9IjEyIiB5PSI0NCIgd2lkdGg9Ijc2IiBoZWlnaHQ9IjEyIiByeD0iNCIvPjxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEyIiByeD0iMyIgdHJhbnNmb3JtPSJyb3RhdGUoNDUgMzAgMzApIi8+PHJlY3QgeD0iNjQiIHk9IjI0IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIzIiB0cmFuc2Zvcm09InJvdGF0ZSg0NSA3MCAzMCkiLz48cmVjdCB4PSIyNCIgeT0iNjQiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgcng9IjMiIHRyYW5zZm9ybT0icm90YXRlKDQ1IDMwIDcwKSIvPjxyZWN0IHg9IjY0IiB5PSI2NCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEyIiByeD0iMyIgdHJhbnNmb3JtPSJyb3RhdGUoNDUgNzAgNzApIi8+PC9nPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE3IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iOCIgZmlsbD0iI2I4YjhkMCIvPjwvc3ZnPg==",
    fairy: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2VlOTlhYyIvPjxwYXRoIGQ9Ik01MCA4NCBDMjQgNjUgMTYgNTAgMTYgMzkgQzE2IDI3IDI3IDE4IDM4IDE4IEM0NCAxOCA0OCAyMiA1MCAyNyBDNTIgMjIgNTYgMTggNjIgMTggQzczIDE4IDg0IDI3IDg0IDM5IEM4NCA1MCA3NiA2NSA1MCA4NFoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=",
    light: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OSIgZmlsbD0iI2ZmZDcwMCIvPjxwYXRoIGQ9Ik01MCAxMCBMNjAgNDAgTDkwIDUwIEw2MCA2MCBMNTAgOTAgTDQwIDYwIEwxMCA1MCBMNDAgNDBaIiBmaWxsPSIjZmZmIi8+PC9zdmc+"
  },
  // 纯文本 fallback 用 emoji
  _emoji: {
    fire: '🔥', water: '💧', grass: '🌿', ice: '❄️',
    electric: '⚡', earth: '⛰️', rock: '🪨', normal: '⭐', fighting: '👊',
    poison: '☠️', flying: '🕊️', bug: '🐛', dragon: '🐉',
    ghost: '👻', dark: '😈', steel: '⚙️', fairy: '🌸', light: '✨',
    divine_fire: '🔥', divine_grass: '🌿', divine_water: '💧'
  },
  fire:    { name: "火",   color: "#f08030", bg: "rgba(240,128,48,0.2)" },
  water:   { name: "水",   color: "#6890f0", bg: "rgba(104,144,240,0.2)" },
  grass:   { name: "草",   color: "#78c850", bg: "rgba(120,200,80,0.2)" },
  ice:     { name: "冰",   color: "#98d8d8", bg: "rgba(152,216,216,0.2)" },
  electric:{ name: "电",   color: "#f8d030", bg: "rgba(248,208,48,0.2)" },
  earth:   { name: "土",   color: "#e0c068", bg: "rgba(224,192,104,0.2)" },
  normal:  { name: "普通", color: "#a8a878", bg: "rgba(168,168,120,0.2)" },
  fighting:{ name: "武",   color: "#c03028", bg: "rgba(192,48,40,0.2)" },
  poison:  { name: "毒",   color: "#a040a0", bg: "rgba(160,64,160,0.2)" },
  flying:  { name: "翼",   color: "#a890f0", bg: "rgba(168,144,240,0.2)" },
  bug:     { name: "虫",   color: "#a8b820", bg: "rgba(168,184,32,0.2)" },
  dragon:  { name: "龙",   color: "#7038f8", bg: "rgba(112,56,248,0.2)" },
  ghost:   { name: "幽灵", color: "#705898", bg: "rgba(112,88,152,0.2)" },
  dark:    { name: "恶魔", color: "#705848", bg: "rgba(112,88,72,0.2)" },
  steel:   { name: "机械", color: "#b8b8d0", bg: "rgba(184,184,208,0.2)" },
  fairy:   { name: "萌",   color: "#ee99ac", bg: "rgba(238,153,172,0.2)" },
  light:   { name: "光",   color: "#ffd700", bg: "rgba(255,215,0,0.2)" },
  rock:    { name: "石",   color: "#b8a038", bg: "rgba(184,160,56,0.2)" },
  divine_fire: { name: "神火", color: "#ad4e29", bg: "rgba(173,78,41,0.22)" },
  divine_grass: { name: "神草", color: "#3d8137", bg: "rgba(61,129,55,0.22)" },
  divine_water: { name: "神水", color: "#366bb9", bg: "rgba(54,107,185,0.22)" }
};

// ---------- TYPE CHART ----------
const TYPE_CHART = {};
const DIVINE_ELEMENTS = new Set(["divine_fire", "divine_grass", "divine_water"]);
const elementKeys = Object.keys(ELEMENTS).filter(key => !key.startsWith("_"));
elementKeys.forEach(key => { TYPE_CHART[key] = {}; });
function setEff(atk, def, val) { TYPE_CHART[atk][def] = val; }
setEff("fire", "grass", 2); setEff("fire", "ice", 2); setEff("fire", "bug", 2); setEff("fire", "steel", 2);
setEff("fire", "fire", 0.5); setEff("fire", "water", 0.5); setEff("fire", "dragon", 0.5); setEff("fire", "earth", 0.5);
setEff("water", "fire", 2); setEff("water", "earth", 2);
setEff("water", "water", 0.5); setEff("water", "grass", 0.5); setEff("water", "dragon", 0.5);
setEff("grass", "water", 2); setEff("grass", "earth", 2);
setEff("grass", "fire", 0.5); setEff("grass", "grass", 0.5); setEff("grass", "flying", 0.5); setEff("grass", "bug", 0.5); setEff("grass", "ice", 0.5); setEff("grass", "steel", 0.5);
setEff("ice", "grass", 2); setEff("ice", "earth", 2); setEff("ice", "flying", 2); setEff("ice", "dragon", 2);
setEff("ice", "fire", 0.5); setEff("ice", "water", 0.5); setEff("ice", "ice", 0.5); setEff("ice", "steel", 0.5);
// 石系（端游）：克火/冰/翼/虫；被水/草/武/土克制；火系被其抵抗
setEff("rock", "fire", 2); setEff("rock", "ice", 2); setEff("rock", "flying", 2); setEff("rock", "bug", 2);
setEff("water", "rock", 2); setEff("grass", "rock", 2); setEff("fighting", "rock", 2); setEff("earth", "rock", 2);
setEff("fire", "rock", 0.5);
setEff("electric", "water", 2); setEff("electric", "flying", 2);
setEff("electric", "grass", 0.5); setEff("electric", "electric", 0.5); setEff("electric", "dragon", 0.5); setEff("electric", "earth", 0);
setEff("earth", "fire", 2); setEff("earth", "electric", 2); setEff("earth", "poison", 2); setEff("earth", "steel", 2);
setEff("earth", "grass", 0.5); setEff("earth", "bug", 0.5); setEff("earth", "flying", 0);
setEff("normal", "ghost", 0);
setEff("fighting", "normal", 2); setEff("fighting", "ice", 2); setEff("fighting", "dark", 2); setEff("fighting", "steel", 2);
setEff("fighting", "flying", 0.5); setEff("fighting", "poison", 0.5); setEff("fighting", "bug", 0.5); setEff("fighting", "fairy", 0.5); setEff("fighting", "ghost", 0);
setEff("poison", "grass", 2); setEff("poison", "fairy", 2);
setEff("poison", "poison", 0.5); setEff("poison", "earth", 0.5); setEff("poison", "ghost", 0.5); setEff("poison", "steel", 0);
setEff("flying", "grass", 2); setEff("flying", "fighting", 2); setEff("flying", "bug", 2);
setEff("flying", "electric", 0.5); setEff("flying", "steel", 0.5);
setEff("bug", "grass", 2); setEff("bug", "dark", 2);
setEff("bug", "fire", 0.5); setEff("bug", "fighting", 0.5); setEff("bug", "poison", 0.5); setEff("bug", "flying", 0.5); setEff("bug", "ghost", 0.5); setEff("bug", "steel", 0.5); setEff("bug", "fairy", 0.5);
setEff("dragon", "dragon", 2);
setEff("dragon", "steel", 0.5); setEff("dragon", "fairy", 0);
setEff("ghost", "ghost", 2);
setEff("ghost", "dark", 0.5); setEff("ghost", "normal", 0);
setEff("dark", "ghost", 2);
setEff("dark", "fighting", 0.5); setEff("dark", "dark", 0.5); setEff("dark", "fairy", 0.5);
setEff("steel", "ice", 2); setEff("steel", "fairy", 2);
setEff("steel", "fire", 0.5); setEff("steel", "water", 0.5); setEff("steel", "electric", 0.5); setEff("steel", "steel", 0.5);
setEff("fairy", "fighting", 2); setEff("fairy", "dragon", 2); setEff("fairy", "dark", 2);
setEff("fairy", "fire", 0.5); setEff("fairy", "poison", 0.5); setEff("fairy", "steel", 0.5);
setEff("light", "dark", 2); setEff("light", "ghost", 2); setEff("light", "fighting", 2);
setEff("light", "grass", 0.5); setEff("light", "steel", 0.5);
setEff("dark", "light", 0.5); setEff("bug", "light", 0.5); setEff("fighting", "light", 0.5); setEff("ghost", "light", 0.5);

// 页游《洛克王国》官方论坛属性克制抵抗表（tid=158387）。
for (const divine of DIVINE_ELEMENTS) {
  for (const standard of elementKeys) {
    if (!DIVINE_ELEMENTS.has(standard)) setEff(divine, standard, 2);
  }
}
for (const [attacker, defender] of [
  ["divine_water", "divine_fire"],
  ["divine_fire", "divine_grass"],
  ["divine_grass", "divine_water"]
]) {
  setEff(attacker, defender, 2);
  setEff(defender, attacker, 0.5);
}
for (const [defender, resisted] of [
  ["divine_fire", ["grass", "ice", "bug", "steel"]],
  ["divine_grass", ["water", "electric", "grass", "earth"]],
  ["divine_water", ["fire", "ice", "steel"]]
]) {
  for (const attacker of resisted) setEff(attacker, defender, 0.5);
}

function elemIcon(el, cls) { var src = ELEMENTS._icon && ELEMENTS._icon[el]; return src ? '<img class="' + (cls || 'elem-ico-sm') + '" src="' + src + '" alt="">' : ''; }
function getElementEmoji(el) { var src = ELEMENTS._icon && ELEMENTS._icon[el]; return src ? '<img class="elem-ico" src="' + src + '" alt="' + el + '">' : (ELEMENTS._emoji[el] || '❓'); }

// 技能图标统一使用所属系别图标（不按技能单独区分）
function getSkillIcon(skill) { return getElementEmoji(skill ? skill.element : ''); }

function getEffectiveness(atkEl, defEl) { return TYPE_CHART[atkEl]?.[defEl] ?? 1; }
function getEffLabel(val) { if (val >= 2) return "效果拔群！"; if (val <= 0.5 && val > 0) return "效果不佳..."; if (val === 0) return "没有效果！"; return ""; }

const GALE_WEATHER = "gale";
const WEATHER_DISPLAY = {
  sunny: ["☀", "暴晒"],
  rainy: ["🌧", "暴雨"],
  sandstorm: ["🌪", "沙暴"],
  hailstorm: ["❄", "冰雹"],
  mist: ["≈", "迷雾"],
  [GALE_WEATHER]: ["💨", "疾风"]
};

// ---------- DEFAULT SKILLS ----------
const QINGYU_ORIGINAL_BLOODLINE_DETAIL = "进入原初血脉状态：缺少清翎覆尘或残风临霜，或首格并非这两招之一时，自上场起永久免疫烧伤、冰冻、麻痹、中毒、睡眠、沉睡、混乱、恐惧、寄生，所受威力伤害和固定伤害降低 20%。进入清念或残脉时，原初血脉的免疫和减伤一并解除。";
const DEFAULT_SKILLS = [
  { id: "sk_jydm_1", name: "极尽降华", element: "normal", power: 0, pp: 1, maxPp: 1, accuracy: 100, category: "status", priority: 15,
    ppRecoverySource: ["化念作刃清印", "瞬华若霜冰冻"], passiveLabel: "被动发动",
    desc: "使双方技能暂时变为光系，提高全场回复和输出。发动回合免疫外来效果，持续限伤并封禁原为神系的伤害来源技能。上场前三回合免删，删空可被动发动。",
    detail: "① 每次上场后的前三回合免疫删 PP。被删至 0 PP 时，若仍在场且存活，回合末被动发动并触发明念。只有化念作刃清印回首格，或瞬华若霜满足冰冻与印记条件回首格，才能回复本招 PP。\n② 双方队伍所有技能视为光系 6 回合，发动时被自身标记的目标单独持续 12 回合。6 回合内双方全队的精力回复和输出伤害各提高 100%，自身免疫异常与负面强化，场地锁定为无天气、无环境。\n③ 发动回合免疫外来的正面与负面效果，自身效果照常。对手同一只宠物在本次降华期间第 3 次尝试召唤天气或环境时受到 999 点固伤。\n④ 首次发动回满精力和其他可回复技能的 PP，后续回复量为上次的 85%。每回合累计承伤上限初始为 300 点，每次再发动降低 20 点，最低为 100 点。\n⑤ 若受到原为神水、神火或神草的技能造成的实际伤害，该来源技能下一回合无法使用。同一回合该招多段伤害只算一次封技。限伤与封技合计每触发两次，获得 1 层光明之印。",
    onUse: function(u, t, ctx) {
      const bd = mingnianData(u);
      const turn = gameState.turnCount;
      const priorCasts = bd.jianghuaCasts || 0;
      bd.jianghuaCasts = priorCasts + 1;
      bd.jianghuaThrough = turn + 5;
      bd.jianghuaCap = Math.max(100, 300 - 20 * priorCasts);
      bd.jianghuaDamage = 0;
      bd.jianghuaDamageTurn = turn;
      bd.jianghuaSummons = new Map();
      const roster = new Set([...ctx.playerParty, ...ctx.aiParty, u, t]);
      for (const pet of roster) {
        if (!pet) continue;
        setSkillElement(pet, u, "light", isMingnianMarked(u) && pet === bd.markTarget ? 12 : 6);
        pet.jianghuaGlobalThrough = Math.max(pet.jianghuaGlobalThrough ?? -1, turn + 5);
      }
      (gameState.jianghuaOwners ||= new Set()).add(u);
      gameState.weather = null; gameState.weatherTurns = 0;
      gameState.field = null; gameState.fieldTurns = 0;
      u.externalEffectImmuneTurn = turn;
      delete gameState.fieldLockedThrough;
      ctx.grantStatusImmunity(u, "极尽降华", 6, { stats: true });
      syncMingnianMaxHP(u);
      if (u.bloodline?.name === "明念") {
        const ratio = Math.pow(0.85, priorCasts);
        ctx.doHeal(u, Math.floor((u.maxHp + (u.maxHpBonus || 0)) * ratio));
        for (const skill of u.skills) gainPP(u, skill, Math.floor(skill.maxPp * ratio), "sk_jydm_1");
      }
      ctx.msg("【极尽降华】全场同调、锁定场地，当回合免疫外来效果！");
    } },
  { id: "sk_jydm_2", name: "化念作刃", element: "fighting", power: 90, pp: 9, maxPp: 9, accuracy: 100, category: "physical", priority: 11,
    desc: "先手时按对方的实际出招结算闪避。后手删对方先手招 3 PP，并施加双损。四回合内回复自身，按明念标记触发额外固伤和 PP 效果。",
    detail: "① 先手时，闪避对方后手常规非必中招式，闪避成功则本次物攻按 +2 级结算。若对方实际出招且无法闪避，倒置双方强化并删除对方各技能 2 PP。对方未出招时跳过闪避判定。\n② 后手时，删除对方本回合先手所用技能 3 PP，并使对方后续 4 回合获得双损，每次出招多消耗 1 PP。\n③ 4 回合内免疫异常与驱逐，每回合回复 30% 最大精力，并为上次被删 PP 的各技能回复 1 PP。\n④ 首段攻击标记目标时，追加（0.4 × 对方上回合输出 × 对方各项强化绝对级数之和）点固伤，自身永久免疫驱逐。光明之印少于 4 层时，对方各技能额外损失 1 PP，本次暴击则再删各 1 PP。至少 4 层时追加 999 点固伤，清除印记并回满首格，可回复极尽降华。\n⑤ 次回合与再次回合，对方技能的基础 PP 消耗翻倍，各项强化向零缩减 30%，并受到 60 点固伤。对方被标记时改为缩减 36% 并造成 72 点固伤。每回合回复自身第 2 格 1 PP，该格若是极尽降华则改回第 3 格。\n⑥ 末回合，若对方仍被标记、有至少两项负面强化且光明之印超过 2 层，追加（200 + 60% × 对方当前精力）点固伤。",
    onUse: function(u, t, ctx) {
      ctx.grantStatusImmunity(u, "化念作刃", 4, { statuses: ABNORMAL_WITHOUT_BIND });
      const through = gameState.turnCount + 3;
      u.dimoEjectImmuneThrough = Math.max(u.dimoEjectImmuneThrough ?? -1, through);
      const recover = function(p) {
        for (const skill of p.lastPPDeletedSkills || []) gainPP(p, skill, 1, "sk_jydm_2");
        ctx.doHeal(p, Math.floor((p.maxHp + (p.maxHpBonus || 0)) * 0.3));
      };
      recover(u);
      ctx.addTurnEffect(u, "化念作刃持续", 3, function(p) {
        recover(p);
        const opponent = getActiveOpponent(p);
        if (opponent && gameState.turnCount === through &&
            p.bloodlineData?.markTarget === opponent && p.bloodlineData.marks > 2 &&
            STAGE_FIELDS.filter(key => opponent[key] < 0).length >= 2) {
          ctx.doFixedDamage(opponent, 200 + Math.floor(0.6 * opponent.hp), p);
        }
      });
      ctx.setPPCostEffect(t, "化念中段", 3, { multiplier: 2 });
      ctx.addTurnEffect(u, "化念作刃削", 2, function(p) {
        const opponent = getActiveOpponent(p);
        if (!opponent) return;
        const marked = isMingnianMarked(p) && p.bloodlineData.markTarget === opponent;
        ctx.transformStages(opponent, value => Math.trunc(value * (marked ? 0.64 : 0.7)));
        const slot = p.skills[1]?.id === "sk_jydm_1" ? 2 : 1;
        gainPP(p, p.skills[slot], 1, "sk_jydm_2");
        ctx.doFixedDamage(opponent, marked ? 72 : 60, p);
      });
      const first = gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai");
      if (first && ctx.skillAction && gameState.resolvingTurn) {
        u.dimoPendingAttack = { target: t, ctx, action: ctx.skillAction, turn: gameState.turnCount };
      } else {
        if (!first) {
          const slot = getRoundSkillSlot(t, true);
          if (slot >= 0) ctx.deletePP(t, slot, 3);
          ctx.setPPCostEffect(t, "化念双损", 5, { extra: 1 });
        }
        dimoAttack(u, t, ctx, null);
      }
    } },
  { id: "sk_jydm_3", name: "极影光幕", element: "light", power: 0, pp: 6, maxPp: 6, accuracy: 90, category: "status", priority: 13, semiSure: true,
    desc: "回血、净化、加速并逐回合叠盾。十回合内可闪避一次致死伤害并回复全体技能 PP。对方在七回合窗口内连用同一招三回合后，该招进入三损。",
    detail: "① 回复自身 60% 最大精力，光明之印至少 2 层时回复量提高 50%。十回合内闪避一次致死伤害，闪避成功回复自身各技能 1 PP。\n② 净化自身，5 回合内免疫异常与负面强化。速度提高（5 + 自身上回合输出 ÷ 220）%，上限 10%。\n③ 4 回合内每回合获得（70 + 0.2 × 对方上回合输出 + 0.1 × 自身实际速度）点护盾，向下取整。护盾可叠加，上限为自身最大精力。若被标记目标击破护盾，清除自身异常和负面强化，之后本技能提供的护盾提高 20%。\n④ 检查发动前 3 回合、发动当回合和之后 3 回合，主动与明确计为被动的出招均计入。对方连续 3 回合使用同一个技能后，该技能之后每次使用额外消耗 2 PP。",
    onUse: function(u, t, ctx) {
      const m = mingnianData(u).marks;
      ctx.doHeal(u, Math.floor((u.maxHp + (u.maxHpBonus || 0)) * (m >= 2 ? 0.9 : 0.6)));
      u.dodgeLethalLeft = 1;
      u.dimoLethalDodgeThrough = gameState.turnCount + 9;
      ctx.cleanseAbnormalStatuses(u);
      STAGE_FIELDS.forEach(key => { if (u[key] < 0) u[key] = 0; });
      ctx.grantStatusImmunity(u, "极影光幕", 5, { stats: true });
      const speed = 1 + Math.min(10, 5 + (u.lastTurnOutput || 0) / 220) / 100;
      u.spdMod *= speed;
      ctx.addTurnEffect(u, "光幕速度", 5, null, p => p.spdMod /= speed);
      const shield = function(p) {
        const opponent = getActiveOpponent(p);
        const amount = Math.floor((70 + 0.2 * (opponent?.lastTurnOutput || 0) + 0.1 * p.getStat("spd")) *
            (p.dimoScreenShieldBoost ? 1.2 : 1));
        ctx.addShield(p, Math.max(0, Math.min(amount, p.maxHp + (p.maxHpBonus || 0) - p.shield)));
      };
      u.dimoScreenShieldThrough = gameState.turnCount + 3;
      u.dimoScreenShieldBoost = false;
      shield(u);
      ctx.addTurnEffect(u, "光幕护盾", 3, shield);
      const watched = skillEffectTarget(ctx, t, "pp");
      if (watched) {
        watched.dimoScreenWindows ||= new Map();
        watched.dimoScreenWindows.set(u, gameState.turnCount);
        applyDimoScreenCosts(watched);
      }
    } },
  { id: "sk_jydm_4", name: "瞬华若霜", element: "ice", power: 100, pp: 8, maxPp: 8, accuracy: 100, category: "physical", priority: 7,
    desc: "冰冻成功时删 PP 并减半对方回复，失败则回 PP 并倒置对方正面强化。先手非梦境时提高本招后续先手并追加两段固伤，后手追加冰冻并锁定梦境。",
    detail: "① 实际威力为（100 + 20 × 光明之印层数 + 0.05 × 自身实际速度），向下取整。\n② 冰冻成功时，删除对方各技能 1 PP。对方 2 回合内精力及 PP 回复减半，向上取整。光明之印至少 4 层时追加 9999 点固伤并回复自身各技能 2 PP，若首格为极尽降华，另为其回复 1 PP，同时自身前两格永久免删。\n③ 冰冻失败时，回复自身各技能 1 PP，并强制倒置对方的正面强化。\n④ 先手且场上不是梦境时，追加两段与本技能实际威力等量的固伤，随后两个回合本技能的基础先手提升至 +4。\n⑤ 后手追加冰冻并尝试锁定梦境 3 回合。光明之印至少 4 层时另回复自身各技能 4 PP。锁定梦境和追加回复均不依赖追加冰冻是否成功。梦境反转双方的先后判定。",
    onUse: function(u, t, ctx) {
      const m = mingnianData(u).marks;
      const power = Math.floor(100 + 20 * m + 0.05 * u.getStat("spd"));
      const first = gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai");
      const inDream = gameState.field === "dream";
      const r = ctx.doDamage(u, t, power, "physical", "ice");
      ctx.msg("造成 " + r.damage + " 点伤害！" + getEffLabel(r.effectiveness));
      if (ctx.applyStatus(t, "freeze")) {
        ctx.deletePP(t, -1, 1);
        ctx.halveRecovery(t, 2);
        if (m >= 4) {
          ctx.doFixedDamage(t, 9999, u);
          for (const skill of u.skills) gainPP(u, skill, 2, "sk_jydm_4");
          if (u.skills[0]?.id === "sk_jydm_1") gainPP(u, u.skills[0], 1, "瞬华若霜冰冻");
          u.skills.slice(0, 2).forEach(skill => skill.immuneToPP = true);
        }
      } else {
        for (const skill of u.skills) gainPP(u, skill, 1, "sk_jydm_4");
        ctx.transformStages(t, value => value > 0 ? -value : value);
      }
      if (first && !inDream) {
        const skill = u.skills.find(item => item.id === "sk_jydm_4");
        if (skill) skill.dimoFastThrough = gameState.turnCount + 2;
        ctx.doFixedDamage(t, power, u);
        ctx.doFixedDamage(t, power, u);
      } else if (!first) {
        ctx.applyStatus(t, "freeze");
        ctx.setField("dream", 3, { locked: true });
        if (m >= 4) for (const skill of u.skills) gainPP(u, skill, 4, "sk_jydm_4");
      }
    } },
  { id: "sk_jydm_5", name: "炽光若焰", element: "fire", power: 120, pp: 8, maxPp: 8, accuracy: 90, category: "special", priority: 9, semiSure: true, desc: "烧伤成功则追加多段固伤。失败则清空本招和对方同格技能的 PP，本招随后 12 回合禁回 PP。使用后可锁定瞬华环境。", detail: "① 实际威力等于（120 + 0.1 × 自身魔攻能力值），向下取整。烧伤成功时，追加 2–4 段固伤，每段 70–100 点。\n② 烧伤失败时，清空本招 PP，并尝试清空对方同一格技能的 PP。本招从发动起 12 个战斗回合无法回复 PP。\n③ 尝试召唤并锁定瞬华环境 4 回合。瞬华中，光系宠物速度提高 15%，先手出招的宠物回复 100 点精力。威力伤害被抵抗时，追加相当于原伤害 30% 的固伤。",
    onUse: function(u, t, ctx) {
      var power = Math.floor(120 + 0.1 * u.getStat("spatk"));
      ctx.msg(u.name + " 使用了炽光若焰！实际威力" + power + "！");
      var r = ctx.doDamage(u, t, power, "special", "fire");
      ctx.msg("造成 " + r.damage + " 点伤害！" + getEffLabel(r.effectiveness) + (r.isCrit ? " 命中要害！" : ""));
      // 烧伤效果
      if (ctx.applyStatus(t, "burn")) {
        var segs = 2 + Math.floor(Math.random() * 3); // 2~4段
        for (var i = 0; i < segs; i++) {
          ctx.doFixedDamage(t, 70 + Math.floor(Math.random() * 31));
        }
        ctx.msg("烧伤成功！追加" + segs + "段浮动固伤！");
      } else {
        var self = u.skills.find(function(s){ return s.id === "sk_jydm_5"; });
        if (self) {
          setSkillPP(u, self, 0, "清空自身 PP", "炽光若焰·烧伤失败");
          self.noPPRecoverThrough = gameState.turnCount + 11;
        }
        // R14：清空对方同格技能（不按技能 id 匹配）
        var mySlot = u.skills.findIndex(function(s){ return s.id === "sk_jydm_5"; });
        if (mySlot >= 0) ctx.deletePP(t, mySlot, Infinity);
        ctx.msg("烧伤失败：清空双方炽光若焰PP，本技能12回合内无法回复！");
      }
      // 4回合召唤锁定瞬华环境
      ctx.setField("shunhua", 4, { locked: true });
    } },
{ id: "sk_cszn", name: "创世之能", element: "normal", power: 0, pp: 3, maxPp: 3, accuracy: 100, category: "status", priority: 14,
    passiveLabel: "携带被动",
    desc: "携带时免疫束缚、恐惧、睡眠和冰冻，本招无 PP 时免疫全部异常。主动发动三回合，增加速度与输出、吸取 PP，并分别结算回满精力、重置强化，末回合精力低于 30% 时回复精力并清空本招 PP。",
    detail: "① 创世神钟携带本技能时，无需出招即免疫束缚、恐惧、睡眠、冰冻。当前PP为0时，免疫所有异常状态。PP恢复后保留原有四种免疫。\n② 主动效果持续 3 回合。发动时在场的两只宠物速度各提高 10%，自身所有类型输出提高 25%。重复发动刷新效果。\n③ 每回合从当前在场对手的各技能最多吸取 2 PP，按实际扣除量回复自己的对应格。首回合吸取后，锁定对方所有并列最低 PP 的技能，使其出招额外消耗 1 PP。0 PP 也参与比较。\n④ 首回合回满精力，免疫对方后手施加给自身的效果。若先手，额外删除对方各技能 1 PP。\n⑤ 次回合强制清除在场双方强化，并尝试回满自身首格技能的 PP。\n⑥ 末回合自身精力低于最大精力的 30% 时，回复 70% 已损精力，并清空本招 PP。\n⑦ 免疫常规删 PP 和回 PP。时间回溯与逆流而行的强制清空可以越过对应保护。",
    immuneToPP: true, noPPRecover: true,
    onUse: function(user, target, ctx) {
      const data = user.bloodlineData ||= {};
      endCreation(user);
      const turn = gameState.turnCount;
      data.creationThrough = turn + 2;
      data.creationTarget = skillEffectTarget(ctx, target, "stat");
      data.creationActive = true;
      (gameState.creationOwners ||= new Set()).add(user);
      (user.creationSpeedSources ||= new Set()).add(user);
      if (data.creationTarget) (data.creationTarget.creationSpeedSources ||= new Set()).add(user);

      user.immuneBackhandEffects = true;
      if (gameState.pendingFirstMove === (gameState.playerActive === user ? "player" : "ai")) ctx.deletePP(target, -1, 1);
      ctx.doHeal(user, user.maxHp + (user.maxHpBonus || 0) - user.hp);
      creationPP(user, target, ctx);
      if (target.skills.length) {
        const lowest = Math.min(...target.skills.map(skill => skill.pp));
        const charged = skillEffectTarget(ctx, target, "pp");
        data.creationCosts = [];
        for (const [slot, skill] of target.skills.entries()) {
          if (skill.pp !== lowest) continue;
          const source = { user, slot, skill: "创世之能" };
          ctx.setPPCostEffect(target, source, 3, { extra: 1, skill });
          if (charged) data.creationCosts.push([charged, source]);
        }
      }
      ctx.msg("创世之能发动，持续3回合！");
    }
  },
  { id: "sk_nlex", name: "逆流而行", element: "divine_water", power: 135, pp: 2, maxPp: 2, accuracy: 100, category: "physical", priority: 12,
    desc: "回溯双方全队的精力、PP、强化和异常，本招自身 PP 除外。按精力差追加固伤，同时为己方场下第二格回 PP。本招耗尽后自身失去属系，下一次威力招触发终结效果。",
    detail: "① 将双方全队的精力、PP、强化和异常回溯到 3 回合前，跳过施放者本招的 PP。每场战斗最多使用本招 2 次。开战不足 3 回合时回到开战初始。追加固伤等于双方全队合计精力在回溯前后的差值绝对值。\n② 回复己方仍存活的场下第二格宠物各技能 1 PP。若创世之能无 PP，则改回 2 PP。\n③ 本次扣费耗尽本招 PP，或回溯后本招 PP 为 0 时，自身失去属系。下一次威力招结算时，按逆流而行的累计使用次数触发以下效果。\n④ 使用过 1 次时，追加 9999 点固伤，强制清空当前目标的全部技能 PP，回复自身各技能 1 PP。使用过 2 次时，回复自身各技能 3 PP 和 30% 最大精力。\n⑤ 若创世之能无 PP，清除并锁定在场双方的正负强化 6 回合。\n⑥ 免疫常规删 PP 和回 PP。时间回溯和强制清空可跨常规保护，历史回溯最多为本招恢复至剩余可用次数。",
    immuneToPP: true, noPPRecover: true, useLimit: 2,
    onUse: function(user, target, ctx) {
      ctx.msg(user.name + " 使用了逆流而行！时间倒流，逆转法则！");
      // 威力伤害
      var r = ctx.doDamage(user, target, 135, "physical", "divine_water");
      ctx.msg("造成 " + r.damage + " 点伤害！" + getEffLabel(r.effectiveness));
      const nlexSkill = user.skills.find(skill => skill.id === "sk_nlex");
      const spentLastPP = nlexSkill?.pp === 0 || (ctx.sourceSkill === nlexSkill && ctx.skillPPAfter === 0);
      // 时间回溯：双方全体宠物的精力/PP/强化/异常回到3回合前，追加精力差固伤
      var hpDiff = ctx.restoreSnapshot(3, nlexSkill);
      if (hpDiff > 0) {
        ctx.doFixedDamage(target, hpDiff);
        ctx.msg("状态回溯造成 " + hpDiff + " 点固定伤害！");
      }
      var party = gameState.playerActive === user ? gameState.playerParty : gameState.aiParty;
      var bench = party.filter(function(p) { return p !== user; })[1];
      var cszn = user.skills.find(function(s) { return s.id === "sk_cszn"; });
      if (bench && !bench.isFainted()) {
        var recover = cszn && cszn.pp === 0 ? 2 : 1;
        bench.skills.forEach(function(s) { gainPP(bench, s, recover, "sk_nlex"); });
        ctx.msg("场下" + bench.name + "全体技能恢复" + recover + "PP！");
      }
      // 通用出招流程已计入本次使用。
      if (!user.skillUseCounts) user.skillUseCounts = {};
      var nlexCount = ctx.sourceSkill?.useCount ?? ((user.skillUseCounts["sk_nlex"] || 0) + 1);
      // 当PP=0: 失去属系
      if (spentLastPP || nlexSkill?.pp === 0) {
        if (!user.elementLost) {
          user.elementOriginal = user.element;
          user.element = null;
          user.elementLost = true;
          ctx.msg(user.name + " 失去了属系！");
          renderBattle(document.querySelector("#app"));
        }
        // 根据使用次数记录延迟效果：下一次威力技能结算时触发
        user.pendingNilex = { cnt: nlexCount };
        ctx.msg("逆流之力积蓄：下一次威力技能将触发终结效果！");
      }
      // 若创世之能PP=0: 清除并锁定强化6回合
      if (cszn && cszn.pp === 0) {
        ctx.resetAndLockStages(user, 6);
        ctx.resetAndLockStages(target, 6);
        ctx.msg("创世之能PP=0：清除并锁定双方强化6回合！");
      }
    }
  },
  { id: "sk_mszw", name: "灭世之威", element: "fighting", power: 70, pp: 12, maxPp: 12, accuracy: 100, category: "physical", priority: 9,
    desc: "先手追加固伤和恐惧，后手必暴并删 PP。可提前结束创世之能以提高威力。满足空 PP 条件时额外造成 9999 点固伤并回复 PP。",
    detail: "① 先手追加对方最大精力 30% 的固伤，并施加恐惧。\n② 后手时必中必暴，删除对方每个技能（1 + 自身负面强化的等级绝对值之和）点 PP。威力伤害被抵抗时，额外尝试清空对方上次实际使用技能的 PP。\n③ 创世之能持续期间使用时，结束其剩余效果，本招威力提高到 170，本次物攻按 +3 级结算，并回复 200 点精力。\n④ 若创世之能无 PP，且至少 2 个技能无 PP（含创世之能），自身剩余 PP 合计少于 8，则追加 9999 点固伤，并回满自身可回复技能的 PP。",
    onUse: function(user, target, ctx) {
      ctx.msg(user.name + " 使用了灭世之威！");
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === user ? "player" : "ai"));
      var bd = user.bloodlineData;
      var inCreation = !!(bd && bd.creationActive);
      // 处于创世之能回合内：消耗剩余回合并把威力提升到 170、物攻按 +3
      if (inCreation) {
        endCreation(user);
        ctx.msg("创世之能剩余回合结束，威力提升至170，视物攻+3！");
      }
      var basePower = inCreation ? 170 : 70;
      var dmgOpts = inCreation ? { atkStageOverride: 3 } : {};
      var r;
      if (isFirst) {
        r = ctx.doDamage(user, target, basePower, "physical", "fighting", dmgOpts);
        var bonus = Math.floor(target.maxHp * 0.3);
        ctx.doFixedDamage(target, bonus);
        ctx.msg("造成 " + r.damage + " 点伤害！追加" + bonus + "点固伤！");
        ctx.fear(target);
      } else {
        var backOpts = Object.assign({ guaranteedCrit: true }, dmgOpts);
        r = ctx.doDamage(user, target, basePower, "physical", "fighting", backOpts);
        var negCount = 0;
        STAGE_FIELDS.forEach(function(s) { if (user[s] < 0) negCount += Math.abs(user[s]); });
        ctx.deletePP(target, -1, 1 + negCount);
        ctx.msg("造成 " + r.damage + " 点伤害！(必爆) 删除对方全体技能" + (1+negCount) + "PP！");
        if (r.effectiveness < 1) {
          var lastSlot = target.skills.findIndex(function(s) { return s.id === target.lastUsedSkillId; });
          if (lastSlot >= 0) { ctx.deletePP(target, lastSlot, target.skills[lastSlot].pp); ctx.msg("伤害被抵抗，删除对方上次使用技能PP！"); }
        }
      }
      if (inCreation) {
        ctx.doHeal(user, 200);
        ctx.msg("回复200精力！");
      }
      // 创世之能PP=0且2技能PP=0且剩余PP<8
      var cszn = user.skills.find(function(s) { return s.id === "sk_cszn"; });
      var zeroPPSkills = user.skills.filter(function(s) { return s.pp === 0; });
      var totalPP = user.skills.reduce(function(a,s) { return a + s.pp; }, 0);
      if (cszn && cszn.pp === 0 && zeroPPSkills.length >= 2 && totalPP < 8) {
        ctx.doFixedDamage(target, 9999);
        user.skills.forEach(function(s) { gainPP(user, s, s.maxPp, "sk_mszw"); });
        ctx.msg("灭世之威·终焉：9999固伤！回复满技能PP！");
      }
    }
  },
  { id: "sk_fthy", name: "覆体魂衣", element: "normal", power: 0, pp: 8, maxPp: 8, accuracy: 100, category: "status", priority: 11,
    desc: "净化、防控并提升双防，强化损失时对敌造成固伤。常规分支消耗精力换取限伤。创世之能无 PP 时改为回血、减伤和倒置治疗，天气或环境可追加回复。",
    detail: "① 常规分支消耗 15% 当前精力，最低保留 1 点。2 回合内，超过自身最大精力 15% 的单段伤害上限为 80 点。\n② 两个分支都获得 4 回合异常免疫，物防和魔防各提升 2 级，并净化自身异常、反转负面强化。\n③ 防控期间每次有强化消失，对敌造成该次等级变化的绝对值 × 80 点固伤。\n④ 若发动时有天气或环境，锁定额外回复条件，防控期间每回合回复 120 点精力和全体技能各 1 PP。\n⑤ 创世之能无 PP 时改为回复 400 点精力，1 回合减伤 70%，并倒置对方 1 回合的治疗。防控期间每回合回复自身 20% 最大精力和最低 PP 技能 1 PP，并随机将七项强化之一降低 1 级。",
    onUse: function(user, target, ctx) {
      var cszn = user.skills.find(function(s) { return s.id === "sk_cszn"; });
      var csznEmpty = cszn && cszn.pp === 0;
      if (csznEmpty) {
        // 不扣血，回复400
        ctx.doHeal(user, 400);
        ctx.setDamageReduction(user, 70);
        // 倒置对方1回合治疗
        ctx.invertHealing(target, 1.0, 1);
        ctx.msg(user.name + " 回复400HP！1回合内减少70%所受伤害！");
        ctx.addTurnEffect(user, "覆体疗愈", 4,
          function(p) {
            ctx.doHeal(p, Math.floor(p.maxHp * 0.2));
            var lowest = p.skills.reduce(function(a,b) { return (a.pp <= b.pp) ? a : b; }, p.skills[0]);
            if (lowest) gainPP(p, lowest, 1, "sk_fthy");
            // 每回合给自身一个负面强化
            const stats = Object.keys(STAGE_LABELS);
            const rnd = stats[Math.floor(Math.random() * stats.length)];
            ctx.modifyStat(p, rnd, -1);
          }, null
        );
      } else {
        // 扣除15%当前HP
        var cost = Math.floor(user.hp * 0.15);
        if (user.hp - cost <= 0) cost = user.hp - 1; // 不会致死
        user.hp = Math.max(1, user.hp - cost);
        ctx.msg(user.name + " 消耗了" + cost + "点精力值！");
        // 2回合限伤: >15%最大HP的伤害减少至80
        ctx.setDamageCap(user, Math.floor(user.maxHp * 0.15), 80, 2);
      }
      ctx.grantStatusImmunity(user, "覆体魂衣", 4, { statuses: ABNORMAL_WITHOUT_BIND });
      user.futiThrough = gameState.turnCount + 3;
      // 物防和魔防各提升2级 + 净化 + 反转负面
      ctx.modifyStat(user, "def", 2);
      ctx.modifyStat(user, "spdef", 2);
      ctx.cleanseAbnormalStatuses(user);
      STAGE_FIELDS.forEach(function(s) {
        if (user[s] < 0) user[s] = Math.abs(user[s]);
      });
      ctx.msg(user.name + " 物防和魔防各+2，净化异常，反转负面强化！");
      // 若场上有天气/环境：防控回合内每回合回复
      if (gameState.weather || gameState.field) {
        ctx.addTurnEffect(user, "覆体天气", 4, function(p) {
          ctx.doHeal(p, 120);
          p.skills.forEach(function(s){ gainPP(p, s, 1, undefined, "覆体魂衣·场地回复"); });
          ctx.msg("【覆体魂衣】天气/环境回复120精力与全体1PP！");
        }, null);
        ctx.msg("场上存在天气/环境：防控回合内每回合回复120HP与全体1PP！");
      }
    }
  },
  { id: "sk_cyjy", name: "重衍纪元", element: "normal", power: 0, pp: 1, maxPp: 1, accuracy: 100, category: "status", priority: 1,
    passiveLabel: "携带被动",
    desc: "本招有 PP 时，自身所有输出伤害降低 40%。逆转双方全队 PP 至近 24 回合总 PP 最低的一份记录。其他技能有空 PP 时无效，后手结算后自身阵亡。",
    detail: "① 本招有 PP 时，自身造成的所有类型伤害降低 40%。本招免疫常规删 PP 和回 PP，时间回溯可恢复历史值。\n② 自身任一其他技能无 PP 时，本招无效。\n③ 从最近 24 回合中选出全场总 PP 最低的一份记录，使双方全队的技能 PP 一并回到该记录。该回溯可越过常规 PP 保护。\n④ 先手时结算回溯后存活，后手时结算回溯后自身阵亡。",
    immuneToPP: true, noPPRecover: true,
    onUse: function(user, target, ctx) {
      ctx.msg(user.name + " 释放了重衍纪元！纪元重衍，万物复苏！");
      // 检查是否有技能PP为空
      var hasEmpty = user.skills.some(function(s) { return s.pp === 0 && s.id !== "sk_cyjy"; });
      if (hasEmpty) {
        ctx.msg("有技能PP为空，重衍纪元无效！");
        return;
      }
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === user ? "player" : "ai"));
      ctx.rewindPPToMin(24);
      if (isFirst) {
        ctx.msg(user.name + " 将双方全体宠物PP逆转至24回合最低！先手：自身不会死亡！");
      } else {
        user.hp = 0;
        ctx.msg(user.name + " 将双方全体宠物PP逆转至24回合最低！自身死亡！");
      }
    }
  },
  // === 清羽新技能 ===
  { id: "sk_qy_1", ppRecoverySource: ["sk_qy_2", "清念PP回复"], noExtraPPCost: true, name: "清翎覆尘", element: "flying", power: 0, pp: 3, maxPp: 3, accuracy: 100, category: "status", priority: 15, immuneToPP: true,
    passiveLabel: "血脉联动",
    desc: "清念且清风之念至少 3 层时净化、回满精力并解除对手的回合效果。其他情况获得护盾并免疫当回合后手伤害。首用让双方技能变为各自主系，续用倒置对方治疗。",
    bloodlineDetail: "血脉联动：清羽同时携带清翎覆尘和残风临霜，且首格为清翎覆尘时，上场进入清念状态。\n" + QINGYU_ORIGINAL_BLOODLINE_DETAIL,
    detail: "① 本技能免疫删 PP 与额外 PP 消耗。轻风散魂和清念血脉的低 PP 回满可以回复本技能。\n② 清风之念不足 3 层或不在清念状态时，2 回合内每回合获得（200 + 0.4 × 已损精力）点护盾，并免疫发动当回合对方后手造成的伤害。\n③ 清念且至少 3 层时，净化自身并回满精力。每个其他技能回复其最大 PP 的 30%，向上取整。清除对方回合效果，含限时防控。自身 12 回合免疫异常与负面强化。\n④ 首次使用时，双方在场宠物的技能各自变为携带者的主系，持续（2 + 实际变系技能数 × 2）回合。清念额外倒置对方治疗 2 回合。残脉反弹对方后手施加给自身的效果。\n⑤ 后续使用按（0.3 + 已损精力比例）倒置对方治疗，持续（4 + 2 × 已损精力比例）回合，回合数四舍五入。\n⑥ 后续使用且处于清念时，若场上有非疾风天气或环境，倒置比例锁定为 0.7，持续 7 回合。疾风天气下锁定为（1.4 − 0.2 × 本技能累计使用次数），统计本次，持续 4 回合。\n⑦ 梦境中，本技能的基础先手值改为后手 −7。",
    onUse: function(u, t, ctx) {
      var bd = u.bloodlineData || {};
      var q = bd.qfzn || 0, inQ = bd.mode === "清念";
      ctx.msg(u.name + " 释放了清翎覆尘！");
      if (q < 3 || !inQ) {
        u.immuneBackhand = true;
        ctx.addTurnEffect(u, "清翎护盾", 2, function(p) {
          var cap = p.maxHp + (p.maxHpBonus || 0);
          var sh = Math.floor(200 + 0.4 * (cap - p.hp));
          ctx.addShield(p, sh);
          ctx.msg("【清翎】护盾+" + sh);
        }, null);
        ctx.msg("清风之念不足：2回合护盾并免疫后手伤害！");
      } else {
        ctx.cleanseAbnormalStatuses(u);
        STAGE_FIELDS.forEach(function(k){ if (u[k] < 0) u[k] = 0; });
        ctx.doHeal(u, (u.maxHp + (u.maxHpBonus || 0)) - u.hp);
        u.skills.forEach(function(s){ gainPP(u, s, Math.ceil(s.maxPp * 0.3), "sk_qy_1"); });
        ctx.clearTurnEffects(t);
        ctx.grantStatusImmunity(u, "清翎覆尘", 12, { stats: true });
        ctx.msg("清念：净化回满，其他技能+30%PP，清除对方回合效果，12回合免疫！");
      }
      if (!bd.qyFirstUse) {
        bd.qyFirstUse = true;
        const targets = [...new Set([u, skillEffectTarget(ctx, t, "element")].filter(Boolean))];
        const changed = targets.reduce((total, owner) =>
          total + owner.skills.filter(skill => getEffectiveSkillElement(owner, skill.element) !== owner.element).length, 0);
        const duration = 2 + changed * 2;
        targets.forEach(owner => setSkillElement(owner, "清翎同调", owner.element, duration));
        ctx.msg("首次使用：双方在场宠物的技能各视为自己的主系，持续" + duration + "回合！");
        if (inQ) ctx.invertHealing(t, 1.0, 2);
        else if (bd.mode === "残脉" && !gameState.banEffects?.reflect) u.reflectBackhand = true;
      } else {
        var cap2 = u.maxHp + (u.maxHpBonus || 0);
        var lostRatio = Math.min(1, 1 - u.hp / cap2);
        var turns = Math.round(4 + 2 * lostRatio);
        var ratio = 0.3 + lostRatio;
        if (inQ && gameState.weather === GALE_WEATHER) {
          var uses = ctx.sourceSkill?.useCount ?? ((u.skillUseCounts?.sk_qy_1 || 0) + 1);
          ratio = (7 - uses) / 5; // 1.4 - 0.2 × 使用次数，避免第二次的 1.0 出现浮点尾差。
          turns = 4;
        } else if (inQ && (gameState.weather || gameState.field)) {
          ratio = 0.7;
          turns = 7;
        }
        ctx.invertHealing(t, ratio, turns);
      }
    } },
  { id: "sk_qy_2", name: "轻风散魂", element: "flying", power: 0, pp: 8, maxPp: 8, accuracy: 100, category: "status", priority: 11, immuneToPP: true,
    desc: "按对方各招的最大 PP 比例删 PP，闪避当回合后手与下回合的常规非必中招式。清念按层数触发吸取、额外删 PP 或转残脉。残脉使用后封存本招 PP。",
    detail: "① 分别按对方各技能的最大 PP 删除（10 + 4 × 清风之念层数）%，上限 25%，向下取整。\n② 闪避对方当回合后手的常规非必中招式，以及下一回合的常规非必中招式。\n③ 先手时，等对方行动结算后回复本招 2 PP。后手时，对方各技能额外损失等同于清翎覆尘已损 PP 的点数，最少 1 点。\n④ 清念 1–2 层时，3 回合连动期间对方使用翼系技能额外消耗 1 PP，其他系额外消耗 2 PP。对在场非翼系对手，每回合吸取（50 + 0.2 × 双方速度差）点精力，向下取整。自身精力低于 60% 时，每段伤害限 150 点。\n⑤ 清念 3–4 层时，额外删除对方本回合先手所用技能的 PP。扣除量为清翎覆尘已损 PP、自身空 PP 技能数和本招已损 PP 之和，上限 7 点。\n⑥ 至少 5 层时清空清风之念，回复清翎覆尘 2 PP，转入残脉。\n⑦ 残脉下使用时，记录本次选招扣费后的剩余 PP 并清空本招，进入清念时恢复记录值。",
    onUse: function(u, t, ctx) {
      var bd = u.bloodlineData || {};
      var q = bd.qfzn || 0;
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai"));
      var self = u.skills.find(function(s){ return s.id === "sk_qy_2"; });
      var ql = u.skills.find(function(s){ return s.id === "sk_qy_1"; });
      var pct = Math.min(25, 10 + 4 * q);
      t.skills.forEach((s, slot) => ctx.deletePP(t, slot, Math.floor(s.maxPp * pct / 100)));
      u.lightWindDodgeTurn = gameState.turnCount;
      ctx.msg("删除对方全体" + pct + "%PP，并闪避后手与下回合非必中技能！");
      if (isFirst) {
        const recover = () => {
          if (gainPP(u, self, 2, "sk_qy_2")) ctx.msg("先手：对方行动结算后回复本技能PP！");
        };
        if (gameState.afterActions) gameState.afterActions.push(recover);
        else recover();
      }
      else { var n = Math.max(1, ql ? ql.maxPp - ql.pp : 1); ctx.deletePP(t, -1, n); ctx.msg("后手：删除对方全体" + n + "PP！"); }
      if (bd.mode === "残脉") {
        if (self) {
          bd.qingfengSavedPP = ctx.skillPPAfter ?? self.pp;
          setSkillPP(u, self, 0, "封存 PP", "轻风散魂·残脉", "记录 " + bd.qingfengSavedPP + " PP");
        }
        ctx.msg("残脉：封存轻风散魂PP，进入清念时恢复。");
        return;
      }
      if (q >= 5) {
        bd.qfzn = 0; enterQingyuMode(u, "残脉");
        gainPP(u, ql, 2, "sk_qy_2");
        ctx.msg("层数≥5：清空清风之念，回复清翎覆尘2PP，转入残脉！");
      } else if (q >= 3) {
        var ex = Math.min(7, (ql ? ql.maxPp - ql.pp : 0) + u.skills.filter(function(s){ return s.pp === 0; }).length + (self ? self.maxPp - self.pp : 0));
        const slot = getRoundSkillSlot(t, true);
        if (slot >= 0) ctx.deletePP(t, slot, ex);
      } else if (q >= 1) {
        u.lightWindThroughTurn = gameState.turnCount + 2;
        const drain = owner => {
          const opponent = gameState.playerActive === owner ? gameState.aiActive : gameState.playerActive;
          if (!opponent || opponent.isFainted() || opponent.element === "flying") return;
          const amount = 50 + Math.floor(0.2 * Math.abs(owner.getStat("spd") - opponent.getStat("spd")));
          ctx.doFixedDamage(opponent, amount, owner);
          ctx.doHeal(owner, amount);
        };
        drain(u);
        ctx.addTurnEffect(u, "轻风连动", 2, drain);
        ctx.msg("清念1-2层：3回合连动！");
      }
    } },
  { id: "sk_qy_3", name: "残念余梦", element: "ice", power: 0, pp: 6, maxPp: 6, accuracy: 100, category: "status", priority: 7,
    desc: "尝试清场并召唤梦境，返还最近一段承伤和对手尝试施加的负面效果。先手删 PP。后手沉睡对方并锁定自身换宠。清念使用后封存本招 PP。",
    detail: "① 清除场上天气和环境，召唤梦境 1 回合。场地锁定时按场地规则结算。\n② 取最近一段实际承伤作为返还固伤的数值，并返还对手最近一次记录的负面效果尝试，包括当时未能施加的效果。\n③ 追加（0.3 × 双方速度差 × 残风临霜已损 PP × 自身空 PP 技能数）点固伤，上限 600。残脉下按（1.8 + 当前精力比例）倍计算，上限 1000。处于残脉且对方有生效的限伤时，这段追加固伤分四段。\n④ 先手额外删除对方各技能 3 PP。\n⑤ 后手使对方沉睡并锁定自身换宠。沉睡持续 1–6 回合，威力招命中也不会唤醒。只有目标阵亡或解除沉睡才解锁，目标换下后仍追踪原目标。沉睡失败时，删对方上次所用技能 3 PP，再删各技能 1 PP。\n⑥ 清念下实际出手时，记录当时的本招剩余 PP 并清空。先进入残脉、再进入清念时恢复记录值一次。",
    onUse: function(u, t, ctx) {
      var bd = u.bloodlineData || {};
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai"));
      if (ctx.mayClearField() && !jianghuaBlocksSummon(ctx, "环境")) {
        gameState.weather = null; gameState.weatherTurns = 0;
        gameState.field = null; gameState.fieldTurns = 0;
        ctx.setField("dream", 1);
      }
      const returned = u.lastDamageSegment || 0;
      if (returned > 0) { ctx.doFixedDamage(t, returned, u); ctx.msg("返还最近一段所受伤害" + returned + "点！"); }
      replayNegativeEffects(u, t, ctx);
      var cf = u.skills.find(function(s){ return s.id === "sk_qy_4"; });
      var lostCf = cf ? cf.maxPp - cf.pp : 0;
      var empty = u.skills.filter(function(s){ return s.pp === 0; }).length;
      var spdDiff = Math.abs(u.getStat("spd") - t.getStat("spd"));
      var extra = Math.floor(0.3 * spdDiff * lostCf * empty);
      if (bd.mode === "残脉") extra = Math.floor(extra * (1.8 + u.hp / u.maxHp));
      extra = Math.min(bd.mode === "残脉" ? 1000 : 600, extra);
      if (extra > 0) {
        const segments = bd.mode === "残脉" && t.hasDamageCap() ? 4 : 1;
        for (let index = 0; index < segments; index++) {
          const amount = Math.floor((index + 1) * extra / segments) - Math.floor(index * extra / segments);
          if (amount > 0) ctx.doFixedDamage(t, amount, u);
        }
        ctx.msg("追加" + extra + "点固伤" + (segments === 4 ? "，分4段" : "") + "！");
      }
      if (isFirst) { ctx.deletePP(t, -1, 3); ctx.msg("先手：额外删除对方全体3PP！"); }
      else {
        if (ctx.applyStatus(t, "deep_sleep")) {
          const sleeping = skillEffectTarget(ctx, t, "status");
          u.deepSleepLock = { target: sleeping, token: sleeping.deepSleepToken };
          ctx.msg("后手：对方沉睡，自身换宠锁定！");
        } else {
          var last = t.skills.find(function(s){ return s.id === t.lastUsedSkillId; });
          if (last) ctx.deletePP(t, t.skills.indexOf(last), 3);
          ctx.deletePP(t, -1, 1);
          ctx.msg("沉睡失败：删除对方上次技能3PP与全体1PP！");
        }
      }
      if (bd.mode === "清念") {
        const self = u.skills.find(skill => skill.id === "sk_qy_3");
        if (self) {
          bd.qy3SavedPP = self.pp;
          setSkillPP(u, self, 0, "封存 PP", "残念余梦·清念", "记录 " + bd.qy3SavedPP + " PP");
        }
      }
    } },
  { id: "sk_qy_4", ppRecoverySource: "sk_qy_1", name: "残风临霜", element: "ice", power: 0, pp: 4, maxPp: 4, accuracy: 100, category: "status", priority: 12, immuneToPP: true,
    passiveLabel: "血脉联动",
    desc: "冰冻成功后尝试驱逐，新入场宠物若未能被施加睡眠，追加三段固伤。冰冻失败则删高频技能 PP，并按空 PP 技能数判定驱逐。随后减速并获得护盾。",
    bloodlineDetail: "血脉联动：清羽同时携带清翎覆尘和残风临霜，且首格为残风临霜时，上场进入残脉状态。\n" + QINGYU_ORIGINAL_BLOODLINE_DETAIL,
    detail: "① 本技能免疫常规删 PP，仅清翎覆尘能回复本招 PP。\n② 冰冻成功后尝试驱逐。成功换人时，对新入场的宠物施加睡眠。睡眠失败时才追加 999 点固伤，分三段结算。\n③ 冰冻失败时，对方累计使用超过 6 次的每个技能各损失（1 + 残风临霜剩余 PP + 0.25 × 双方速度差）点 PP，向下取整。对方至少 2 个技能无 PP 时尝试驱逐。\n④ 自身速度降低 30%，获得（20 + 0.8 × 双方速度差）×（1 + 2.5 × 已损精力比例）点护盾。\n⑤ 未携带清翎覆尘时，使用后进入残脉。",
    onUse: function(u, t, ctx) {
      var spdDiff = Math.abs(u.getStat("spd") - t.getStat("spd"));
      if (ctx.applyStatus(t, "freeze")) {
        var next = ctx.forceSwitchPet(t);
        if (next && !ctx.applyStatus(next, "sleep")) {
          for (var i = 0; i < 3; i++) ctx.doFixedDamage(next, 333, u);
          ctx.msg("睡眠失败：999固伤分3段！");
        }
      } else {
        var frost = u.skills.find(function(s) { return s.id === "sk_qy_4"; });
        var cut = Math.floor(1 + (frost ? frost.pp : 0) + 0.25 * spdDiff);
        t.skills.forEach(function(s, index) {
          if ((s.useCount || 0) > 6) ctx.deletePP(t, index, cut);
        });
        if (t.skills.filter(function(s){ return s.pp === 0; }).length >= 2) ctx.forceSwitchPet(t);
        ctx.msg("冰冻失败：按使用次数删除对方PP！");
      }
      u.spdMod = (u.spdMod || 1) * 0.7;
      ctx.addTurnEffect(u, "残风减速", 99, null, function(p){ p.spdMod = (p.spdMod || 1) / 0.7; });
      var cap = u.maxHp + (u.maxHpBonus || 0);
      var sh = Math.floor((20 + 0.8 * spdDiff) * (1 + (1 - u.hp / cap) * 2.5));
      ctx.addShield(u, sh);
      if (!u.skills.some(function(s){ return s.id === "sk_qy_1"; })) { enterQingyuMode(u, "残脉"); ctx.msg("未携带清翎覆尘：进入残脉！"); }
    } },
  { id: "sk_qy_5", name: "清念沉脉", element: "flying", power: 0, pp: 6, maxPp: 6, accuracy: 100, category: "status", priority: 11,
    desc: "清双方强化并治疗对手，自身各招回 3 PP。耗尽本招 PP 进入清念，期满按双方各自的 PP 净变化回复本招，随后四回合永久削弱对手实际用过的技能。",
    detail: "① 强制清除双方七项强化。把清除的正负等级分别取绝对值后求和，每级为对方回复 60 点精力。\n② 该次计算的治疗量低于 240 点时，额外删除对方上次所用技能 5 PP。\n③ 回复自身各技能 3 PP，然后清空本招。等待沉脉结算时，本招跳过清念翼系回 PP 与消耗清风之念回满。\n④ 进入清念，时长等于 1 加上本招实际扣费的 PP 和本招随后清空的 PP。\n⑤ 按每只在场宠物分别计算技能 PP 总量的期初和期末净变化，再对双方各自取绝对值后相加，乘 0.5 并四舍五入，期满一次回复本招。场下期间的 PP 改变不计。清羽换下暂停，重复发动时以该回合期初值重新计时和统计，提前转离清念则立即结算。\n⑥ 结算回复后开启 4 回合削弱窗口，跟随当前在场对手。对方出威力招时，按该招原始威力永久削弱 30%，累计上限 50%。出变化招时，该招先手永久减 1，本回合已排定的先后不重排。已造成的削弱持续到战斗结束。",
    onUse: function(u, t, ctx) {
      var total = 0;
      const recipient = skillEffectTarget(ctx, t, "stat");
      [...new Set([u, recipient].filter(Boolean))].forEach(function(p) { STAGE_FIELDS.forEach(function(k){ total += Math.abs(p[k] || 0); p[k] = 0; }); });
      var healAmt = total * 60;
      ctx.doHeal(t, healAmt);
      ctx.msg("清除双方强化，对敌方治疗" + healAmt + "！");
      if (healAmt < 240) { var last = t.skills.find(function(s){ return s.id === t.lastUsedSkillId; }); if (last) ctx.deletePP(t, t.skills.indexOf(last), 5); ctx.msg("治疗<240：额外删对方上次技能5PP！"); }
      u.skills.forEach(function(s){ gainPP(u, s, 3, undefined, "清念沉脉·发动"); });
      var self = u.skills.find(function(s){ return s.id === "sk_qy_5"; });
      var cp = self ? self.pp : 0;
      if (self) setSkillPP(u, self, 0, "清空自身 PP", "清念沉脉·进入清念");
      // 玩家裁定：本次常规出招消耗 + 本技能清空消耗，不计其他技能 PP。
      cp += ctx.skillPPCost || 0;
      enterQingyuMode(u, "清念");
      startQingnianChannel(u, t, 1 + cp, ctx);
      ctx.msg("进入清念" + (1 + cp) + "回合！");
    } },

  // ============ 清灵（清念灵体） ============
  { id: "sk_ql_1", name: "微灵封体", element: "ghost", power: 0, pp: 1, maxPp: 1, accuracy: 100, category: "status", priority: 15, immuneToPP: true,
    passiveLabel: "PP保护",
    desc: "本技能免疫常规删PP。净化回满，回复自身全体技能PP（含万念俱灰）。清除在场双方的限伤、减伤、护盾与反弹，并封锁双方全队再次获得同类效果，固有能力除外。永久防控，发动起至下回合结束免疫威力伤害。留场时，后续6回合向当时在场双方赋予微灵印记。",
    detail: "本技能免疫常规 PP 删除。\n① 净化自身的异常状态与负面强化，回复全部精力。自身携带的每个技能回复（3 + 施放前当前精力 ÷ 最大精力）点 PP，向上取整。（这次回复也适用于万念俱灰）\n② 解除当前在场双方已有的限伤、减伤、护盾和反弹（含技能效果反弹与伤害反弹）。本局剩余时间内，双方队伍的所有宠物都无法再获得这四类效果。血脉与技能被动自带的固有效果仍生效。\n③ 本局永久免疫异常状态与负面强化。从发动起至下回合结束，免疫威力伤害。\n④ 后续 6 回合内，每回合按施放者当时的已损精力计算微灵印记。当前在场双方各获得（5 + 已损精力 ÷ 50）点，向上取整，每次最多 15 点。清灵离场时停止发放。",
    onUse: function(u, t, ctx) {
      ctx.msg(u.name + " 释放了微灵封体！");
      var cap = u.maxHp + (u.maxHpBonus || 0);
      var ratio = u.hp / cap;
      ctx.cleanseAbnormalStatuses(u);
      STAGE_FIELDS.forEach(function(k){ if (u[k] < 0) u[k] = 0; });
      ctx.doHeal(u, cap - u.hp);
      var ppHeal = Math.ceil(3 + ratio);
      u.skills.forEach(function(s){ gainPP(u, s, ppHeal, "sk_ql_1"); });
      ctx.msg("净化并回复全部精力，全体技能+" + ppHeal + "PP！");
      gameState.banEffects = { shield: true, dmgReduction: true, damageCap: true, reflect: true };
      [u, t].forEach(clearGrantedDefenses);
      ctx.msg("本局全局屏蔽：限伤/减伤/护盾/反弹效果！");
      ctx.grantStatusImmunity(u, "微灵封体", Infinity, { stats: true });
      u.powerDamageImmuneThroughTurn = gameState.turnCount + 1;
      ctx.msg("永久免疫异常与负面强化，威力伤害免疫持续至下回合结束！");
      ctx.addTurnEffect(u, "微灵封体印", 6, function(owner) {
        var lost = Math.max(0, owner.maxHp + (owner.maxHpBonus || 0) - owner.hp);
        var add = Math.min(15, Math.ceil(5 + lost / 50));
        for (const pet of [ctx.playerActive, ctx.aiActive]) {
          if (!pet || pet.isFainted()) continue;
          pet.bloodlineData = pet.bloodlineData || {};
          pet.bloodlineData.microLing = (pet.bloodlineData.microLing || 0) + add;
          ctx.msg("微灵封体：" + pet.name + " 获得" + add + "点微灵印记！");
        }
      });
    }
  },
  { id: "sk_ql_2", name: "万念俱灰", element: "ghost", power: 150, pp: 6, maxPp: 6, accuracy: 100, category: "physical", priority: 11, immuneToPP: true, ppRecoverySource: "sk_ql_1",
    desc: "免疫常规删 PP，仅微灵封体可回 PP。威力随本招已损 PP 和微灵印记增加，首格空 PP 时切换伤害边界。先手追加固伤并重置强化，后手治疗双方。",
    detail: "本技能免疫常规删 PP，仅微灵封体可回复本技能 PP。\n① 实际威力为本技能已损 PP ×（150 + 微灵印记数），向上取整。首格有 PP 时上限 500，首格无 PP 时上限 1000。\n② 首格有 PP 时，威力伤害上限为对方最大精力的 90%。首格无 PP 时，下限为自身最大精力的 30%。\n③ 回复 150 点精力，并获得 6 回合异常免疫。\n④ 先手追加本次威力伤害的 30% 作为固伤，并强制重置双方强化。首格无 PP 时，本次威力伤害必暴。\n⑤ 后手时，双方各回复实际威力 × 1.1 点精力，回复量无额外上限。首格无 PP 时，清空对方本回合先手所用技能的 PP。",
    onUse: function(u, t, ctx) {
      var firstZero = u.skills[0] && u.skills[0].pp <= 0;
      var isFirst = gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai");
      var power = getWannenPower(u);
      ctx.msg(u.name + " 使用了万念俱灰！实际威力" + power + (firstZero ? "（首格PP=0，上限1000）" : ""));
      var res = ctx.doDamage(u, t, power, "physical", "ghost", {
        guaranteedCrit: firstZero && isFirst,
        maxDamage: firstZero ? undefined : Math.floor(t.maxHp * 0.9),
        minDamage: firstZero ? Math.floor(u.maxHp * 0.3) : 0
      });
      var dealt = res.damage;
      if (firstZero) ctx.msg("首格PP=0：伤害不低于30%最大精力" + (isFirst ? "，先手必定暴击" : "") + "！");
      ctx.msg("造成 " + dealt + " 点伤害！" + getEffLabel(res.effectiveness) + (res.isCrit ? " 命中要害！" : ""));
      ctx.doHeal(u, 150);
      ctx.grantStatusImmunity(u, "万念俱灰", 6, { statuses: ABNORMAL_WITHOUT_BIND });
      ctx.msg("回复150精力，6回合内免疫异常状态！");
      if (isFirst) {
        ctx.doFixedDamage(t, Math.floor(dealt * 0.3), u);
        ctx.transformStages(u, () => 0);
        ctx.transformStages(t, () => 0);
        ctx.msg("先手：追加" + Math.floor(dealt * 0.3) + "固伤并强制重置双方强化！");
      } else {
        var healAmt = Math.floor(power * 1.1);
        ctx.doHeal(u, healAmt); ctx.doHeal(t, healAmt);
        ctx.msg("后手：双方回复" + healAmt + "精力！");
        if (firstZero) {
          const slot = getRoundSkillSlot(t, true);
          if (slot >= 0) ctx.deletePP(t, slot, t.skills[slot].pp);
        }
      }
    }
  },
  { id: "sk_ql_3", name: "封灵千噬", element: "ghost", power: 70, pp: 8, maxPp: 8, accuracy: 100, category: "special", priority: 12, semiSure: true, sureFirst: true,
    desc: "连续三回合发动。首回合免疫对方后手施加给自身的效果，先手必中必暴。次回合另加一段物理伤害，末回合回复精力和 PP，太虚灵威满 PP 时触发清空联动。",
    detail: "实际威力为 70 + 万念俱灰实时威力 × 0.2，上限 150。未携带万念俱灰时，其参与计算的威力取 150。\n【三回合】每回合发动一次威力攻击，获得 10 点微灵印记与 100 点护盾。首格无 PP 时回复 100 点精力。自身获得异常免疫，对方使用技能额外消耗 1 PP。\n【首回合】免疫对方后手施加给自身的效果，含伤害。删除对方本回合使用技能的 1 PP，施加换下即失效的封灵印记。若先手，首段必中必暴。\n【次回合】以对方上回合总输出 × 0.6 为威力，追加一次独立的物理攻击。\n【末回合】回复自身 30% 最大精力和全体技能各 1 PP。若太虚灵威满 8 PP，随机清空对方一个可删技能的 PP，并清空太虚灵威的剩余 PP。",
    onUse: function(u, t, ctx) {
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai"));
      var currentOpp = function(p){ return gameState.playerActive === p ? gameState.aiActive : gameState.playerActive; };
      var perTurn = function(owner) {
        owner.bloodlineData = owner.bloodlineData || {};
        owner.bloodlineData.microLing = (owner.bloodlineData.microLing || 0) + 10;
        ctx.addShield(owner, 100);
        var firstZero = owner.skills[0] && owner.skills[0].pp <= 0;
        if (firstZero) ctx.doHeal(owner, 100);
        ctx.msg("封灵千噬每回合：+10微灵、100护盾" + (firstZero ? "、首格PP=0回100" : "") + "！");
      };
      var strike = function(owner, guaranteedCrit = false) {
        var opp = currentOpp(owner);
        if (!opp || opp.isFainted()) return;
        const power = Math.min(150, Math.floor(70 + getWannenPower(owner) * 0.2));
        var r = ctx.doDamage(owner, opp, power, "special", "ghost", { guaranteedCrit });
        ctx.msg("封灵千噬发动！造成 " + r.damage + " 点伤害。" + (r.isCrit ? "命中要害！" : ""));
        perTurn(owner);
      };
      ctx.grantStatusImmunity(u, "封灵千噬", 3, { statuses: ABNORMAL_WITHOUT_BIND });
      ctx.setPPCostEffect(t, "封灵千噬", 3, { extra: 1 });
      strike(u, isFirst);
      u.immuneBackhandEffects = true;
      const slot = getRoundSkillSlot(t);
      if (slot >= 0) ctx.deletePP(t, slot, 1);
      ctx.markQinglingSeal(t);
      ctx.msg("首回合：免疫对方后手，给予封灵印记（换下失效）！");
      var stage = 0;
      ctx.addTurnEffect(u, "封灵千噬连击", 2, function(p) {
        stage++;
        if (stage === 1) {
          strike(p);
          var opp = currentOpp(p);
          if (opp) {
            var extra = Math.floor((opp.lastTurnOutput || 0) * 0.6);
            if (extra > 0 && !opp.isFainted()) {
              const hit = createBattleContext().doDamage(p, opp, extra, "physical", "ghost");
              ctx.msg("封灵千噬次回合：追加" + hit.damage + "点物理伤害。");
            }
          }
        } else {
          strike(p);
          ctx.doHeal(p, Math.floor((p.maxHp + (p.maxHpBonus || 0)) * 0.3));
          p.skills.forEach(function(s){ gainPP(p, s, 1, undefined, "封灵千噬·末回合"); });
          ctx.msg("封灵千噬末回合：回复30%精力与全体技能1PP！");
          var txw = p.skills.find(function(s){ return s.id === "sk_ql_4"; });
          if (txw && txw.pp === txw.maxPp) {
            var opp2 = currentOpp(p);
            var pool = opp2 ? opp2.skills.filter(function(s){ return s.pp > 0 && !s.immuneToPP && !s.ppLocked; }) : [];
            if (pool.length) {
              var victim = pool[Math.floor(Math.random() * pool.length)];
              ctx.deletePP(opp2, opp2.skills.indexOf(victim), victim.pp);
              ctx.msg("太虚灵威联动：清空对方「" + victim.name + "」的PP！");
            }
            setSkillPP(p, txw, 0, "联动清空 PP", "封灵千噬·末回合");
            ctx.msg("太虚灵威剩余PP已清空。");
          } else { ctx.msg("太虚灵威PP未满，联动未触发。"); }
        }
      }, null);
    }
  },
  { id: "sk_ql_4", name: "太虚灵威", element: "ghost", power: 0, pp: 8, maxPp: 8, accuracy: 100, category: "status", priority: 9, semiSure: true, ppLocked: true,
    passiveLabel: "PP保护",
    desc: "首次成功发动前免疫常规删 PP。未命中只删对方各招 2 PP。恐惧失败时另施加双损和换宠锁。微灵达到 200 时追加删 PP 并检查空 PP 技能数。",
    detail: "PP保护：首次成功发动前，本技能PP不会被常规删PP效果扣除。发动后解除锁定。\n① 未命中：仅删除对方全体技能2PP。\n② 恐惧对方；若恐惧失败：删除对方全体技能2PP，并在3回合内令对方使用技能额外消耗1PP、无法换宠。\n③ 当微灵印记≥200：额外删除对方上次使用技能6PP；此后若双方PP为空的技能数≥4，追加9999点固定伤害。",
    onUse: function(u, t, ctx) {
      var selfSk = u.skills.find(function(s){ return s.id === "sk_ql_4"; });
      if (selfSk && selfSk.ppLocked) { selfSk.ppLocked = false; ctx.msg("太虚灵威解除PP锁定。"); }
      ctx.msg(u.name + " 释放了太虚灵威！");
      if (!ctx.applyStatus(t, "fear")) {
        ctx.deletePP(t, -1, 2);
        ctx.setPPCostEffect(t, "太虚灵威", 3, { extra: 1 });
        ctx.lockSwitch(t, "太虚灵威", 3);
        ctx.msg("恐惧失败：删对方全体2PP，3回合内对方使用额外消耗1PP且无法换宠！");
      } else { ctx.msg("太虚灵威：对方陷入恐惧！"); }
      var bd = u.bloodlineData || {};
      var ml = bd.microLing || 0;
      if (ml >= 200) {
        var oppLast = t.skills.find(function(s){ return s.id === t.lastUsedSkillId; });
        if (oppLast) { ctx.deletePP(t, t.skills.indexOf(oppLast), 6); ctx.msg("微灵≥200：删除对方上次使用技能6PP！"); }
        var emptyCount = [u, t].reduce(function(s, pt){ return s + pt.skills.filter(function(sk){ return sk.pp === 0; }).length; }, 0);
        if (emptyCount >= 4) { ctx.doFixedDamage(t, 9999, u); ctx.msg("双方PP空技能数≥4：追加9999点固定伤害！"); }
      }
    },
    onMiss: function(u, t, ctx) { ctx.deletePP(t, -1, 2); ctx.msg("太虚灵威未命中：仅删除对方全体技能2PP！"); }
  },
  { id: "sk_ql_5", name: "万古遗恨", element: "ghost", power: 20, pp: 20, maxPp: 20, accuracy: 100, category: "physical", priority: 3, immuneToPP: true,
    desc: "召唤迷雾 12 回合。成功时按万念俱灰实时威力追加固伤，失败时重置双方强化。微灵超过 300 时，按施放回合的输出差治疗下一回合的在场对手。",
    detail: "① 尝试召唤迷雾 12 回合。召唤失败时，强制重置双方强化。\n② 召唤成功时，追加万念俱灰实时威力减 20 点的固伤，最低 0 点，上限 349 点。未携带万念俱灰时，其参与计算的威力取 150。\n③ 随后以 20 威力发动攻击。\n④ 微灵印记超过 300 时，记录施放回合双方各自的总输出。下一回合按两者差值的绝对值，治疗对方届时在场的宠物。施放者换下后仍结算。",
    onUse: function(u, t, ctx) {
      ctx.msg(u.name + " 释放了万古遗恨！");
      var bd = u.bloodlineData || {};
      var wjPower = getWannenPower(u);
      var ok = ctx.setWeather("mist", 12);
      if (!ok) {
        ctx.transformStages(u, () => 0);
        ctx.transformStages(t, () => 0);
        ctx.msg("环境在场，迷雾无法降临！强制重置双方强化！");
      } else {
        var fd = Math.min(349, Math.floor(wjPower - 20));
        if (fd > 0) ctx.doFixedDamage(t, fd, u);
        ctx.msg("迷雾天气降临12回合！追加" + Math.max(0, fd) + "点固伤！");
      }
      var r = ctx.doDamage(u, t, 20, "physical", "ghost");
      ctx.msg("造成 " + r.damage + " 点伤害！");
      var ml = bd.microLing || 0;
      const healTarget = ml > 300 ? skillEffectTarget(ctx, t, "heal") : null;
      if (healTarget) {
        gameState.wanguHeals.push({
          castTurn: gameState.turnCount,
          owner: u,
          opponent: t,
          targetSide: gameState.playerActive === healTarget ? "playerActive" : "aiActive"
        });
      }
    }
  }
];



const DEFAULT_PETS = [
  { id: "pet_qingling", name: "清灵", element: "ghost", emoji: "\u{1F47B}", level: 100,
    baseStats: { hp: 149, atk: 152, def: 128, spatk: 151, spdef: 129, spd: 132 },
    skillIds: ["sk_ql_1", "sk_ql_2", "sk_ql_3", "sk_ql_4", "sk_ql_5"],
    bloodline: {
      name: "清念灵体",
      onTurnStart: function(pet, ctx) {
        var bd = pet.bloodlineData = pet.bloodlineData || {};
        var dead = [gameState.playerParty, gameState.aiParty].reduce(function(s, party){ return s + party.filter(function(p){ return p.isFainted(); }).length; }, 0);
        var alive = [gameState.playerParty, gameState.aiParty].reduce(function(s, party){ return s + party.filter(function(p){ return !p.isFainted(); }).length; }, 0);
        var dr = Math.min(5 * dead, 60 - alive);
        pet.passiveDamageReduction = Math.max(0, dr);
        if (dr > 0) ctx.msg("【清念灵体】减伤" + dr + "%（阵亡" + dead + "，存活" + alive + "）！");
      },
      onSkillUse: function(pet, target, ctx, skill) {
        var bd = pet.bloodlineData = pet.bloodlineData || {};
        if (skill.category === "status") {
          ctx.doHeal(pet, 200);
          ctx.msg("【清念灵体】使用变化技：回复200精力！");
          if (skill.pp <= 4) {
            const source = "清念灵体·变化招（" + skill.name + "）";
            for (const move of pet.skills) {
              if (move.category === "physical" || move.category === "special") {
                gainPP(pet, move, 2, undefined, source);
              }
            }
            ctx.invertHealing(target, 1.0, 2);
            ctx.msg("【清念灵体】技能PP≤4：恢复威力技能2PP，倒置对方治疗2回合！");
          }
        } else {
          var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === pet ? "player" : "ai"));
          if (isFirst) {
            ctx.deletePP(target, -1, 1, "清念灵体·威力招先手");
            var stages = 0;
            [pet, target].forEach(function(p){ STAGE_FIELDS.forEach(function(k){ stages += Math.abs(p[k] || 0); }); });
            var fd = 30 + stages * 20 + Math.floor(pet.maxHp * 0.08);
            ctx.doFixedDamage(target, fd, pet);
            ctx.msg("【清念灵体】威力技先手：删对方全体1PP，追加固伤" + fd + "！");
          } else {
            const healTarget = skillEffectTarget(ctx, target, "heal");
            if (healTarget) healTarget.qinglingInvertNext = true;
            const slot = getRoundSkillSlot(target, true);
            if (slot >= 0) { ctx.deletePP(target, slot, 3, "清念灵体·威力招后手"); ctx.msg("【清念灵体】威力技后手：倒置对方下个获得治疗回合的最高一段，删除对方先手技能3PP！"); }
            else ctx.msg("【清念灵体】威力技后手：倒置对方下个获得治疗回合的最高一段！");
          }
        }
      }
    }
  },
  { id: "pet_jydm", name: "极影迪莫", element: "light", emoji: "⚔️", level: 100,
    baseStats: { hp: 144, atk: 151, def: 130, spatk: 145, spdef: 131, spd: 137 },
    skillIds: ["sk_jydm_1", "sk_jydm_2", "sk_jydm_3", "sk_jydm_4", "sk_jydm_5"],
    bloodline: {
      name: "明念", markName: "光明之印",
      onEnter: function(pet) {
        mingnianData(pet).jianghuaDeleteProtectedThrough = gameState.turnCount + 3 - (gameState.resolvingTurn ? 1 : 0);
        syncMingnianMaxHP(pet);
      },
      onActionEnd: function(pet, target, ctx, skill) {
        if (!pet.dimoPendingAttack) advanceMingnian(pet, target, ctx, skill);
      },
      onTurnStart: function(pet, ctx) {
        const bd = mingnianData(pet);
        syncMingnianMaxHP(pet);
        if (!bd.markTarget || bd.markThrough < gameState.turnCount) {
          endMingnian(pet);
          return;
        }
        bd.markTurns = bd.markThrough - gameState.turnCount + 1;
        for (const skill of pet.skills) gainPP(pet, skill, 1, undefined, "明念·标记期间");
        ctx.msg("【明念】全体技能回复1PP，标记剩余" + (bd.markThrough - gameState.turnCount + 1) + "回合！");
      }
    }
  },
  { id: "pet_qy", name: "清羽", element: "flying", emoji: "🕊️", level: 100,
    baseStats: { hp: 172, atk: 0, def: 162, spatk: 0, spdef: 159, spd: 77 },
    skillIds: ["sk_qy_1", "sk_qy_2", "sk_qy_3", "sk_qy_4", "sk_qy_5"],
    bloodline: {
      name: "清念/残脉",
      onTurnStart: function(pet, ctx) {
        if (!pet.bloodlineData) pet.bloodline.onEnter(pet, ctx);
        var bd = pet.bloodlineData;
        bd.turnCount = (bd.turnCount || 0) + 1;
        bd.switchTurn = !!bd.mode && bd.turnCount % 5 === 0;
        if (!bd.mode) return;
        var opp = ctx.playerActive === pet ? ctx.aiActive : ctx.playerActive;
        if (bd.switchTurn) {
          ctx.doHeal(pet, 99);
          ctx.msg("【血脉切换期】回复99HP！使用翼系→清念 / 冰系→残脉");
          return;
        }
        if (bd.healCount >= 2) { bd.qfzn += Math.floor(bd.healCount / 2); bd.healCount = bd.healCount % 2; }
        if (bd.mode === "清念") {
          var ql = pet.skills.find(function(s) { return s.id === "sk_qy_1"; });
          var qlLost = ql ? ql.maxPp - ql.pp : 0;
          var spdDiff = opp ? Math.abs(pet.getStat("spd") - opp.getStat("spd")) : 0;
          var healAmt = Math.ceil(60 + pet.maxHp * 0.1 + bd.qfzn * 40 + 0.1 * spdDiff + qlLost * 50);
          ctx.doHeal(pet, healAmt);
          if (opp && !opp.isFainted()) ctx.doHeal(opp, healAmt);
          bd.healCount++;
          bd.qingLingLost = qlLost;

        } else if (bd.mode === "残脉") {
          if (opp && !opp.isFainted()) {
            var emptySkills = pet.skills.filter(function(s) { return s.pp === 0; }).length;
            var oppHasMit = opp.getDamageReduction() > 0 || opp.hasDamageCap();
            if (oppHasMit) {
              // 对方有减伤/限伤：改为治疗对方（0.3×上回合受伤总值 + 30 + 50×本回合使用技能次数）
              bd.residualHealingTurn = gameState.turnCount;
            } else {
              // 0.3×上回合所受最高两段伤害总值 + 50×空PP数
              var segs = (pet.lastTakenSegments || []).slice().sort(function(a, b) { return b - a; }).slice(0, 2);
              var top2 = segs.reduce(function(a, b) { return a + b; }, 0);
              var fixDmg = Math.floor(0.3 * top2 + 50 * emptySkills);
              if (fixDmg > 0) {
                ctx.doFixedDamage(opp, fixDmg, pet);
                ctx.doFixedDamage(pet, fixDmg);
                ctx.msg("【残脉】对双方各造成" + fixDmg + "固伤！");
              }
            }
          }
          // 回血改由 onAfterDamageSegment 处理（R16）
        }
      },
      // 上场钩子：按首格技能决定初始形态，并重置形态计时
      onEnter: function(pet, ctx) {
        var bd = pet.bloodlineData = pet.bloodlineData || {};
        if (bd.qingnianChannel) return;
        const mode = getQingyuStartingMode(pet);
        if (mode) enterQingyuMode(pet, mode);
        else {
          bd.mode = null;
          bd.modeEntered = false;
          setQingyuOriginalBloodline(pet, true);
        }
        bd.turnCount = 0; bd.qfzn = 0; bd.healCount = 0; bd.switchTurn = false;
        if (ctx) ctx.msg("【清羽】上场进入" + (bd.mode || "原初血脉") + "状态！");
      },
      // R16：残脉②改为每次受伤后结算（原文：每次受到伤害后）
      onAfterDamageSegment: function(pet) {
        var bd = pet.bloodlineData;
        if (!bd || bd.mode !== "残脉") return;
        if (pet.hp > 200) pet.heal(Math.floor((pet.maxHp + (pet.maxHpBonus || 0)) * 0.3));
      },
      onSkillUse: function(pet, target, ctx, skill) {
        var bd = pet.bloodlineData;
        if (!bd || !bd.mode) return;
        var opp = target;
        const element = ctx.skillElement ?? getEffectiveSkillElement(pet, skill.element);
        // 切换期判定：翼系→清念，冰系→残脉
        if (bd.switchTurn) {
          if (element === "flying") {
            enterQingyuMode(pet, "清念");
            ctx.msg("切换期使用翼系技能，进入【清念】状态！");
          }
          else if (element === "ice") { enterQingyuMode(pet, "残脉"); ctx.msg("切换期使用冰系技能，进入【残脉】状态！"); }
          bd.switchTurn = false;
        }
        // 翼系技能触发血脉效果（仅清念态）
        if (element === "flying" && bd.mode === "清念") {
          // (1) 3回合免疫异常与负面强化
          ctx.grantStatusImmunity(pet, "清念翼系", 3, { stats: true });
          ctx.msg("【清念】3回合内免疫异常与负面强化！");
          // 若技能PP<8：净化自身+回复其他技能1PP
          if (skill.pp < 8) {
            ctx.cleanseAbnormalStatuses(pet);
            STAGE_FIELDS.forEach(function(s){ if (pet[s] < 0) pet[s] = 0; });
            const source = "清念·翼系招式";
            pet.skills.forEach(function(s){ if (s.id !== "sk_qy_1") gainPP(pet, s, 1, source, source + "（" + skill.name + "）"); });
            ctx.msg("【清念】净化自身，其他技能回复1PP！");
          }
          // (2) 3回合速度-25%
          pet.spdMod = (pet.spdMod || 1) * 0.75;
          ctx.addTurnEffect(pet, "清念翼速", 3, null, function(p){ p.spdMod = (p.spdMod || 1) / 0.75; });
          // 30%减伤4回合；清翎覆尘PP=0时可叠加（最多60%）
          var ql = pet.skills.find(function(s){ return s.id === "sk_qy_1"; });
          var canStack = ql && ql.pp === 0;
          var reduction = canStack ? Math.min(60, (pet.damageReduction || 0) + 30) : Math.max(30, pet.damageReduction || 0);
          if (ctx.setDamageReduction(pet, reduction, 4)) {
            ctx.msg("【清念】速度-25%（3回合），减伤" + reduction + "%（4回合）" + (canStack?"（可叠加）":"") + "！");
          } else ctx.msg("【清念】速度-25%（3回合）！");
          // (3) 4回合每回合回复10%最大精力
          ctx.addTurnEffect(pet, "清念翼愈", 4, function(p){ ctx.doHeal(p, Math.floor(p.maxHp * 0.1)); ctx.msg("【清念】回复10%最大精力！"); }, null);
          // 对敌方治疗：0.2×双方已损精力之和
          var lostSum = (pet.maxHp - pet.hp) + (opp ? (opp.maxHp - opp.hp) : 0);
          var oppHeal = Math.ceil(0.2 * lostSum);
          if (opp && !opp.isFainted() && oppHeal > 0) { ctx.doHeal(opp, oppHeal); ctx.msg("【清念】对敌方治疗" + oppHeal + "HP！"); }
        }
        // 冰系技能触发血脉效果（仅残脉态）
        if (element === "ice" && bd.mode === "残脉") {
          // (1) 2回合免疫异常（可叠加回合数）
          var immuneTurns = ctx.grantStatusImmunity(pet, "残脉冰系", 2, { stack: true });
          ctx.msg("【冰系】2回合免疫异常（可叠加，现剩" + immuneTurns + "回合）！");
          // 若技能PP≤4：净化+回复300精力（间隔<2回合则-30%）
          if (skill.pp <= 4) {
            ctx.cleanseAbnormalStatuses(pet);
            var iceHeal = 300;
            if (pet.lastIceSkillTurn !== undefined && gameState.turnCount - pet.lastIceSkillTurn < 2) iceHeal = Math.floor(iceHeal * 0.7);
            pet.lastIceSkillTurn = gameState.turnCount;
            ctx.doHeal(pet, iceHeal);
            ctx.msg("【冰系】净化自身，回复" + iceHeal + "精力" + (iceHeal < 300 ? "（间隔惩罚-30%）" : "") + "！");
          }
          // (2) 删除对方全体1PP；技能PP=1时额外删(3+双方强化数×2)PP并清除双方强化
          ctx.deletePP(opp, -1, 1, "残脉·冰系招式");
          if (skill.pp === 1) {
            var iceStages = 0;
            [pet, opp].forEach(function(p){ if (!p) return; STAGE_FIELDS.forEach(function(k){ iceStages += Math.abs(p[k]||0); }); });
            var extraPP = 3 + iceStages * 2;
            ctx.deletePP(opp, -1, extraPP, "残脉·冰系招式额外删除");
            [pet, opp].forEach(function(p){ if (!p) return; STAGE_FIELDS.forEach(function(k){ p[k] = 0; }); });
            ctx.msg("【冰系】技能PP=1：额外删除对方" + extraPP + "PP并清除双方强化！");
          } else {
            ctx.msg("【冰系】删除对方全体技能1PP！");
          }
        }
        if (bd.mode === "清念" && skill.pp < skill.maxPp * 0.3) {
          const lost = skill.maxPp - skill.pp;
          const useAll = skill.pp <= skill.maxPp * 0.2 || skill.maxPp < 4;
          const marks = bd.qfzn || 0;
          const cost = useAll ? marks : Math.max(1, lost - 3);
          if (cost > 0 && marks >= cost) {
            const restored = gainPP(pet, skill, lost, "清念PP回复", "清念·低PP回满（" + skill.name + "）");
            if (restored > 0) {
              bd.qfzn = marks - cost;
              ctx.msg("【清念PP回复】" + skill.name + "回复" + restored + " PP，消耗" + cost + "层清风之念！");
            }
          }
        }
      },
      onActionEnd: function(pet) {
        const data = pet.bloodlineData;
        if (data?.residualHealingTurn !== gameState.turnCount) return;
        delete data.residualHealingTurn;
        const opponent = gameState.playerActive === pet ? gameState.aiActive : gameState.playerActive;
        if (!opponent || opponent.isFainted() || pet.isFainted()) return;
        const ice = pet.skills.find(skill => skill.id === "sk_qy_4");
        const amount = Math.ceil(0.3 * (pet.lastTakenTotal || 0) + 30 + 50 * (pet.skillsUsedThisTurn || 0));
        createBattleContext().doHeal(opponent, amount, { invertPct: pet.hp < 500 && ice && ice.pp !== 4 ? 1 : 0 });
      }
    }
  },
  { id: "pet_bmhs", name: "创世神钟", element: "normal", emoji: "🔔", level: 100,
    baseStats: { hp: 132, atk: 164, def: 172, spatk: 109, spdef: 168, spd: 139 },
    skillIds: ["sk_cszn", "sk_nlex", "sk_mszw", "sk_fthy", "sk_cyjy"],
    bloodline: {
      name: "不灭魂体",
      onBeforeDamage: function(pet, damage, type, attacker, ctx, element) {
        if (type === "fixed") {
          const inverted = Math.floor(damage * 0.3);
          createBattleContext().doHeal(pet, inverted);
          ctx.msg("【不灭魂体】将固伤的30%反转为治疗。");
          return damage - inverted;
        }
        if (type === "power" && attacker && attacker !== pet) {
          attacker.blockPPRecoveryOnTurn = gameState.turnCount + 1;
          ctx.msg("【不灭魂体】封锁攻击者下回合回复PP。");
          if (getEffectiveness(element, pet.element) >= 2) {
            ctx.msg("【不灭魂体】克制伤害降低40%！");
            return Math.floor(damage * 0.6);
          }
        }
        return damage;
      },
      onAfterDamageSegment: function(pet, segmentIndex, ctx) {
        if (pet.hp === 0 && pet.lethalHitThisTurn && (isEjectImmune(pet) || !getForcedSwitchCandidates(pet).length)) return;
        // 第n段伤害后恢复(30-4n)%已损精力
        var n = segmentIndex + 1;
        var pct = Math.max(0, 30 - 4 * n);
        if (pct > 0 && pet.hp < pet.maxHp) {
          var lost = pet.maxHp - pet.hp;
          var healAmt = Math.floor(lost * pct / 100);
          if (healAmt > 0) {
            ctx.doHeal(pet, healAmt);
            ctx.msg("【不灭魂体】第" + n + "段伤害后恢复" + healAmt + "HP(" + pct + "%已损)");
          }
        }
      },
      onTurnStart: function(pet, ctx) {
        pet.bloodlineData = pet.bloodlineData || {};
        pet.bloodlineData.segmentIdx = 0;
      }
    }
  }
];
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



// ============================================================
//  V3 ENGINE - 完整机制引擎
// ============================================================

const STAGE_LABELS = Object.freeze({ atk: "物攻", def: "物防", spatk: "魔攻", spdef: "魔防", spd: "速度", accuracy: "命中", evasion: "闪避" });
const STAGE_FIELDS = Object.keys(STAGE_LABELS).map(function(stat) { return stat + "Stage"; });

class BattlePet {
  constructor(petData) {
    this.id = petData.id; this.name = petData.name; this.element = petData.element;
    this.emoji = petData.emoji; this.level = petData.level;
    var s = calcAllStats(petData.baseStats, petData.level);
    this.maxHp = s.hp; this.hp = s.hp;
    this.atk = s.atk; this.def = s.def;
    this.spatk = s.spatk; this.spdef = s.spdef; this.spd = s.spd;
    for (const key of STAGE_FIELDS) {
      if (petData.bloodline?.name !== "不灭魂体") { this[key] = 0; continue; }
      let value = 0;
      Object.defineProperty(this, key, {
        enumerable: true,
        get: () => value,
        set: next => {
          const before = value;
          value = next;
          const fell = before !== 0 && (Math.sign(before) !== Math.sign(next) || Math.abs(next) < Math.abs(before));
          if (!fell || !(this.futiThrough >= gameState.turnCount)) return;
          const opponent = this === gameState.playerActive ? gameState.aiActive : this === gameState.aiActive ? gameState.playerActive : null;
          if (opponent && !opponent.isFainted()) {
            const lost = Math.abs(before - next);
            createBattleContext().doFixedDamage(opponent, lost * 80, this);
            addMessage("【覆体魂衣】强化消失" + lost + "级！");
          }
        }
      });
    }
    this.status = null; this.statusTurns = 0;
    this.poisoned = false;
    this.leechSeed = false; this.confuseTurns = 0; this.bindTurns = 0;
    // V2 fields
    this.shield = 0; this.marks = {}; this.turnEffects = [];
    this.qlSealMark = false;
    this.bloodline = petData.bloodline || null; this.bloodlineData = null;
    this.healMod = 1.0; this.dmgMod = 1.0; this.spdMod = 1.0;
    // V3 NEW fields
    this.segmentIdx = 0;               // 当前回合受击段数
    this.lethalHitThisTurn = false;    // 本回合有致死一击
    this.preDeathHP = 0;               // 致死前HP
    this.preventCritNext = false;      // 禁止对方下次暴击
    this.blockPPRecovery = false;      // 封锁PP回复(下回合)
    this.elementOriginal = null;       // 原始属系
    this.elementLost = false;          // 是否已丢失属系
    this.skillUseCounts = {};          // 技能使用次数追踪
    this.ppHistory = [];               // PP历史 [{turn, skills:[{id,pp}]}]
    this.damageCap = Infinity;         // 单段伤害上限
    this.damageCapThreshold = 0;       // 限伤触发阈值
    this.damageCapTurns = 0;           // 限伤剩余回合
    this.passiveDamageReduction = 0;   // 常驻伤害减免%
    this.damageReduction = 0;          // 伤害减免%
    this.damageReductionTurns = 0;     // 减免剩余回合
    this.powerDamageImmuneThroughTurn = -1; // 威力伤害免疫最后生效的战斗回合
    this.superEffReduction = 0;        // 克制伤害减免%
    this.fixedDmgHealPct = 0;         // 固伤反转治疗%
    this.statusImmunitySources = new Map();
    this.outputReduction = 0;          // 输出降低%
    this.healInvertPct = 0;            // 倒置治疗比例（0-1）
    this.healInvertTurns = 0;         // 倒置治疗剩余回合
    this.statLockedThrough = -1;      // 强化锁定至指定回合
    this.critRateBonus = 0;            // 暴击率加成（0-1）
    // === 极影迪莫明念引擎字段 ===
    this.lastDealtDamage = 0;         // 上回合造成伤害总值
    this.outputThisTurn = 0;          // 本回合累计对敌输出（含固伤）
    this.damageTakenThisTurn = [];    // 本回合承伤分段（残脉公式用）
    this.lastTakenSegments = [];      // 上回合承伤分段
    this.lastTakenTotal = 0;          // 上回合承伤总值
    this.skillsUsedThisTurn = 0;      // 本回合使用技能次数
    this.lastTurnOutput = 0;          // 上回合的总输出（回合末结算）
    this.currentDealt = 0;            // 本回合累计造成伤害
    this.lastPPDeletedSkill = null;   // 上次被删除PP的技能
    this.skillPPCostMult = 1;         // PP消耗倍率
    this.priorityOverride = null;     // 先手值覆盖
    this.dodgeLethalLeft = 0;         // 致命伤害闪避次数
    this.oppConsecutive = {};         // 对方连续使用技能计数
    this.lastUsedSkillId = null;      // 上回合使用的技能
    this.lastPowerSkillId = null;     // 上次使用的威力技能（明念回复目标）
    this.maxHpBonus = 0;              // 精力上限增幅
    this.mingNianDmg = 0;             // 明念追加固伤
    this.invincible = false;          // 免疫一切伤害与效果
    this.healReducePct = 0;           // 受到的治疗降低%（瞬华冰冻）
    // 出战最多 4 个技能（技能池可以更多）
    this.skills = petData.skillIds.slice(0, 4).map(function(sid) {
      var s = findSkill(sid); return s ? { ...s, pp: s.maxPp, priority: s.priority || 8 } : null;
    }).filter(Boolean);
    if (this.bloodline && this.bloodline.name === "清念/残脉" && getQingyuStartingMode(this) === null) {
      setQingyuOriginalBloodline(this, true);
    }
    if (this.bloodline && this.bloodline.name === "不灭魂体") {
      var creationSkill = this.skills.find(skill => skill.id === "sk_cszn");
      if (creationSkill) {
        grantStatusImmunity(this, "创世之能", Infinity, { statuses: ["freeze", "sleep", "fear", "bind"] });
        grantStatusImmunity(this, "创世之能（0 PP）", Infinity, { active: () => creationSkill.pp === 0 });
      }
    }
  }
  getStat(stat) {
    var stages = { atk: this.atkStage, def: this.defStage, spatk: this.spatkStage, spdef: this.spdefStage, spd: this.spdStage };
    var stage = stages[stat] || 0;
    var mult = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
    var val = this[stat] * mult;
    if (stat === "spd") { if (this.status === "paralyze") val *= 0.5; val *= (this.spdMod || 1) * (isMingnianMarked(this) ? 1.05 : 1) * (gameState.field === "shunhua" && this.element === "light" ? 1.15 : 1) * (1 + (this.creationSpeedSources?.size || 0) * 0.1); }
    return Math.floor(val);
  }
  isFainted() { return this.hp <= 0; }
  canAct() {
    // 控制状态即时复查；只缓存麻痹随机数，不能缓存尚未受控时的 true。
    if (this.isFainted() || this.status === "freeze" || this.status === "sleep" || this.status === "deep_sleep" || this.status === "fear") return false;
    if (this.status !== "paralyze") return true;
    var turn = gameState.turnCount || 0;
    if (this.__canActTurn === turn && this.__canActValue !== undefined) return this.__canActValue;
    var v = Math.random() >= 0.25;
    this.__canActTurn = turn; this.__canActValue = v;
    return v;
  }
  getDamageReduction() {
    const timedReduction = !gameState.banEffects?.dmgReduction && this.damageReductionTurns > 0 ? this.damageReduction : 0;
    return Math.max(this.passiveDamageReduction, timedReduction);
  }
  hasDamageCap() {
    return !gameState.banEffects?.damageCap && (
      (this.damageCapTurns > 0 && this.damageCap < Infinity) ||
      (this.lightWindThroughTurn >= gameState.turnCount && this.hp < (this.maxHp + (this.maxHpBonus || 0)) * 0.6) ||
      this.bloodlineData?.jianghuaThrough >= gameState.turnCount
    );
  }
  takeDamage(dmg, source, sourceSkill) {
    if (this.invincible || (this.externalEffectImmuneTurn === gameState.turnCount && source !== this)) return 0;
    // 致命伤害闪避（极影光幕）
    if (this.dimoLethalDodgeThrough >= gameState.turnCount && this.dodgeLethalLeft > 0 && dmg >= this.hp && this.hp > 0) {
      this.dodgeLethalLeft--;
      for (const skill of this.skills) gainPP(this, skill, 1, "sk_jydm_3");
      addMessage(this.name + " 闪避了致命伤害！");
      return 0;
    }
    // 限伤检查
    if (!gameState.banEffects?.damageCap) {
      if (this.damageCapTurns > 0 && dmg > this.damageCapThreshold) dmg = Math.min(dmg, this.damageCap);
      if (this.lightWindThroughTurn >= gameState.turnCount && this.hp < (this.maxHp + (this.maxHpBonus || 0)) * 0.6) {
        dmg = Math.min(dmg, 150);
      }
    }
    // 伤害减免
    const reduction = this.getDamageReduction();
    if (reduction > 0) dmg = Math.floor(dmg * (100 - reduction) / 100);
    // 护盾吸收（带日志+飘字）
    if (!gameState.banEffects?.shield && this.shield > 0) {
      if (this.shield >= dmg) { this.shield -= dmg; if (!this.shield && dmg > 0) dimoShieldBroke(this, source); addMessage(this.name + " 的护盾吸收了" + dmg + "点伤害！"); spawnFloatText(this, dmg, "shield"); return 0; }
      addMessage(this.name + " 的护盾吸收了" + this.shield + "点伤害，剩余" + (dmg - this.shield) + "点穿透！");
      spawnFloatText(this, this.shield, "shield");
      dmg -= this.shield; this.shield = 0; dimoShieldBroke(this, source);
    }
    dmg = restrictJianghuaDamage(this, dmg);
    if (dmg <= 0) return 0;
    // 致死检测
    if (dmg > this.hp) {
      this.lethalHitThisTurn = true;
      this.preDeathHP = this.hp;
    }
    const received = Math.min(this.hp, dmg);
    this.hp = Math.max(0, this.hp - dmg);
    if (received > 0) {
      this.lastDamageSegment = received;
      sealDivineSkill(this, source, sourceSkill);
    }
    if (dmg > 0) { this.damageTakenThisTurn.push(dmg); spawnFloatText(this, dmg, "dmg"); }
    const segmentIndex = this.segmentIdx++;
    if (received > 0) this.bloodline?.onAfterDamageSegment?.(this, segmentIndex, createBattleContext());
    return dmg;
  }
  heal(amount, options = {}) {
    const before = this.hp;
    const modifier = (this.healMod ?? 1) + (isMingnianMarked(this) ? 0.15 : 0) + (this.jianghuaGlobalThrough >= gameState.turnCount ? 1 : 0);
    const reduced = this.dimoFrostRecoveryThrough >= gameState.turnCount ? 0.5 : 1 - (this.healReducePct || 0) / 100;
    const effective = Math.ceil(Math.floor(amount * modifier + 1e-9) * reduced);
    if (effective <= 0) return 0;
    const forcedInversion = options.invertPct || (this.qinglingInvertThrough >= gameState.turnCount ? 1 : 0);
    const inversion = forcedInversion || (this.healInvertTurns > 0 ? Math.max(0, this.healInvertPct) : 0);
    if (this.qinglingInvertNext && gameState.qinglingHealBatches) {
      const batch = gameState.qinglingHealBatches.get(this) || [];
      batch.push({ effective, inversion });
      gameState.qinglingHealBatches.set(this, batch);
      return 0;
    }
    return this.applyHealSegment(effective, inversion, before);
  }
  applyHealSegment(amount, inversion, before = this.hp) {
    const inverted = Math.floor(amount * inversion);
    const cap = this.maxHp + (this.maxHpBonus || 0);
    this.hp = Math.max(0, Math.min(cap, Math.max(0, this.hp - inverted) + amount - inverted));
    const change = this.hp - before;
    if (inverted > 0) addMessage(this.name + "的治疗被倒置，精力减少" + inverted + "点！");
    if (change > 0) spawnFloatText(this, change, "heal");
    return change;
  }
}

// ---------- GLOBAL STATE ----------
var gameState = {
  screen: "menu", battleMode: "solo", playerParty: [], aiParty: [],
  playerActive: null, aiActive: null,
  messages: [], isPlayerTurn: true,
  battleOver: false, waitingForSwitch: false, pendingPlayerSkill: null, pendingAISkill: null, pendingPlayerAction: null, resolvingTurn: false, turnTimer: null, autoSkipTimer: null, turnTimeLeft: 0,
  selectedTeamIds: [], opponentTeamIds: [],
  turnCount: 0, weather: null, weatherTurns: 0, field: null, fieldTurns: 0, banEffects: null, logFilter: "all", logCollapsed: {},
  wanguHeals: [],      // 万古遗恨施放回合的输出及下一回合的治疗
  qingnianWindows: {},
  snapshots: [],       // 状态快照历史
  ppHistory: []        // 全局PP历史 [{turn, pets: [{id,pp}]}]
};

// ---------- BATTLE CONTEXT (V3 extended) ----------
function recordAttemptedNegativeEffect(ctx, pet, replay) {
  const action = ctx.skillAction;
  if (!action || ctx.replayingNegativeEffects || pet === action.user) return;
  let record = pet.lastNegativeSkillEffects;
  if (!record || record.action !== action) {
    record = { action, replays: [], applied: new Map() };
    pet.lastNegativeSkillEffects = record;
  }
  record.replays.push(replay);
  return record;
}

function replayNegativeEffects(owner, opponent, ctx) {
  ctx.replayingNegativeEffects = true;
  try {
    const record = owner.lastNegativeSkillEffects;
    if (record) {
      for (const replay of record.replays) replay(ctx, opponent);
      for (const [effect, version] of record.applied) {
        if (owner.abnormalVersions?.get(effect) !== version) continue;
        clearAbnormalStatus(owner, effect);
      }
      delete owner.lastNegativeSkillEffects;
      return;
    }
    // 独立异常和来自场地的负面状态也能退回。
    if (owner.status) ctx.applyStatus(opponent, owner.status, { turns: owner.statusTurns });
    if (owner.confuseTurns > 0) ctx.applyStatus(opponent, "confuse", { turns: owner.confuseTurns });
    if (owner.bindTurns > 0) ctx.applyStatus(opponent, "bind", { turns: owner.bindTurns });
    if (owner.leechSeed) ctx.applyStatus(opponent, "leech_seed");
    if (owner.poisoned) ctx.applyStatus(opponent, "poison");
    cleanseAbnormalStatuses(owner);
  } finally {
    ctx.replayingNegativeEffects = false;
  }
}

function skillEffectTarget(ctx, target, kind) {
  const action = ctx?.skillAction;
  if (!action || target === action.user) return target;
  if (target.externalEffectImmuneTurn === gameState.turnCount) {
    addMessage(target.name + " 免疫了外来技能效果！");
    return null;
  }
  if (!action.backhand || target !== action.target) return target;
  if (target.reflectBackhand && !gameState.banEffects?.reflect) {
    if (!action.reflected) addMessage(target.name + " 反弹了后手技能效果！");
    action.reflected = true;
    return action.user;
  }
  if (target.immuneBackhandEffects || (target.immuneBackhand && kind === "damage")) {
    addMessage(target.name + " 免疫了后手技能效果！");
    return null;
  }
  return target;
}

function createBattleContext() {
  return {
    doDamage: function(att, def, power, cat, el, opts) {
      def = skillEffectTarget(this, def, "damage");
      if (!def) {
        this._lastEff = 1; this._lastDmg = 0;
        return { damage: 0, effectiveness: 1, isCrit: false };
      }
      opts = opts || {};
      power = getSkillPower(this.sourceSkillOwner === att ? this.sourceSkill : null, power);
      el = getEffectiveSkillElement(att, el);
      if (!(power > 0)) return { damage: 0, effectiveness: 1, isCrit: false };
      wakeFromPowerHit(def);
      if (power > 0 && hasPowerDamageImmunity(def)) { this._lastEff = 1; this._lastDmg = 0; att.lastOutputDmg = 0; return { damage: 0, effectiveness: 1, isCrit: false }; }
      var isPhysical = cat === "physical";
      var atkStat = isPhysical ? (opts.atkStageOverride ? att.atk * ((2+opts.atkStageOverride)/2) : att.getStat("atk")) : att.getStat("spatk");
      var defStat = isPhysical ? def.getStat("def") : def.getStat("spdef");
      var dmg = Math.floor(((2 * att.level / 5 + 2) * power * (atkStat / defStat)) / 50 + 2); dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
      if (el && el === att.element) dmg = Math.floor(dmg * 1.5);
      var eff = getEffectiveness(el, def.element);
      dmg = Math.floor(dmg * eff);
      dmg = Math.floor(dmg * getWeatherDamageMod(el, def.element));
      var isCrit = false;
      var critBlocked = !!att.preventCritNext || def.bloodline?.name === "不灭魂体";
      if (cat !== "status" && !critBlocked && (opts.guaranteedCrit || Math.random() < (0.0625 + (att.critRateBonus || 0)))) {
        dmg = Math.floor(dmg * 1.5); isCrit = true;
      }
      if (att.preventCritNext) att.preventCritNext = false;
      if (att.status === "burn" && isPhysical) dmg = Math.floor(dmg * 0.5);
      dmg = Math.floor(dmg * getOutputMultiplier(att));
      // Bloodline: onBeforeDamage
      if (def.bloodline && def.bloodline.onBeforeDamage) {
        dmg = def.bloodline.onBeforeDamage(def, dmg, "power", att, this, el);
      }
      // 技能级伤害上下限（万念俱灰等）：在全部修正之后、保底 1 之前生效
      if (opts.maxDamage !== undefined) dmg = Math.min(dmg, opts.maxDamage);
      if (opts.minDamage) dmg = Math.max(dmg, opts.minDamage);
      dmg = Math.max(1, dmg);
      this._lastEff = eff; this._lastDmg = dmg;
      // 明念：每次造成伤害追加（40+15×双方强化数）固伤
      att.currentDealt += dmg;
      att.outputThisTurn = (att.outputThisTurn || 0) + dmg;
      att.lastOutputDmg = dmg;
      const received = def.takeDamage(dmg, att, this.sourceSkillOwner === att ? this.sourceSkill : null);
      if (received > 0 && isMingnianMarked(att) && att.bloodlineData.markTarget === def && !def.isFainted()) applyMingnianDamage(this, att, def);
      return { damage: dmg, effectiveness: eff, isCrit: isCrit };
    },
    doFixedDamage: function(target, amount, source, options = {}) {
      target = skillEffectTarget(this, target, "damage");
      if (!target) return 0;
      source ||= this.sourceSkillOwner;
      amount = Math.floor(amount * (!options.scaled && source && source !== target ? getOutputMultiplier(source) : 1));
      if (amount <= 0) return 0;
      if (source && source !== target) source.outputThisTurn = (source.outputThisTurn || 0) + amount;
      // Bloodline: onBeforeDamage for fixed
      if (target.bloodline && target.bloodline.onBeforeDamage) {
        amount = target.bloodline.onBeforeDamage(target, amount, "fixed", null, this);
      }
      const sourceSkill = !options.skipMingnian && this.sourceSkillOwner === source ? this.sourceSkill : null;
      const received = target.takeDamage(amount, source, sourceSkill);
      if (received > 0 && source && !options.skipMingnian && isMingnianMarked(source) && source.bloodlineData.markTarget === target && !target.isFainted()) applyMingnianDamage(this, source, target);
      return amount;
    },
    doHeal: function(target, amount, options) {
      target = skillEffectTarget(this, target, "heal");
      if (!target) return;
      var healed = target.heal(Math.floor(amount), options);
      if (healed > 0) addMessage(target.name + " 回复了" + healed + "HP");
    },
    addShield: function(target, amount) { if (gameState.banEffects && gameState.banEffects.shield) { addMessage("护盾已被微灵封体永久限制！"); return; } var amt = Math.floor(amount); target.shield += amt; if (amt > 0) spawnFloatText(target, amt, "shield"); },
    grantStatusImmunity: grantStatusImmunity,
    revokeStatusImmunity: revokeStatusImmunity,
    applyStatus: function(pet, effect, options) {
      const record = recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.applyStatus(target, effect, options));
      const target = skillEffectTarget(this, pet, "status");
      if (!target) return false;
      const before = target.abnormalVersions?.get(effect);
      const applied = applyEffect(target, effect, options);
      const version = target.abnormalVersions?.get(effect);
      if (record && target === pet && version !== before) record.applied.set(effect, version);
      return applied;
    },
    cleanseAbnormalStatuses: function(target) {
      target = skillEffectTarget(this, target, "cleanse");
      if (target) cleanseAbnormalStatuses(target);
    },
    fear: function(target) { return this.applyStatus(target, "fear"); },
    clearTurnEffects: function(pet) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.clearTurnEffects(target));
      const target = skillEffectTarget(this, pet, "turn");
      if (target) clearTurnEffects(target);
    },
    forceClearPP: function(pet, source = this.sourceSkill?.name) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.forceClearPP(target));
      const target = skillEffectTarget(this, pet, "pp");
      if (!target) {
        traceBlockedPPSlots(pet, -1, "强制清空失败", source, "技能效果被免疫");
        return;
      }
      for (const skill of target.skills) setSkillPP(target, skill, 0, "强制清空 PP", source, target !== pet ? "效果被反弹" : undefined);
    },
    forceSwitchPet: function(pet) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.forceSwitchPet(target));
      const target = skillEffectTarget(this, pet, "switch");
      return target ? forceSwitchPet(target) : undefined;
    },
    markQinglingSeal: function(pet) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.markQinglingSeal(target));
      const target = skillEffectTarget(this, pet, "turn");
      if (target) target.qlSealMark = true;
    },
    resetAndLockStages: function(pet, turns) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.resetAndLockStages(target, turns));
      const target = skillEffectTarget(this, pet, "stat");
      if (!target) return;
      for (const key of STAGE_FIELDS) target[key] = 0;
      target.statLockedThrough = gameState.turnCount + turns - 1;
    },
    transformStages: function(pet, transform, alreadyChanged) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.transformStages(target, transform));
      const target = skillEffectTarget(this, pet, "stat");
      if (target && target !== alreadyChanged) for (const key of STAGE_FIELDS) target[key] = transform(target[key]);
    },
    halveRecovery: function(pet, turns) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.halveRecovery(target, turns));
      const target = skillEffectTarget(this, pet, "heal");
      if (target) target.dimoFrostRecoveryThrough = gameState.turnCount + turns - 1;
    },
    modifyStat: function(target, stat, stages) {
      if (stages < 0) recordAttemptedNegativeEffect(this, target, (ctx, target) => ctx.modifyStat(target, stat, stages));
      target = skillEffectTarget(this, target, "stat");
      if (!target) return;
      if (!Object.hasOwn(STAGE_LABELS, stat) || target.statLockedThrough >= gameState.turnCount) return;
      if (stages < 0 && hasStatDropImmunity(target, stat)) return;
      var key = stat + "Stage";
      if (target[key] !== undefined) {
        var before = target[key];
        target[key] = Math.max(-6, Math.min(6, target[key] + stages));
        addMessage(target.name + " 的" + STAGE_LABELS[stat] + " " + (target[key]>=0?"+":"") + target[key] + "级（" + (before>=0?"+":"") + before + "→" + (target[key]>=0?"+":"") + target[key] + "）！");
      }
    },
    deletePP: function(pet, slot, amount, source = this.sourceSkill?.name) {
      const requested = Math.floor(amount);
      if (requested > 0) recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.deletePP(target, slot, requested));
      const target = skillEffectTarget(this, pet, "pp");
      const requestLabel = requested === Infinity ? "请求清空" : "请求删除 " + requested + " PP";
      if (!target || !(requested > 0)) {
        traceBlockedPPSlots(target || pet, slot, "删 PP 无变化", source,
          !target ? requestLabel + "，技能效果被免疫" : "计算后无 PP 可扣除");
        return [];
      }
      const changed = [];
      for (const [index, skill] of target.skills.entries()) {
        if (slot >= 0 && index !== slot) continue;
        let blocked;
        if (skill.immuneToPP) blocked = "技能免疫常规删 PP";
        else if (skill.ppLocked) blocked = "技能 PP 受到保护";
        else if (skill.pp <= 0) blocked = "PP 已空";
        else if (skill.id === "sk_jydm_1" && target.bloodlineData?.jianghuaDeleteProtectedThrough >= gameState.turnCount) blocked = "极尽降华上场保护";
        const detail = requestLabel + (target !== pet ? "，效果被反弹" : "");
        if (blocked) {
          traceSkillPP(target, skill, skill.pp, skill.pp, "删 PP 失败", source, detail + "，" + blocked);
          continue;
        }
        const amount = Math.min(skill.pp, requested);
        setSkillPP(target, skill, skill.pp - amount, "删除 PP", source,
          amount < requested && requested !== Infinity ? detail + "，剩余 PP 不足" : detail);
        changed.push({ skill, slot: index, amount });
      }
      if (changed.length > 0) {
        target.lastPPDeletedSkills = changed.map(result => result.skill);
        target.lastPPDeletedSkill = changed[0].skill;
        recoverFromJianghuaDeletion(target, changed);
      }
      return changed;
    },
    restorePP: function(pet, slot, amount) {
      const target = skillEffectTarget(this, pet, "pp");
      const amt = Math.floor(amount);
      if (!target) {
        const requestLabel = amt === Infinity ? "请求回满" : "请求回复 " + amt + " PP";
        traceBlockedPPSlots(pet, slot, "回 PP 失败", this.sourceSkill?.name, requestLabel + "，技能效果被免疫");
        return;
      }
      const source = this.sourceSkill?.name || this.sourceSkill?.id;
      const logSource = target === pet ? source : (source ? source + "（反弹）" : "技能效果反弹");
      if (slot < 0) target.skills.forEach(skill => gainPP(target, skill, amt, this.sourceSkill?.id, logSource));
      else gainPP(target, target.skills[slot], amt, this.sourceSkill?.id, logSource);
    },
    addMark: function(target, name, amount) { if (!target.marks[name]) target.marks[name] = 0; target.marks[name] += amount; },
    getMark: function(target, name) { return target.marks[name] || 0; },
    addTurnEffect: function(target, name, turns, onTick, onExpire) {
      target = skillEffectTarget(this, target, "turn");
      if (!target) return;
      target.turnEffects.push({ name: name, turnsLeft: turns, onTick: onTick, onExpire: onExpire, createdTurn: gameState.turnCount || 0 });
    },
    saveSnapshot: function() {
      var make = function(party) {
        return (party || []).map(function(pet) {
          return {
            id: pet.id, hp: pet.hp,
            pp: pet.skills.map(function(s){ return s.pp; }),
            stages: STAGE_FIELDS.map(function(key) { return pet[key]; }),
            status: pet.status, statusTurns: pet.statusTurns,
            confuseTurns: pet.confuseTurns, bindTurns: pet.bindTurns, leechSeed: pet.leechSeed,
            poisoned: pet.poisoned, deepSleepToken: pet.deepSleepToken, abnormalVersions: new Map(pet.abnormalVersions)
          };
        });
      };
      gameState.snapshots.push({ turn: gameState.turnCount, player: make(gameState.playerParty), ai: make(gameState.aiParty) });
      if (gameState.snapshots.length > 30) gameState.snapshots.shift();
    },
    // 时间回溯：恢复双方全体宠物的精力/PP/强化/异常，返回回溯前后精力差
    restoreSnapshot: function(turnsBack, excludedSkill) {
      // 快照在回合末保存，按回合号定位：当前回合 - turnsBack
      var targetTurn = (gameState.turnCount || 0) - turnsBack;
      var idx = -1;
      for (var i = gameState.snapshots.length - 1; i >= 0; i--) {
        if (gameState.snapshots[i].turn <= targetTurn) { idx = i; break; }
      }
      if (idx < 0) idx = 0;
      var snap = gameState.snapshots[idx];
      if (!snap) return 0;
      var before = 0, after = 0;
      [[gameState.playerParty, snap.player], [gameState.aiParty, snap.ai]].forEach(function(cfg) {
        var party = cfg[0] || [], saved = cfg[1] || [];
        party.forEach(function(pet) { before += pet.hp; });
        saved.forEach(function(s) { after += s.hp; });
        party.forEach(function(pet, slot) {
          var s = saved[slot];
          if (!s) return;
          pet.hp = Math.min(pet.maxHp + (pet.maxHpBonus || 0), s.hp);
          pet.skills.forEach(function(skill, i) {
            if (skill === excludedSkill) {
              traceSkillPP(pet, skill, skill.pp, skill.pp, "跳过回溯", "逆流而行", "本招不回溯自身 PP");
            } else if (s.pp[i] !== undefined) {
              setSkillPP(pet, skill, s.pp[i], "回溯到第" + snap.turn + "回合", "逆流而行");
            }
          });
          STAGE_FIELDS.forEach(function(k, i){ if (s.stages[i] !== undefined) pet[k] = s.stages[i]; });
          pet.status = s.status; pet.statusTurns = s.statusTurns;
          pet.confuseTurns = s.confuseTurns || 0; pet.bindTurns = s.bindTurns || 0;
          pet.leechSeed = !!s.leechSeed; pet.poisoned = !!s.poisoned; pet.deepSleepToken = s.deepSleepToken;
          pet.abnormalVersions = new Map(s.abnormalVersions);
        });
      });
      return Math.abs(after - before);
    },
    savePPState: function() {
      var make = function(party) { return (party || []).map(function(p) { return p.skills.map(function(sk) { return sk.pp; }); }); };
      var state = { turn: gameState.turnCount, player: make(gameState.playerParty), ai: make(gameState.aiParty) };
      state.total = state.player.concat(state.ai).reduce(function(sum, pps) { return sum + pps.reduce(function(a,b) { return a+b; },0); },0);
      gameState.ppHistory.push(state);
      if (gameState.ppHistory.length > 30) gameState.ppHistory.shift();
    },
    rewindPPToMin: function(turns) {
      var cutoff = gameState.turnCount - turns + 1;
      var history = gameState.ppHistory.filter(function(h) { return h.turn >= cutoff && h.turn <= gameState.turnCount; });
      // 并列时保留最早快照，此选择仅为确定性实现，尚待玩家确认。
      var lowest = history.reduce(function(a,b) { return !a || b.total < a.total ? b : a; }, null);
      if (!lowest) return;
      [[gameState.playerParty, lowest.player], [gameState.aiParty, lowest.ai]].forEach(function(pair) {
        pair[0].forEach(function(pet, i) {
          pet.skills.forEach(function(skill, j) {
            const value = pair[1][i]?.[j];
            if (value !== undefined) setSkillPP(pet, skill, value, "回溯到第" + lowest.turn + "回合", "重衍纪元");
          });
        });
      });
    },
    setDamageCap: function(pet, threshold, cap, turns) {
      if (gameState.banEffects?.damageCap) return false;
      pet.damageCapThreshold = threshold;
      pet.damageCap = cap;
      pet.damageCapTurns = turns;
      return true;
    },
    setDamageReduction: function(pet, pct, turns = 1) {
      if (gameState.banEffects?.dmgReduction) return false;
      pet.damageReduction = pct;
      pet.damageReductionTurns = turns;
      return true;
    },
    setCritPrevention: function(pet) { pet.preventCritNext = true; },
    setWeather: function(type, turns) { if (jianghuaBlocksSummon(this, "天气")) return false; if (gameState.field) { addMessage("环境在场，天气无法降临！"); return false; } gameState.weather = type; gameState.weatherTurns = turns; addMessage("天气变更为" + (WEATHER_DISPLAY[type]?.[1] || type) + "！持续"+turns+"回合"); return true; },
    mayClearField: function() { return !(gameState.fieldLockedThrough >= gameState.turnCount); },
    setField: function(type, turns, options = {}) {
      if (jianghuaBlocksSummon(this, "环境") || (gameState.fieldLockedThrough >= gameState.turnCount && (!options.locked || gameState.field !== type))) return false;
      if (options.locked) {
        gameState.weather = null; gameState.weatherTurns = 0;
        gameState.fieldLockedThrough = gameState.turnCount + turns - 1;
      }
      gameState.field = type; gameState.fieldTurns = turns; addMessage("环境变更为" + ({"dream":"梦境","shunhua":"瞬华"}[type]||type) + "！持续"+turns+"回合");
      return true;
    },
    addCritBonus: function(target, amount, turns) { target.critRateBonus = (target.critRateBonus || 0) + amount; var self = this; setTimeout(function() { target.critRateBonus = Math.max(0, (target.critRateBonus || 0) - amount); }, turns * 1000 || 2000); },
    invertHealing: function(target, pct, turns) {
      if (pct > 0) recordAttemptedNegativeEffect(this, target, (ctx, target) => ctx.invertHealing(target, pct, turns));
      target = skillEffectTarget(this, target, "heal");
      if (!target) return;
      target.healInvertPct = pct;
      target.healInvertTurns = turns;
      addMessage(target.name + "的治疗被倒置" + Math.round(pct * 100) + "%持续" + turns + "回合！");
    },
    setPPCostEffect: function(pet, source, turns, options) {
      const slot = options.skill ? pet.skills.indexOf(options.skill) : -1;
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => {
        if (slot < 0 || target.skills[slot]) {
          ctx.setPPCostEffect(target, source, turns, { ...options, skill: slot < 0 ? undefined : target.skills[slot] });
        }
      });
      const target = skillEffectTarget(this, pet, "pp");
      if (target && (slot < 0 || target.skills[slot])) {
        setPPCostEffect(target, source, turns, { ...options, skill: slot < 0 ? undefined : target.skills[slot] });
      }
    },
    lockSwitch: function(pet, source, turns) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.lockSwitch(target, source, turns));
      const target = skillEffectTarget(this, pet, "switch");
      if (target) (target.switchLockSources ||= new Map()).set(source, gameState.turnCount + turns - 1);
    },
    msg: function(text) { addMessage(text); },
    get playerActive() { return gameState.playerActive; },
    get aiActive() { return gameState.aiActive; },
    get playerParty() { return gameState.playerParty; },
    get aiParty() { return gameState.aiParty; }
  };
}

// 测试模式记录单个技能槽的 PP 结算，普通战斗仍用原有事件说明。
function ppSourceName(source) { return DEFAULT_SKILLS.find(item => item.id === source)?.name || source; }

function traceSkillPP(pet, skill, before, after, action, source, detail) {
  if (!isDeveloperBattle() || !pet) return;
  const player = gameState.playerActive === pet || gameState.playerParty.includes(pet);
  const ai = !player && (gameState.aiActive === pet || gameState.aiParty.includes(pet));
  const active = pet === gameState.playerActive || pet === gameState.aiActive;
  const position = (player ? "我方" : ai ? "对方" : "") + (player || ai ? (active ? "场上" : "场下") : "");
  const slot = pet.skills.indexOf(skill);
  const delta = after - before;
  const change = delta > 0 ? "+" + delta + " PP" : delta < 0 ? "−" + -delta + " PP" : "无变化";
  const label = source && ppSourceName(source);
  addMessage("【PP】" + position + pet.name + (slot < 0 ? "" : "第" + (slot + 1) + "格") + "「" + skill.name + "」 " +
    before + " → " + after + "（" + change + "）｜" + action +
    (label ? " · " + label : "") + (detail ? "｜" + detail : ""), "action", player ? "player" : ai ? "ai" : "system");
}

function traceBlockedPPSlots(pet, slot, action, source, detail) {
  if (!isDeveloperBattle() || !pet) return;
  for (const [index, skill] of pet.skills.entries()) {
    if (slot < 0 || index === slot) traceSkillPP(pet, skill, skill.pp, skill.pp, action, source, detail);
  }
}

function setSkillPP(pet, skill, value, action, source, detail) {
  if (skill.useLimit) {
    const remaining = Math.max(0, skill.useLimit - (skill.useCount || 0));
    if (value > remaining) {
      value = remaining;
      const limit = "本局最多使用 " + skill.useLimit + " 次，剩余 " + remaining + " 次";
      detail = detail ? detail + "，" + limit : limit;
    }
  }
  const before = skill.pp;
  skill.pp = value;
  if (before !== value || detail) traceSkillPP(pet, skill, before, value, action, source, detail);
  return value - before;
}

// PP 回复封锁与技能指定来源在此判定。
function isPPRecoveryBlocked(pet) {
  return !!pet && (pet.blockPPRecovery || pet.blockPPRecoveryOnTurn === gameState.turnCount);
}

function gainPP(pet, skill, amount, sourceSkillId, logSource = sourceSkillId) {
  if (!skill) return 0;
  if (amount <= 0) {
    traceSkillPP(pet, skill, skill.pp, skill.pp, "回 PP 无变化", logSource, "计算后的回复量为 " + amount + " PP");
    return 0;
  }
  const allowed = skill.ppRecoverySource;
  let blocked;
  if (skill.id === "sk_qy_5" && pet?.bloodlineData?.qingnianChannel &&
      (sourceSkillId === "清念·翼系招式" || sourceSkillId === "清念PP回复")) {
    blocked = "清念沉脉正在等待自身结算，跳过血脉回复";
  }
  else if (isPPRecoveryBlocked(pet)) blocked = "目标本回合禁止回复 PP";
  else if (skill.noPPRecover) blocked = "技能免疫常规 PP 回复";
  else if (skill.noPPRecoverThrough >= gameState.turnCount) blocked = "技能禁回至第" + skill.noPPRecoverThrough + "回合结束";
  else if (allowed && ![allowed].flat().includes(sourceSkillId)) {
    blocked = isDeveloperBattle() ? "仅可由" + [allowed].flat().map(ppSourceName).join("、") + "回复" : "仅可由指定来源回复";
  }
  else if ((skill.id === "sk_qy_2" && pet?.bloodlineData?.qingfengSavedPP !== undefined) ||
      (skill.id === "sk_qy_3" && pet?.bloodlineData?.qy3SavedPP !== undefined)) blocked = "PP 处于封存状态";
  const requestLabel = amount === Infinity ? "请求回满" : "请求回复 " + amount + " PP";
  if (blocked) {
    traceSkillPP(pet, skill, skill.pp, skill.pp, "回 PP 失败", logSource, requestLabel + "，" + blocked);
    return 0;
  }
  const requested = amount === Infinity ? skill.maxPp - skill.pp : amount;
  const reduced = pet?.dimoFrostRecoveryThrough >= gameState.turnCount;
  const recovered = reduced ? Math.ceil(requested / 2) : requested;
  const value = Math.min(skill.maxPp, skill.pp + recovered);
  let detail = requestLabel;
  if (reduced && requested > 0) detail += "，瞬华若霜减半后为 " + recovered + " PP";
  if (skill.pp === skill.maxPp) detail += "，PP 已满";
  else if (value < skill.pp + recovered) detail += "，受最大 PP 限制";
  return setSkillPP(pet, skill, value, "回复 PP", logSource, detail);
}

// ---------- BLOODLINE & TURN EFFECT PROCESSING ----------
function processBloodlines() {
  var ctx = createBattleContext();
  [gameState.playerActive, gameState.aiActive].forEach(function(pet) {
    if (pet && !pet.isFainted() && pet.bloodline && pet.bloodline.onTurnStart) {
      pet.bloodline.onTurnStart(pet, ctx);
    }
  });
}

function getQingyuStartingMode(pet) {
  const first = pet.skills[0]?.id;
  if (first === "sk_qy_1" && pet.skills.some(skill => skill.id === "sk_qy_4")) return "清念";
  if (first === "sk_qy_4" && pet.skills.some(skill => skill.id === "sk_qy_1")) return "残脉";
  return null;
}

function setQingyuOriginalBloodline(pet, active) {
  const source = "清羽原初血脉";
  pet.passiveDamageReduction = active ? 20 : 0;
  if (active) grantStatusImmunity(pet, source, Infinity, { statuses: ABNORMAL_WITHOUT_BIND });
  else revokeStatusImmunity(pet, source);
}

// 残念余梦的封存 PP 只在真正的残脉→清念转换时恢复一次。
function enterQingyuMode(pet, mode) {
  var bd = pet.bloodlineData || (pet.bloodlineData = { turnCount: 0, qfzn: 0, healCount: 0 });
  var previous = bd.mode;
  if (previous === "清念" && mode !== "清念" && bd.qingnianChannel) finishQingnianChannel(pet, true);
  bd.mode = mode;
  bd.modeEntered = true;
  if (pet.bloodline?.name === "清念/残脉") setQingyuOriginalBloodline(pet, false);
  if (mode === "清念" && bd.qingfengSavedPP !== undefined) {
    const skill = pet.skills.find(item => item.id === "sk_qy_2");
    if (skill) setSkillPP(pet, skill, Math.min(skill.maxPp, bd.qingfengSavedPP), "恢复封存 PP", "轻风散魂·进入清念");
    delete bd.qingfengSavedPP;
  }
  if (previous === "残脉" && mode === "清念" && bd.qy3SavedPP !== undefined) {
    var skill = pet.skills.find(function(s) { return s.id === "sk_qy_3"; });
    if (skill) setSkillPP(pet, skill, Math.min(skill.maxPp, bd.qy3SavedPP), "恢复封存 PP", "残念余梦·残脉转清念");
    delete bd.qy3SavedPP;
  }
}

function mingnianData(pet) {
  const bd = pet.bloodlineData ||= {};
  bd.marks ??= 0;
  bd.mingnianUses ??= new Set();
  return bd;
}

function isMingnianMarked(pet) {
  return !!pet?.bloodlineData?.markTarget && pet.bloodlineData.markThrough >= gameState.turnCount;
}

function syncMingnianMaxHP(pet) {
  const bd = mingnianData(pet);
  const bonus = (isMingnianMarked(pet) ? 50 + 15 * bd.marks : 0) +
    (isMingnianMarked(pet) && bd.jianghuaThrough >= gameState.turnCount ? 100 : 0);
  pet.maxHpBonus = bonus;
  pet.hp = Math.min(pet.hp, pet.maxHp + bonus);
}

function endMingnian(pet, resetMarks = false) {
  const bd = mingnianData(pet);
  if (resetMarks) bd.marks = 0;
  if (!bd.markTarget) return;
  delete bd.markTarget; delete bd.markThrough;
  bd.marked = false; bd.markTurns = 0;
  pet.mingNianDmg = 0;
  revokeStatusImmunity(pet, "明念");
  syncMingnianMaxHP(pet);
}

function advanceMingnian(pet, target, ctx, skill) {
  if (![gameState.playerActive, gameState.aiActive].includes(pet) || pet.isFainted() ||
      ![gameState.playerActive, gameState.aiActive].includes(target) || target.isFainted()) return;
  const bd = mingnianData(pet);
  bd.mingnianUses.add(skill);
  const required = pet.skills.filter(item => item.id !== "sk_jydm_1" || item.pp > 0);
  if (!(ctx.isPassive || ctx.wasInJianghua) &&
      (!required.length || !required.every(item => bd.mingnianUses.has(item)))) return;
  const remark = bd.markTarget === target && bd.markThrough >= gameState.turnCount;
  if (remark) bd.marks++;
  else endMingnian(pet);
  bd.markTarget = target; bd.marked = true;
  bd.markTurns = remark ? 5 : 4;
  bd.markThrough = gameState.turnCount + bd.markTurns - 1;
  bd.mingnianUses.clear();
  syncMingnianMaxHP(pet);
  ctx.grantStatusImmunity(pet, "明念", Infinity, {
    statuses: ["sleep", "freeze", "paralyze", "fear", "confuse", "bind"],
    stats: ["spatk", "spd"],
    active: () => isMingnianMarked(pet)
  });
  pet.mingNianDmg = 40;
  ctx.msg("【明念】标记" + target.name + bd.markTurns + "回合，光明之印×" + bd.marks + "！");
}

function getActiveOpponent(pet) {
  return pet === gameState.playerActive ? gameState.aiActive : pet === gameState.aiActive ? gameState.playerActive : null;
}

function dimoAttack(u, t, ctx, dodgeResult) {
  if (!t || t.isFainted() || u.isFainted()) return;
  if (dodgeResult === false) {
    ctx.transformStages(u, value => -value);
    ctx.transformStages(t, value => -value, u);
    ctx.deletePP(t, -1, 2);
  }
  const damage = ctx.doDamage(u, t, 90, "physical", "fighting", dodgeResult ? { atkStageOverride: 2 } : undefined);
  ctx.msg("【化念作刃】造成" + damage.damage + "点伤害！");
  const bd = mingnianData(u);
  if (!isMingnianMarked(u) || bd.markTarget !== t) return;
  const stages = STAGE_FIELDS.reduce((total, key) => total + Math.abs(t[key]), 0);
  const extra = Math.floor(0.4 * (t.lastTurnOutput || 0) * stages);
  if (extra > 0) ctx.doFixedDamage(t, extra, u);
  u.immuneEject = true;
  if (bd.marks < 4) {
    ctx.deletePP(t, -1, 1);
    if (damage.isCrit) ctx.deletePP(t, -1, 1);
  } else {
    ctx.doFixedDamage(t, 999, u);
    endMingnian(u, true);
    const first = u.skills[0];
    if (first) gainPP(u, first, first.maxPp, "化念作刃清印");
  }
}

function resolveDimoFirstAttack(owner, opposingSkill) {
  const pending = owner?.dimoPendingAttack;
  if (!pending) return false;
  delete owner.dimoPendingAttack;
  const { target, ctx, action, turn } = pending;
  if (turn !== gameState.turnCount || getActiveOpponent(owner) !== target || owner.isFainted()) return false;
  const dodge = opposingSkill ? !opposingSkill.semiSure && opposingSkill.accuracy < 100 : null;
  ctx.skillAction = action;
  try {
    dimoAttack(owner, target, ctx, dodge);
    advanceMingnian(owner, target, ctx, ctx.sourceSkill);
  } finally {
    ctx.skillAction = null;
  }
  return dodge;
}

function recordDimoSkillRound(pet, skill) {
  const turn = gameState.turnCount;
  const history = pet.dimoRounds ||= new Map();
  for (const round of history.keys()) if (round < turn - 6) history.delete(round);
  if (!history.has(turn)) history.set(turn, new Set());
  history.get(turn).add(skill);
  applyDimoScreenCosts(pet);
}

function applyDimoScreenCosts(pet) {
  const turn = gameState.turnCount;
  const history = pet.dimoRounds;
  if (!history) return;
  for (const [source, cast] of pet.dimoScreenWindows || []) {
    const through = cast + 3;
    if (turn > through) {
      pet.dimoScreenWindows.delete(source);
      continue;
    }
    for (const skill of pet.skills) {
      for (let round = cast - 1; round <= Math.min(turn, through); round++) {
        if (!history.get(round)?.has(skill) || !history.get(round - 1)?.has(skill) || !history.get(round - 2)?.has(skill)) continue;
        const sourceKey = "光幕三损:" + pet.skills.indexOf(skill);
        setPPCostEffect(pet, sourceKey, through - turn + 1, { extra: 2, skill });
        break;
      }
    }
  }
}

function dimoShieldBroke(pet, source) {
  if (!(pet.dimoScreenShieldThrough >= gameState.turnCount) || pet.bloodlineData?.markTarget !== source) return;
  cleanseAbnormalStatuses(pet);
  for (const key of STAGE_FIELDS) if (pet[key] < 0) pet[key] = 0;
  pet.dimoScreenShieldBoost = true;
}

function restrictJianghuaDamage(pet, damage) {
  const bd = pet.bloodlineData;
  if (!bd || !(bd.jianghuaThrough >= gameState.turnCount) || gameState.banEffects?.damageCap || damage <= 0) return damage;
  if (bd.jianghuaDamageTurn !== gameState.turnCount) {
    bd.jianghuaDamage = 0;
    bd.jianghuaDamageTurn = gameState.turnCount;
  }
  const allowed = Math.min(damage, Math.max(0, bd.jianghuaCap - bd.jianghuaDamage));
  bd.jianghuaDamage += allowed;
  if (allowed < damage) countJianghuaRestriction(pet);
  return allowed;
}

function countJianghuaRestriction(pet) {
  const bd = pet.bloodlineData;
  bd.jianghuaRestrictions = (bd.jianghuaRestrictions || 0) + 1;
  if (bd.jianghuaRestrictions % 2 === 0) {
    bd.marks++;
    syncMingnianMaxHP(pet);
  }
}

function sealDivineSkill(defender, attacker, skill) {
  const turn = gameState.turnCount;
  if (!attacker || attacker === defender || !DIVINE_ELEMENTS.has(skill?.element) ||
      !(defender.bloodlineData?.jianghuaThrough >= turn) || !attacker.skills.includes(skill)) return;
  const sealedTurns = skill.jianghuaSealedTurns ||= new Set();
  for (const previous of sealedTurns) if (previous < turn) sealedTurns.delete(previous);
  if (sealedTurns.has(turn + 1)) return;
  sealedTurns.add(turn + 1);
  countJianghuaRestriction(defender);
  addMessage("【极尽降华】" + attacker.name + " 的" + skill.name + "在下一回合被封禁！");
}

function jianghuaBlocksSummon(ctx, kind) {
  const owner = ctx.sourceSkillOwner;
  const lockOwners = Array.from(gameState.jianghuaOwners || [])
    .filter(pet => pet.bloodlineData?.jianghuaThrough >= gameState.turnCount);
  if (!lockOwners.length) return false;
  addMessage("【极尽降华】" + kind + "召唤被封锁！");
  if (!owner) return true;
  for (const caster of lockOwners) {
    const ownParty = gameState.playerParty.includes(caster) ? gameState.playerParty : gameState.aiParty;
    if (caster === owner || ownParty.includes(owner)) continue;
    const counts = caster.bloodlineData.jianghuaSummons;
    const count = (counts.get(owner) || 0) + 1;
    counts.set(owner, count);
    if (count === 3) createBattleContext().doFixedDamage(owner, 999);
  }
  return true;
}

function recoverFromJianghuaDeletion(target, changes) {
  if (target.bloodline?.name !== "明念" || target.isFainted() ||
      ![gameState.playerActive, gameState.aiActive].includes(target)) return;
  const entry = changes.find(change => change.skill.id === "sk_jydm_1" && change.skill.pp === 0);
  if (entry) (gameState.pendingJianghuaByPet ||= new Map()).set(target, entry.skill);
}

function resolveJianghuaDeletions() {
  const queued = gameState.pendingJianghuaByPet || new Map();
  gameState.pendingJianghuaByPet = new Map();
  for (const [pet, skill] of queued) {
    const target = getActiveOpponent(pet);
    if (pet.isFainted() || !target || target.isFainted()) continue;
    const ctx = createBattleContext();
    ctx.sourceSkill = skill;
    ctx.sourceSkillOwner = pet;
    ctx.isPassive = true;
    const breakdown = isDeveloperBattle() ? {} : null;
    const extra = getRequiredPPCost(pet, skill, breakdown) - 1;
    if (extra > 0) {
      const value = Math.max(0, skill.pp - extra);
      setSkillPP(pet, skill, value, "被动发动额外扣费", "极尽降华",
        breakdown ? describePPCost(breakdown, extra, skill.pp - value) : undefined);
    }
    recordRoundSkillUse({ user: pet, skill, effectivePriority: getSkillPriority(skill) }, target);
    recordDimoSkillRound(pet, skill);
    applyQingnianSuppression(pet, skill);
    addMessage("【极尽降华】PP被删除，被动发动！");
    skill.onUse(pet, target, ctx);
    pet.bloodline?.onActionEnd?.(pet, target, ctx, skill);
  }
}

function resolveNilexFollowup(user, target, ctx, pending) {
  if (user.pendingNilex === pending) user.pendingNilex = null;
  if (pending.cnt === 1) {
    ctx.doFixedDamage(target, 9999, user);
    ctx.forceClearPP(target, "逆流而行·终结");
    for (const skill of user.skills) gainPP(user, skill, 1, "sk_nlex", "逆流而行·终结");
    ctx.msg("【逆流而行】终结：9999固伤，强制清空对方PP，自身全体回复1PP！");
  } else if (pending.cnt === 2) {
    for (const skill of user.skills) gainPP(user, skill, 3, "sk_nlex", "逆流而行·后续回复");
    ctx.doHeal(user, Math.floor((user.maxHp + (user.maxHpBonus || 0)) * 0.3));
    ctx.msg("【逆流而行】回溯：自身全体回复3PP与30%精力！");
  }
}

function endCreation(pet) {
  const data = pet.bloodlineData;
  if (!data?.creationActive) return;
  data.creationActive = false;
  data.creationThrough = -1;
  data.creationTarget?.creationSpeedSources?.delete(pet);
  pet.creationSpeedSources?.delete(pet);
  delete data.creationTarget;
  for (const [recipient, source] of data.creationCosts || []) recipient.ppCostEffects?.delete(source);
  delete data.creationCosts;
  gameState.creationOwners?.delete(pet);
}

function creationPP(pet, opponent, ctx) {
  if (!opponent || opponent.isFainted()) return;
  for (const { slot, amount } of ctx.deletePP(opponent, -1, 2, "创世之能·吸取")) {
    gainPP(pet, pet.skills[slot], amount, "sk_cszn", "创世之能·吸取");
  }
}

function processCreationRounds() {
  const ctx = createBattleContext();
  for (const owner of gameState.creationOwners || []) {
    const data = owner.bloodlineData;
    if (owner.isFainted() || gameState.turnCount > data.creationThrough) {
      endCreation(owner);
      continue;
    }
    const opponent = getActiveOpponent(owner);
    if (!opponent || gameState.turnCount < data.creationThrough - 1) continue;
    creationPP(owner, opponent, ctx);
    if (gameState.turnCount === data.creationThrough - 1) {
      ctx.transformStages(owner, () => 0);
      ctx.transformStages(opponent, () => 0);
      gainPP(owner, owner.skills[0], Infinity, "sk_cszn", "创世之能·次回合");
    } else {
      const cap = owner.maxHp + (owner.maxHpBonus || 0);
      if (owner.hp < cap * 0.3) ctx.doHeal(owner, Math.floor((cap - owner.hp) * 0.7));
      const skill = owner.skills.find(item => item.id === "sk_cszn");
      if (skill) setSkillPP(owner, skill, 0, "清空自身 PP", "创世之能·末回合", "当前精力 " + owner.hp + "/" + cap);
    }
  }
}

function getOutputMultiplier(pet) {
  const buff = (pet.dmgMod ?? 1) + (isMingnianMarked(pet) ? 0.15 : 0) +
    (pet.jianghuaGlobalThrough >= gameState.turnCount ? 1 : 0) +
    (pet.bloodlineData?.creationThrough >= gameState.turnCount ? 0.25 : 0);
  const shroud = pet.skills.some(skill => skill.id === "sk_cyjy" && skill.pp > 0) ? 0.6 : 1;
  return buff * shroud * (1 - (pet.outputReduction || 0) / 100);
}

function applyMingnianDamage(ctx, owner, target) {
  const stages = STAGE_FIELDS.reduce((sum,key) => sum + Math.abs(owner[key] || 0) + Math.abs(target[key] || 0), 0);
  const amount = 40 + 15 * stages;
  ctx.doFixedDamage(target, amount, owner, { skipMingnian: true });
  ctx.msg(owner.name + " 明念追加" + amount + "点固伤！");
}

function totalSkillPP(pet) {
  return pet.skills.reduce((sum, skill) => sum + skill.pp, 0);
}

function startQingnianChannel(owner, opponent, turns, ctx) {
  const data = owner.bloodlineData ||= {};
  const samples = new Map();
  const channel = data.qingnianChannel = { samples, attackingPlayer: gameState.playerActive === owner };
  for (const pet of [owner, opponent]) {
    const total = totalSkillPP(pet);
    const first = gameState.roundStartPP?.get(pet) ?? total + (pet === owner ? ctx.skillPPCost || 0 : 0);
    samples.set(pet, { net: 0, first, last: total });
  }
  owner.turnEffects = owner.turnEffects.filter(effect => effect.name !== "清念沉脉");
  ctx.addTurnEffect(owner, "清念沉脉", turns, null, () => {
    if (data.qingnianChannel === channel) finishQingnianChannel(owner, false);
  });
}

function beginQingnianSample(channel, pet) {
  if (!pet) return;
  const total = totalSkillPP(pet);
  const sample = channel.samples.get(pet) || { net: 0 };
  if (sample.first !== undefined) return;
  sample.first = sample.last = total;
  channel.samples.set(pet, sample);
}

function closeQingnianSample(sample, pet) {
  if (sample.first === undefined) return;
  sample.net += sample.first - totalSkillPP(pet);
  delete sample.first;
}

function sampleQingnianEndOfRound() {
  for (const owner of [gameState.playerActive, gameState.aiActive]) {
    const data = owner?.bloodlineData?.qingnianChannel;
    if (!data) continue;
    for (const [pet, sample] of data.samples) {
      if (sample.first !== undefined) sample.last = totalSkillPP(pet);
    }
  }
}

function finishQingnianChannel(owner, useCurrentPP) {
  const data = owner.bloodlineData;
  const channel = data.qingnianChannel;
  if (!channel) return;
  delete data.qingnianChannel;
  owner.turnEffects = owner.turnEffects.filter(effect => effect.name !== "清念沉脉");
  let loss = 0;
  for (const [pet, sample] of channel.samples) {
    const change = sample.first === undefined ? 0 : sample.first - (useCurrentPP ? totalSkillPP(pet) : sample.last);
    loss += Math.abs(sample.net + change);
  }
  const restored = gainPP(owner, owner.skills.find(skill => skill.id === "sk_qy_5"), Math.round(loss / 2), undefined, "清念沉脉·期满");
  const targetSide = channel.attackingPlayer ? "aiActive" : "playerActive";
  const until = gameState.turnCount + 3;
  gameState.qingnianWindows[targetSide] = until;
  if (gameState[targetSide]) gameState[targetSide].qingnianWindowEnd = until;
  addMessage("清念沉脉结束，回复" + restored + "PP，开启4回合出招削弱窗口。");
}

function trackQingnianSwitch(pet, leaving) {
  const active = [gameState.playerActive, gameState.aiActive];
  for (const owner of active) {
    const channel = owner?.bloodlineData?.qingnianChannel;
    if (!channel) continue;
    if (leaving) {
      for (const [samplePet, sample] of channel.samples) {
        if (owner === pet || samplePet === pet) closeQingnianSample(sample, samplePet);
      }
    } else {
      const involved = owner === pet ? active : [pet];
      for (const entrant of involved) beginQingnianSample(channel, entrant);
    }
  }
}

function setSkillElement(pet, source, element, turns) {
  const effects = pet.skillElementEffects ||= new Map();
  effects.delete(source);
  effects.set(source, { element, throughTurn: gameState.turnCount + turns - 1 });
}

function getEffectiveSkillElement(pet, baseElement) {
  if (gameState.forceSkillElement) return gameState.forceSkillElement;
  let element = baseElement;
  for (const [source, effect] of pet.skillElementEffects || []) {
    if (effect.throughTurn < gameState.turnCount) pet.skillElementEffects.delete(source);
    else element = effect.element;
  }
  return element;
}

function getWannenPower(pet) {
  const skill = pet.skills.find(item => item.id === "sk_ql_2");
  if (!skill) return 150;
  const spent = Math.max(0, skill.maxPp - skill.pp);
  const marks = pet.bloodlineData?.microLing || 0;
  return Math.min(pet.skills[0]?.pp === 0 ? 1000 : 500, Math.ceil(spent * (150 + marks)));
}

function getSkillPower(skill, power) {
  return power * (1 - (skill ? skill.qingnianPowerLoss || 0 : 0));
}

function getSkillPriority(skill) {
  return (skill.dimoFastThrough >= gameState.turnCount ? 12 : skill.priority ?? 8) - (skill.qingnianPriorityLoss || 0);
}

function applyQingnianSuppression(pet, skill) {
  const side = pet === gameState.playerActive ? "playerActive" : "aiActive";
  const until = gameState.qingnianWindows[side] ?? pet.qingnianWindowEnd;
  if (until === undefined || gameState.turnCount > until) return;
  if (skill.category === "status") {
    skill.qingnianPriorityLoss = (skill.qingnianPriorityLoss || 0) + 1;
    addMessage("【清念沉脉】" + pet.name + " 的" + skill.name + "先手永久-1！");
  } else {
    skill.qingnianPowerLoss = Math.min(0.5, (skill.qingnianPowerLoss || 0) + 0.3);
    addMessage("【清念沉脉】" + pet.name + " 的" + skill.name + "威力永久削弱" + Math.round(skill.qingnianPowerLoss * 100) + "%！");
  }
}

function processTurnEffects(pet) {
  if (!pet || pet.isFainted()) return;
  // 先快照再清空：onTick 内注册的新效果写入新数组，不会被本轮结果覆盖
  var queue = pet.turnEffects.slice();
  pet.turnEffects = [];
  queue.forEach(function(e) {
    if (!e) return;
    if (e.onTick) e.onTick(pet);
    // 本回合刚创建的效果不在本回合递减，避免“1回合”当场归零
    if (e.createdTurn === (gameState.turnCount || 0)) { pet.turnEffects.push(e); return; }
    e.turnsLeft--;
    if (e.turnsLeft <= 0) { if (e.onExpire) e.onExpire(pet); }
    else pet.turnEffects.push(e);
  });
  tickStatusImmunities(pet);
  // 保留既有封锁结束点：上一回合施加的封锁仍覆盖本回合开场回复。
  pet.blockPPRecovery = false;
}

function postDamageProcessing() {
  // Check lethal hit survival (不灭魂体 mechanic)
  [gameState.playerActive, gameState.aiActive].forEach(function(pet) {
    if (!pet || !pet.bloodline) return;
    if (pet.lethalHitThisTurn && pet.bloodline.name === "不灭魂体" && !pet.lethalHandled) {
      pet.lethalHandled = true;
      const switched = forceSwitchPet(pet, () => {
        pet.hp = 1;
        createBattleContext().deletePP(pet, -1, 4, "不灭魂体·保命");
        addMessage(pet.name + " 被致命一击！不灭魂体保留1点精力！全体技能-4PP！");
      });
      if (!switched) {
        pet.hp = 0;
        addMessage("【不灭魂体】" + pet.name + "无法被驱逐，致死保命未生效。");
      }
    }
  });
}

function isEjectImmune(pet) {
  return pet.immuneEject || pet.dimoEjectImmuneThrough >= gameState.turnCount;
}

function getForcedSwitchCandidates(pet) {
  if (pet !== gameState.playerActive && pet !== gameState.aiActive) return [];
  const party = gameState.playerActive === pet ? gameState.playerParty : gameState.aiParty;
  return party.filter(candidate => candidate !== pet && !candidate.isFainted());
}

function forceSwitchPet(pet, beforeLeave) {
  if (pet !== gameState.playerActive && pet !== gameState.aiActive) return;
  if (isEjectImmune(pet)) { addMessage(pet.name + " 免疫了驱逐效果！"); return; }
  const candidates = getForcedSwitchCandidates(pet);
  if (!candidates.length) return;
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  beforeLeave?.();
  leaveBattlefield(pet);
  if (gameState.playerActive === pet) {
    addMessage(pet.name + " 被迫换下！"); gameState.playerActive = next; callBloodlineEnter(next); addMessage("换上 " + next.name + "！");
  } else {
    addMessage(pet.name + " 被迫换下！"); gameState.aiActive = next; callBloodlineEnter(next); addMessage("对手换上 " + next.name + "！");
  }
  renderBattle(document.querySelector("#app"));
  return next;
}

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
function stopTurnTimer() {
  clearInterval(gameState.turnTimer);
  clearTimeout(gameState.autoSkipTimer);
  gameState.turnTimer = null;
  gameState.autoSkipTimer = null;
  var td = document.querySelector("#turn-timer");
  if (td) td.style.display = "none";
}

// ---------- WEATHER SYSTEM ----------
function processField() {
  if (gameState.field && gameState.fieldTurns <= 0) { gameState.field = null; addMessage("环境消散了..."); }
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
    if (gameState.weatherTurns <= 0) { gameState.weather = null; gameState.weatherTurns = 0; addMessage("天气消散了..."); }
  }
  if (gameState.field) {
    gameState.fieldTurns--;
    if (gameState.fieldTurns <= 0) { gameState.field = null; gameState.fieldTurns = 0; addMessage("环境消散了..."); }
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
          createBattleContext().doFixedDamage(pet, Math.floor(pet.maxHp / 16));
          addMessage("沙暴侵袭" + pet.name + "！");
        }
      });
      break;
    case "hailstorm":
      [p,a].forEach(function(pet) {
        if (pet && !pet.isFainted() && pet.element !== "ice") {
          createBattleContext().doFixedDamage(pet, Math.floor(pet.maxHp / 16));
          addMessage("冰雹砸落" + pet.name + "！");
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

// ---------- LEGACY FUNCTIONS ----------
function calcDamage(attacker, defender, skill) {
  if (skill.power === 0) return { damage: 0, effectiveness: 1, isCrit: false };
  if (skill.power > 0 && hasPowerDamageImmunity(defender)) return { damage: 0, effectiveness: 1, isCrit: false };
  var isPhysical = skill.category === "physical";
  var atkStat = isPhysical ? attacker.getStat("atk") : attacker.getStat("spatk");
  var defStat = isPhysical ? defender.getStat("def") : defender.getStat("spdef");
  var dmg = Math.floor(((2 * attacker.level / 5 + 2) * getSkillPower(skill, skill.power) * (atkStat / defStat)) / 50 + 2);
  dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
  const element = getEffectiveSkillElement(attacker, skill.element);
  if (element && element === attacker.element) dmg = Math.floor(dmg * 1.5);
  var eff = getEffectiveness(element, defender.element);
  dmg = Math.floor(dmg * eff);
  dmg = Math.floor(dmg * getWeatherDamageMod(element, defender.element));
  var isCrit = false;
  if (skill.category !== "status" && Math.random() < (0.0625 + (attacker.critRateBonus || 0)) && !attacker.preventCritNext && defender.bloodline?.name !== "不灭魂体") { dmg = Math.floor(dmg * 1.5); isCrit = true; }
  if (attacker.preventCritNext) attacker.preventCritNext = false;
  if (attacker.status === "burn" && isPhysical) dmg = Math.floor(dmg * 0.5);
  dmg = Math.floor(dmg * getOutputMultiplier(attacker));
  if (defender.bloodline?.name === "不灭魂体" && eff >= 2) dmg = Math.floor(dmg * 0.6);
  return { damage: Math.max(1, dmg), effectiveness: eff, isCrit: isCrit };
}

// 防控按宠物与来源登记，由同一处负责刷新、累加和到期。
const ABNORMAL_WITHOUT_BIND = ["burn", "freeze", "paralyze", "poison", "sleep", "deep_sleep", "confuse", "fear", "leech_seed"];
const ABNORMAL_STATUSES = ABNORMAL_WITHOUT_BIND.concat("bind");
const STATUS_LABELS = { burn: "烧伤", freeze: "冰冻", paralyze: "麻痹", poison: "中毒",
  sleep: "睡眠", deep_sleep: "沉睡", fear: "恐惧", confuse: "混乱", bind: "束缚", leech_seed: "寄生" };
const STATUS_MESSAGES = { burn: "烧伤了", freeze: "被冰冻了", paralyze: "麻痹了", poison: "中毒了",
  sleep: "睡着了", deep_sleep: "陷入沉睡", fear: "被恐惧了", confuse: "混乱了", bind: "被束缚了", leech_seed: "被寄生种子缠住了" };

function grantStatusImmunity(pet, source, turns, options = {}) {
  const sources = pet.statusImmunitySources;
  const previous = sources.get(source);
  const turnsLeft = options.stack && previous ? previous.turnsLeft + turns : turns;
  sources.set(source, {
    source,
    statuses: options.statuses || ABNORMAL_STATUSES,
    stats: options.stats,
    active: options.active,
    turnsLeft,
    createdTurn: gameState.turnCount
  });
  return turnsLeft;
}

function revokeStatusImmunity(pet, source) {
  pet.statusImmunitySources.delete(source);
}

function activeStatusImmunities(pet) {
  if (!pet.statusImmunitySources) return [];
  return Array.from(pet.statusImmunitySources.values()).filter(lock => !lock.active || lock.active());
}

function hasStatusImmunity(pet, status) {
  return activeStatusImmunities(pet).some(lock => lock.statuses.includes(status));
}

function hasStatDropImmunity(pet, stat) {
  return activeStatusImmunities(pet).some(lock =>
    lock.stats === true || (Array.isArray(lock.stats) && lock.stats.includes(stat))
  );
}

function tickStatusImmunities(pet) {
  for (const [source, lock] of pet.statusImmunitySources || []) {
    if (lock.turnsLeft === Infinity || lock.createdTurn === gameState.turnCount) continue;
    lock.turnsLeft--;
    if (lock.turnsLeft <= 0) revokeStatusImmunity(pet, source);
  }
}

function clearTurnEffects(pet) {
  pet.turnEffects = [];
  pet.statLockedThrough = -1;
  for (const skill of pet.skills) skill.jianghuaSealedTurns?.clear();
  if (pet.bloodlineData?.qingnianChannel) delete pet.bloodlineData.qingnianChannel;
  pet.powerDamageImmuneThroughTurn = -1;
  pet.qinglingInvertNext = false;
  pet.qinglingInvertThrough = -1;
  pet.ppCostEffects?.clear();
  pet.switchLockSources?.clear();
  pet.lightWindThroughTurn = -1;
  pet.lightWindDodgeTurn = -2;
  pet.futiThrough = -1;
  endCreation(pet);
  pet.dimoFrostRecoveryThrough = -1;
  for (const [source, lock] of pet.statusImmunitySources || []) {
    if (lock.turnsLeft !== Infinity) revokeStatusImmunity(pet, source);
  }
}

function cleanseAbnormalStatuses(pet) {
  pet.status = null;
  pet.statusTurns = 0;
  pet.confuseTurns = 0;
  pet.bindTurns = 0;
  pet.leechSeed = false;
  pet.poisoned = false;
}

function clearAbnormalStatus(pet, effect) {
  if (effect === "confuse") pet.confuseTurns = 0;
  else if (effect === "bind") pet.bindTurns = 0;
  else if (effect === "leech_seed") pet.leechSeed = false;
  else if (effect === "poison") pet.poisoned = false;
  else if (pet.status === effect) { pet.status = null; pet.statusTurns = 0; }
}

function wakeFromPowerHit(pet) {
  if (pet.status !== "sleep") return;
  pet.status = null;
  pet.statusTurns = 0;
  addMessage(pet.name + " 被威力技能击中后醒来！");
}

function tickUnableToAct(pet) {
  if (["sleep", "deep_sleep", "fear"].includes(pet.status)) {
    const status = pet.status;
    pet.statusTurns--;
    if (pet.statusTurns <= 0) {
      pet.status = null;
      pet.statusTurns = 0;
      addMessage(pet.name + " 解除了" + STATUS_LABELS[status] + "！");
    } else addMessage(pet.name + " 因" + STATUS_LABELS[status] + "无法行动！");
  } else if (pet.status === "freeze") {
    if (Math.random() < 0.2) {
      pet.status = null;
      pet.statusTurns = 0;
      addMessage(pet.name + " 解冻了！");
    } else addMessage(pet.name + " 被冰冻了，无法行动！");
  } else if (pet.status === "paralyze") {
    addMessage(pet.name + " 因麻痹无法行动！");
  }
}

function applyEffect(pet, effect, options = {}) {
  if (!Object.hasOwn(STATUS_MESSAGES, effect)) return false;
  if (hasStatusImmunity(pet, effect)) {
    addMessage(pet.name + "免疫了" + STATUS_LABELS[effect] + "！");
    return false;
  }
  // 页游互斥组：烧伤与控制同组，寄生与中毒同组，束缚独立。
  if (pet.status === effect || (effect === "confuse" && pet.confuseTurns > 0) ||
      (effect === "bind" && pet.bindTurns > 0) || (effect === "leech_seed" && pet.leechSeed) ||
      (effect === "poison" && pet.poisoned)) return true;
  const turns = options.turns ?? (
    effect === "sleep" || effect === "deep_sleep" ? 1 + Math.floor(Math.random() * 6) :
    effect === "fear" ? 1 + Math.floor(Math.random() * 2) :
    effect === "confuse" ? 2 + Math.floor(Math.random() * 3) :
    effect === "bind" ? 2 + Math.floor(Math.random() * 4) : 0
  );
  const version = (pet.abnormalSequence || 0) + 1;
  pet.abnormalSequence = version;
  if (effect === "bind") pet.bindTurns = turns;
  else if (effect === "leech_seed" || effect === "poison") {
    pet.leechSeed = effect === "leech_seed";
    pet.poisoned = effect === "poison";
  } else {
    pet.status = effect === "confuse" ? null : effect;
    pet.statusTurns = effect === "confuse" ? 0 : turns;
    pet.confuseTurns = effect === "confuse" ? turns : 0;
    if (effect === "deep_sleep") pet.deepSleepToken = version;
  }
  (pet.abnormalVersions ||= new Map()).set(effect, version);
  addMessage(options.message || pet.name + " " + STATUS_MESSAGES[effect] + "！");
  return true;
}



// ---------- HELPERS ----------
function $(sel) { return document.querySelector(sel); }
// 文本高亮：把关键词变成标签，数字加粗
function decorateMessage(text) {
  return escapeHtml(text)
    .replace(/命中要害/g, '<i class="tag crit">暴击</i>')
    .replace(/效果拔群/g, '<i class="tag super">克制</i>')
    .replace(/效果不佳/g, '<i class="tag weak">抵抗</i>')
    .replace(/没有效果/g, '<i class="tag immune">免疫</i>')
    .replace(/(\d+)\s*点伤害/g, '<b class="n">$1</b> 点伤害');
}

function isDeveloperBattle() { return gameState.battleMode === "developer"; }

function renderDeveloperBattleLog(list) {
  const messages = gameState.messages;
  if (list.logSource !== messages || list.logCount > messages.length) {
    list.innerHTML = "";
    list.logSource = messages;
    list.logCount = 0;
  }
  let out = "";
  const types = ["action", "damage", "heal", "status", "system", "turn"];
  for (let i = list.logCount; i < messages.length; i++) {
    const raw = messages[i];
    const text = typeof raw === "string" ? raw : raw.text;
    const logType = raw.type || classifyMessage(text);
    const type = types.includes(logType) ? logType : "system";
    const side = raw.side === "player" ? '<span class="msg-side player">我</span>' :
      raw.side === "ai" ? '<span class="msg-side ai">敌</span>' : '<span class="msg-side"></span>';
    out += '<div class="msg ' + type + '"><span class="developer-log-index" aria-hidden="true">' +
      (i + 1) + '</span>' + side + '<span class="msg-text">' + escapeHtml(text) + '</span></div>';
  }
  if (out) {
    list.insertAdjacentHTML("beforeend", out);
    list.logCount = messages.length;
  }
  const count = document.querySelector("#developer-log-count");
  if (count) count.textContent = "完整日志 · " + messages.length + " 条";
}

function renderBattleLog() {
  var msgs = document.querySelector("#battle-messages");
  if (!msgs) return;
  var jump = document.querySelector("#log-jump");
  var atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
  var prevTop = msgs.scrollTop;
  if (isDeveloperBattle()) {
    renderDeveloperBattleLog(msgs);
    msgs.scrollTop = atBottom ? msgs.scrollHeight : prevTop;
    if (jump) jump.hidden = atBottom;
    return;
  }
  var arr = gameState.messages.slice(-200);
  var filter = gameState.logFilter || "all";
  var collapsed = null;
  var out = "";
  arr.forEach(function(raw) {
    var m = typeof raw === "string" ? { text: raw, type: classifyMessage(raw), side: "system", turn: 0 } : raw;
    var type = m.type || "system", side = m.side || "system";
    if (filter === "action" && type === "system") return;
    if (filter === "system" && type !== "system" && type !== "turn") return;
    if (type === "turn") {
      collapsed = (gameState.logCollapsed && gameState.logCollapsed[m.turn]) ? m.turn : null;
      out += '<div class="msg turn' + (collapsed !== null ? " turn-collapsed" : "") + '" data-turn="' + m.turn + '"><span class="msg-text">' + escapeHtml(m.text) + '</span><span class="turn-caret">' + (collapsed !== null ? "▸" : "▾") + '</span></div>';
      return;
    }
    var hidden = collapsed !== null && m.turn === collapsed;
    var badge = side === "player" ? '<span class="msg-side player">我</span>' : side === "ai" ? '<span class="msg-side ai">敌</span>' : '<span class="msg-side"></span>';
    out += '<div class="msg ' + type + ' side-' + side + (hidden ? " collapsed" : "") + '">' + badge + '<span class="msg-text">' + decorateMessage(m.text) + '</span></div>';
  });
  if (!out) out = '<div class="msg system"><span class="msg-side"></span><span class="msg-text">暂无记录</span></div>';
  setMarkupIfChanged(msgs, out);
  if (atBottom) msgs.scrollTop = msgs.scrollHeight; else msgs.scrollTop = prevTop;
  if (jump) jump.hidden = atBottom;
  Array.prototype.forEach.call(document.querySelectorAll(".log-tab"), function(b) {
    b.classList.toggle("active", b.getAttribute("data-filter") === filter);
  });
}

function copyBattleLog() {
  var text = gameState.messages.map(function(m) { return typeof m === "string" ? m : m.text; }).join("\n");
  var btn = document.querySelector("#log-copy");
  var done = function() { if (!btn) return; var old = btn.textContent; btn.textContent = "已复制"; setTimeout(function() { btn.textContent = old; }, 1200); };
  var fallback = function() {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
  else fallback();
}

// ---------- 战斗日志消息 ----------
// 统一消息模型：{ text, type: action|damage|heal|status|system|turn, side: player|ai|system, turn }
function classifyMessage(text) {
  var s = String(text);
  if (/^━+/.test(s)) return "turn";
  if (/造成|伤害|固伤|反伤|攻击了自己/.test(s)) return "damage";
  if (/回复|治疗|护盾|吸收了/.test(s)) return "heal";
  if (/免疫|陷入|混乱|烧伤|冰冻|麻痹|中毒|睡眠|恐惧|束缚|寄生|强化|提升|降低|级/.test(s)) return "status";
  if (/天气|环境|回合|换宠|换上|先手|后手|倒下了|战斗开始|逃跑|解除/.test(s)) return "system";
  return "action";
}
let developerLogFramePending = false;
function addMessage(msg, type, side) {
  var text = String(msg);
  gameState.messages.push({
    text: text,
    type: type || classifyMessage(text),
    side: side || gameState.currentActingSide || "system",
    turn: gameState.turnCount || 0
  });
  if (isDeveloperBattle() && gameState.screen === "battle" && !developerLogFramePending) {
    developerLogFramePending = true;
    requestAnimationFrame(function() {
      developerLogFramePending = false;
      if (isDeveloperBattle() && gameState.screen === "battle") renderBattleLog();
    });
  }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var battleVisualTasks = [];
function clearBattleVisualTasks() { battleVisualTasks.slice().forEach(function(finish) { finish(); }); }
function battleVisualTask(node, duration, cleanup) {
  var done = false, timer, media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function finish() {
    if (done) return; done = true; clearTimeout(timer);
    if (media && media.removeEventListener) media.removeEventListener("change", changed);
    else if (media && media.removeListener) media.removeListener(changed);
    battleVisualTasks = battleVisualTasks.filter(function(task) { return task !== finish; }); cleanup();
  }
  function changed(e) { if (e.matches) finish(); }
  if (prefersReducedMotion() || node.isConnected === false) { finish(); return finish; }
  battleVisualTasks.push(finish);
  if (media && media.addEventListener) media.addEventListener("change", changed);
  else if (media && media.addListener) media.addListener(changed);
  timer = setTimeout(finish, duration);
  return finish;
}
function spawnFloatText(pet, text, type) {
  var spriteId = pet === gameState.playerActive ? "#player-sprite" : pet === gameState.aiActive ? "#ai-sprite" : null;
  if (!spriteId) return;
  var sprite = document.querySelector(spriteId);
  if (!sprite) return;
  syncBattleIdentity(spriteId === "#player-sprite" ? "player" : "ai", pet);
  if (prefersReducedMotion()) return;
  if (type === "dmg") {
    if (sprite.finishHit) sprite.finishHit();
    sprite.classList.remove("hit", "pet-enter"); void sprite.offsetWidth; sprite.classList.add("hit");
    var active = true;
    sprite.finishHit = function() { if (active) { active = false; sprite.classList.remove("hit"); } };
    var finishHit = sprite.finishHit;
    battleVisualTask(sprite, motionDuration("--motion-panel", 180), finishHit);
  }
  if (preferences.floatNumbers === "off") return;
  var colors = { dmg:"#ff4757", heal:"#2ed573", shield:"#4dc9f6" };
  var el = document.createElement("div");
  el.className = "float-text"; el.textContent = (type === "dmg" ? "-" : "+") + text;
  el.style.color = colors[type] || "#fff"; sprite.appendChild(el);
  battleVisualTask(el, motionDuration("--motion-float", 700), function() { el.remove(); });
}

// ---------- TURN SYSTEM V4: 先手值优先级 ----------
// 机制：默认先手值=8，先手+x = 8+x，后手-x = 8-x。双方选定技能后比较先手值，高者先动。

function setPPCostEffect(pet, source, turns, options) {
  if (!pet || turns <= 0) return;
  const effects = pet.ppCostEffects ||= new Map();
  effects.set(source, { ...options, throughTurn: gameState.turnCount + turns - 1 });
}

function getPPCostSourceLabel(source) {
  if (typeof source !== "string") return source?.skill;
  return source.startsWith("光幕三损:") ? "极影光幕·三损" : source;
}

function getRequiredPPCost(pet, skill, breakdown) {
  if (skill.noExtraPPCost) {
    if (breakdown) breakdown.noExtra = true;
    return 1;
  }
  const turn = gameState.turnCount + (gameState.resolvingTurn ? 0 : 1);
  let extra = skill.extraPPCost || 0;
  let multiplier = pet.skillPPCostMult || 1;
  if (breakdown && extra > 0) breakdown.extraSource = "技能自身";
  const opponent = pet === gameState.playerActive ? gameState.aiActive : gameState.playerActive;
  if (opponent?.lightWindThroughTurn >= turn) {
    const lightWind = getEffectiveSkillElement(pet, skill.element) === "flying" ? 1 : 2;
    if (breakdown && lightWind > extra) breakdown.extraSource = "轻风散魂";
    extra = Math.max(extra, lightWind);
  }
  for (const [source, effect] of pet.ppCostEffects || []) {
    if (effect.throughTurn < turn) {
      pet.ppCostEffects.delete(source);
      continue;
    }
    if (effect.skill && effect.skill !== skill) continue;
    const factor = effect.multiplier || 1;
    if (breakdown && factor > multiplier) breakdown.multiplierSource = getPPCostSourceLabel(source);
    multiplier = Math.max(multiplier, factor);
    const amount = effect.extraFor ? effect.extraFor(skill, getEffectiveSkillElement(pet, skill.element)) : effect.extra;
    if (breakdown && (amount || 0) > extra) breakdown.extraSource = getPPCostSourceLabel(source);
    extra = Math.max(extra, amount || 0);
  }
  if (breakdown) { breakdown.multiplier = multiplier; breakdown.extra = extra; }
  return Math.max(1, Math.round(multiplier + extra));
}

function describePPCost(breakdown, requested, paid) {
  const parts = ["应扣 " + requested + " PP"];
  if (breakdown.noExtra) parts.push("免疫额外 PP 消耗");
  if (breakdown.multiplier > 1) parts.push("基础消耗 ×" + breakdown.multiplier +
    (breakdown.multiplierSource ? "（" + breakdown.multiplierSource + "）" : ""));
  if (breakdown.extra > 0) parts.push("额外 +" + breakdown.extra + " PP" +
    (breakdown.extraSource ? "（" + breakdown.extraSource + "）" : ""));
  if (paid < requested) parts.push("剩余 PP 不足，实扣 " + paid + " PP");
  return parts.join("，");
}

function isSkillSealed(skill, turn) {
  return skill?.jianghuaSealedTurns?.has(turn) === true;
}

function canSelectSkill(skill) {
  return skill?.pp > 0 && !isSkillSealed(skill, gameState.turnCount + 1);
}

function reserveSkillAction(user, skill, turn = gameState.turnCount) {
  if (!skill) return null;
  if (skill.pp <= 0 || isSkillSealed(skill, turn)) {
    traceSkillPP(user, skill, skill.pp, skill.pp, "第" + turn + "回合选招失败", undefined, skill.pp <= 0 ? "PP 已空" : "技能被封禁");
    return null;
  }
  const ppBefore = skill.pp;
  const breakdown = isDeveloperBattle() ? {} : null;
  const requestedCost = getRequiredPPCost(user, skill, breakdown);
  const ppCost = Math.min(ppBefore, requestedCost);
  setSkillPP(user, skill, ppBefore - ppCost, "第" + turn + "回合选招扣费", undefined,
    breakdown ? describePPCost(breakdown, requestedCost, ppCost) : undefined);
  return { kind: "skill", user, skill, ppBefore, ppAfter: skill.pp, ppCost, requestedCost };
}

function canSubmitPlayerAction() {
  return gameState.isPlayerTurn && !gameState.battleOver && !gameState.resolvingTurn;
}

function playerUseSkill(skillIdx) {
  if (!canSubmitPlayerAction() || gameState.waitingForSwitch) return;
  const player = gameState.playerActive;
  if (!player || player.isFainted()) return;
  const action = reserveSkillAction(player, player.skills[skillIdx], gameState.turnCount + 1);
  if (action) submitPlayerAction(action);
}

function submitPlayerAction(action) {
  gameState.pendingPlayerAction = action;
  gameState.pendingPlayerSkill = null;
  gameState.isPlayerTurn = false;
  stopTurnTimer();
  document.querySelectorAll("#battle-actions button").forEach(button => { button.disabled = true; });
  aiDecideAndResolve();
}

function endTurnCleanup() {
  // 回合末的被动也已结算，场上和场下的限时威力伤害免疫统一到期。
  gameState.playerParty.concat(gameState.aiParty).forEach(function(pet) {
    if (pet.powerDamageImmuneThroughTurn === gameState.turnCount) pet.powerDamageImmuneThroughTurn = -1;
  });
  gameState.isPlayerTurn = !gameState.battleOver;
  updateBattleUI();
  if (!gameState.battleOver) renderBattleActions();
}

function aiDecideAndResolve() {
  if (gameState.battleOver || gameState.resolvingTurn) return;
  var ai = gameState.aiActive, player = gameState.playerActive;
  
  // 先选招，行动能力统一在本回合结算内判定，选招阶段不抽取麻痹随机数。
  // AI选技能（与旧版相同逻辑）
  var available = ai.skills.filter(canSelectSkill);
  if (available.length === 0) {
    addMessage(ai.name + (ai.skills.some(skill => skill.pp > 0) ? " 没有可用技能！" : " 所有技能PP耗尽！"));
    gameState.pendingAISkill = -1; // signal no skill
  } else {
    var bestSkill = available[0], bestScore = -Infinity;
    for (var i = 0; i < available.length; i++) {
      var sk = available[i], score = sk.power || 30;
      var eff = getEffectiveness(getEffectiveSkillElement(ai, sk.element), player.element); score *= eff;
      if (sk.effect && sk.effectChance > 30) score += 20;
      if (sk.onUse) score += 15;
      if (score > bestScore) { bestScore = score; bestSkill = sk; }
    }
    gameState.pendingAISkill = ai.skills.indexOf(bestSkill);
  }
  
  resolveTurn();
}

function resolveTurn() {
  if (gameState.battleOver || gameState.resolvingTurn) return;
  gameState.resolvingTurn = true;
  gameState.isPlayerTurn = false;
  try {
    resolveTurnActions();
  } finally {
    gameState.resolvingTurn = false;
    gameState.roundActions = null;
    gameState.roundStartPP = null;
    gameState.qinglingHealBatches = null;
    gameState.afterActions = null;
    gameState.pendingPlayerAction = null;
    gameState.pendingPlayerSkill = null;
    gameState.pendingAISkill = null;
  }
  endTurnCleanup();
}

function resolveTurnActions() {
  var player = gameState.playerActive, ai = gameState.aiActive;
  const selected = gameState.pendingPlayerAction;
  gameState.roundStartPP = new Map([[player, totalSkillPP(player) + (selected?.ppCost || 0)], [ai, totalSkillPP(ai)]]);
  gameState.turnCount++;
  for (const caster of gameState.jianghuaOwners || []) {
    if (caster.bloodlineData?.jianghuaThrough < gameState.turnCount) {
      syncMingnianMaxHP(caster);
      gameState.jianghuaOwners.delete(caster);
    }
  }
  // 在任何天气、异常或回合效果伤害前复位；场下宠物本回合也可能被换上。
  gameState.playerParty.concat(gameState.aiParty).forEach(function(pet) {
    pet.segmentIdx = 0; pet.lethalHitThisTurn = false; pet.lethalHandled = false;
    pet.immuneBackhand = false; pet.immuneBackhandEffects = false; pet.invincible = false;
  });
  [player, ai].forEach(function(pet) { pet.lastDealtDamage = pet.currentDealt || 0; pet.currentDealt = 0; });
  // 已经无法出招的一方空过；已支付的行动不依赖之后的剩余 PP。
  const playerCanAct = selected?.kind === "switch" || player.canAct();
  const aiCanAct = ai.canAct();
  const pAction = playerCanAct ? (selected || reserveSkillAction(player, player.skills[gameState.pendingPlayerSkill])) : null;
  const aAction = aiCanAct ? reserveSkillAction(ai, ai.skills[gameState.pendingAISkill]) : null;
  const pSkill = pAction?.skill;
  const aSkill = aAction?.skill;
  gameState.roundActions = new Map([[player, pAction], [ai, aAction]]);
  gameState.microLingAwarded = false;
  gameState.qinglingHealBatches = new Map();
  gameState.afterActions = [];

  if (!playerCanAct) tickUnableToAct(player);
  if (!aiCanAct) tickUnableToAct(ai);
  // 双方空过也走完整回合管线，持续效果和计时均正常推进。
  var pPrio = pAction?.kind === "switch" ? 8 : pSkill ? (pSkill.dimoFastThrough >= gameState.turnCount ? 12 : player.priorityOverride ?? pSkill.priority ?? 8) : 0;
  var aPrio = aSkill ? (aSkill.dimoFastThrough >= gameState.turnCount ? 12 : ai.priorityOverride ?? aSkill.priority ?? 8) : 0;
  // 迷雾天气：幽灵系技能先手值+1
  if (gameState.weather === "mist") {
    if (pSkill && getEffectiveSkillElement(player, pSkill.element) === "ghost") pPrio += 1;
    if (aSkill && getEffectiveSkillElement(ai, aSkill.element) === "ghost") aPrio += 1;
  }
  // 梦境环境：清翎覆尘出招速度反转为后手-7（先手+7→后手-7）
  if (gameState.field === "dream") {
    if (pSkill && pSkill.id === "sk_qy_1") pPrio = 1;
    if (aSkill && aSkill.id === "sk_qy_1") aPrio = 1;
  }
  if (pSkill) pPrio -= pSkill.qingnianPriorityLoss || 0;
  if (aSkill) aPrio -= aSkill.qingnianPriorityLoss || 0;
  if (pSkill) pAction.effectivePriority = pPrio;
  if (aSkill) aAction.effectivePriority = aPrio;
  
  processWeather();processField();
  var ti=document.querySelector("#turn-indicator"); if (ti) ti.style.display = "none";
  createBattleContext().savePPState();
  processBloodlines();
  processCreationRounds();
  applyEndOfTurnEffects(player); applyEndOfTurnEffects(ai);
  processTurnEffects(player); processTurnEffects(ai);
  resolveWanguHeals();
  
  addMessage("━━━ 第 " + gameState.turnCount + " 回合 ━━━");
  
  // 先手值比较；平手时速度高者先动。梦境环境下整体反转：先手值低者先动，同值速度慢者先动

  var pSpdEff = player.getStat("spd"), aSpdEff = ai.getStat("spd");
  var dreamActive = gameState.field === "dream";
  var playerFirst;
  if (!pAction) playerFirst = false;
  else if (!aAction) playerFirst = true;
  else playerFirst = dreamActive
    ? ((pPrio < aPrio) || (pPrio === aPrio && pSpdEff <= aSpdEff))
    : ((pPrio > aPrio) || (pPrio === aPrio && pSpdEff >= aSpdEff));
  gameState.pendingFirstMove = playerFirst ? "player" : "ai";
  
  const firstSide = gameState.pendingFirstMove;
  const secondSide = playerFirst ? "ai" : "player";
  const firstPet = playerFirst ? player : ai, secondPet = playerFirst ? ai : player;
  const firstAction = playerFirst ? pAction : aAction, secondAction = playerFirst ? aAction : pAction;
  const firstPrio = playerFirst ? pPrio : aPrio, secondPrio = playerFirst ? aPrio : pPrio;
  if (firstAction) {
    addMessage(firstPet.name + " 先手！（先手" + fmtPriority(firstPrio) + " vs " + fmtPriority(secondPrio) + (dreamActive ? "，梦境反转！" : "") + "）");
  } else {
    addMessage("双方本回合没有行动。");
  }
  const firstIncoming = runTurnAction(firstAction, secondPet, firstSide);
  // 主动换宠已完成时，后出手的对手以新上场宠物为目标。
  const secondIncoming = !player.isFainted() && !ai.isFainted()
    ? runTurnAction(secondAction, firstIncoming || firstPet, secondSide) : null;

  for (const afterAction of gameState.afterActions) afterAction();
  resolveDimoFirstAttack(firstPet);
  resolveJianghuaDeletions();
  resolveQinglingHealBatches();
  sampleQingnianEndOfRound();
  postDamageProcessing();
  updateBattleUI();
  checkFaints();
  if (!gameState.battleOver) tickEnvironments();
  for (const heal of gameState.wanguHeals) {
    if (heal.castTurn === gameState.turnCount) heal.amount = Math.abs(heal.owner.outputThisTurn - heal.opponent.outputThisTurn);
  }
  createBattleContext().saveSnapshot();
  const participants = new Set([player, ai]);
  if (firstIncoming) participants.add(firstIncoming);
  if (secondIncoming) participants.add(secondIncoming);
  participants.forEach(function(p) {
    p.lastTurnOutput = p.outputThisTurn || 0; p.outputThisTurn = 0;
    p.lastTakenSegments = p.damageTakenThisTurn.slice();
    p.lastTakenTotal = p.damageTakenThisTurn.reduce((sum, damage) => sum + damage, 0);
    p.damageTakenThisTurn = []; p.skillsUsedThisTurn = 0;
  });
}

function fmtPriority(p) {
  if (p > 8) return "+" + (p - 8);
  if (p < 8) return "-" + (8 - p);
  return "±0";
}

function resolveQinglingHealBatches() {
  const batches = gameState.qinglingHealBatches;
  gameState.qinglingHealBatches = null;
  for (const [target, segments] of batches) {
    if (target.isFainted()) continue;
    let highest = -1;
    if (target.qinglingInvertNext) {
      highest = segments.reduce((best, segment, index) =>
        best < 0 || segment.effective > segments[best].effective ? index : best, -1);
      target.qinglingInvertNext = false;
      target.qinglingInvertThrough = gameState.turnCount + 2;
    }
    segments.forEach((segment, index) => {
      if (target.isFainted()) return;
      const result = target.applyHealSegment(segment.effective, index === highest ? 1 : segment.inversion);
      if (result > 0) addMessage(target.name + " 回复了" + result + "HP");
    });
  }
}

function resolveWanguHeals() {
  const ctx = createBattleContext();
  gameState.wanguHeals = gameState.wanguHeals.filter(heal => {
    if (heal.castTurn >= gameState.turnCount) return true;
    const target = gameState[heal.targetSide];
    if (target && !target.isFainted() && heal.amount > 0) {
      ctx.doHeal(target, heal.amount);
      ctx.msg("万古遗恨：按施放回合双方输出差给予对方" + heal.amount + "点治疗。");
    }
    return false;
  });
}

function getRoundSkillSlot(pet, requireUse = false) {
  const action = gameState.roundActions?.get(pet);
  if (!action || action.kind !== "skill" || (requireUse && !action.used)) return -1;
  return pet.skills.indexOf(action.skill);
}

function recordRoundSkillUse(action, otherPet) {
  action.used = true;
  const { user, skill } = action;
  user.skillsUsedThisTurn = (user.skillsUsedThisTurn || 0) + 1;
  skill.useCount = (skill.useCount || 0) + 1;
  // 先手的历史回溯可能在后手已付费后写回 PP，实际使用时重新套用剩余次数上限。
  if (skill.useLimit && skill.pp > skill.useLimit - skill.useCount) {
    setSkillPP(user, skill, skill.pp, "校正剩余使用次数", skill.id);
  }
  user.skillUseCounts[skill.id] = (user.skillUseCounts[skill.id] || 0) + 1;
  if (user.oppConsecutive) {
    user.oppConsecutive = user.lastUsedSkillId === skill.id ? user.oppConsecutive : {};
    user.oppConsecutive[skill.id] = (user.oppConsecutive[skill.id] || 0) + 1;
  }
  user.lastUsedSkillId = skill.id;
  if (skill.power > 0) user.lastPowerSkillId = skill.id;
  if (gameState.microLingAwarded) return;
  const opponentAction = gameState.roundActions?.get(otherPet);
  if (!opponentAction?.used) return;
  const isStatus = action.skill.category === "status";
  if (isStatus !== (opponentAction.skill.category === "status")) return;
  const toAdd = Math.max(0, action.effectivePriority + opponentAction.effectivePriority);
  if (!Number.isFinite(toAdd) || toAdd === 0) return;
  gameState.microLingAwarded = true;
  const pets = [action.user, otherPet];
  const cap = 100 + 20 * pets.reduce((total, pet) => total + pet.skills.filter(skill => skill.pp === 0).length, 0);
  for (const pet of pets) {
    if (pet.bloodline?.name !== "清念灵体") continue;
    const bloodline = pet.bloodlineData ||= {};
    const prior = bloodline.microLingFromMatches || 0;
    const added = Math.min(toAdd, Math.max(0, cap - prior));
    if (!added) continue;
    bloodline.microLingFromMatches = prior + added;
    bloodline.microLing = (bloodline.microLing || 0) + added;
    addMessage("【清念灵体】双方同用" + (isStatus ? "变化" : "威力") + "技能，" + pet.name + " 获得" + added + "点微灵印记！");
  }
}

function runTurnAction(action, target, who) {
  if (!action) return null;
  gameState.currentActingSide = who;
  try {
    if (action.kind === "switch") {
      resolveDimoFirstAttack(target);
      return executeSwitchAction(action, who);
    }
    executeSkillTurn(action.user, target, action.skill, who, action);
    return null;
  } finally {
    gameState.currentActingSide = null;
  }
}

function executeSkillTurn(user, target, skill, who, action) {
  if (user.isFainted() || target.isFainted()) return;
  // 执行前复查在场与控制。选招时已经支付的 PP 不再复查或重扣。
  if (user !== gameState.playerActive && user !== gameState.aiActive) { addMessage(user.name + " 已离场，行动取消！"); return; }
  if (target !== gameState.playerActive && target !== gameState.aiActive) { addMessage(target.name + " 已不在场上，本次行动取消！"); return; }
  if (!user.canAct()) { addMessage(user.name + " 无法行动！"); return; }
  if (isSkillSealed(skill, gameState.turnCount)) { addMessage(user.name + " 的" + skill.name + "被封禁！"); return; }
  action = action || reserveSkillAction(user, skill);
  if (!action) { addMessage(user.name + " 的" + skill.name + "已无PP，行动取消！"); return; }
  const ppChange = "（PP " + action.ppBefore + "→" + action.ppAfter + (action.requestedCost > 1 ? " ×" + action.requestedCost : "") + "）";
  // 迷雾天气：主动行动结算前 80% 概率令自身混乱
  if (gameState.weather === "mist" && !hasStatusImmunity(user, "confuse") && Math.random() < 0.8) {
    applyEffect(user, "confuse", { turns: 1, message: "迷雾缭绕，" + user.name + " 在行动前陷入混乱！" });
  }
  var ctx = createBattleContext();
  ctx.sourceSkill = skill; ctx.sourceSkillOwner = user;
  ctx.skillPPCost = action.ppCost;
  ctx.skillPPAfter = action.ppAfter;
  ctx.wasInJianghua = user.bloodlineData?.jianghuaThrough >= gameState.turnCount;
  ctx.skillElement = getEffectiveSkillElement(user, skill.element);
  ctx.skillAction = { user, target, backhand: gameState.pendingFirstMove !== who };
  try {
    resolveSkillEffects(user, target, skill, who, action, ctx, ppChange);
    if (action.used) user.bloodline?.onActionEnd?.(user, target, ctx, skill);
  } finally {
    ctx.skillAction = null;
  }
}

function resolveSkillEffects(user, target, skill, who, action, ctx, ppChange) {
  const isPlayer = who === "player";
  const userIsBackhand = gameState.pendingFirstMove !== who;
  const priorNilex = user.pendingNilex;
  var lastEff = 1, lastDmgVal = 0;

  // 混乱判定
  if (user.confuseTurns > 0) {
    addMessage(user.name + " 处于混乱状态！");
    if (Math.random() < 0.5) {
      var selfDmg = Math.floor(((2 * user.level / 5 + 2) * 40 * (user.getStat("atk") / user.getStat("def"))) / 50 + 2);
      user.takeDamage(selfDmg);
      addMessage(user.name + " 攻击了自己，受到 " + selfDmg + " 点伤害！");
      user.confuseTurns--;
      addMessage(user.name + " 混乱自伤！" + ppChange);
      updateBattleUI(); checkFaints(); return;
    }
  }
  
  const dodged = resolveDimoFirstAttack(target, skill);
  if (user.isFainted()) { updateBattleUI(); checkFaints(); return; }
  recordRoundSkillUse(action, target);
  recordDimoSkillRound(user, skill);
  if (dodged) {
    applyQingnianSuppression(user, skill);
    updateBattleUI(); checkFaints();
    return;
  }

  const lightWindDodges = target.lightWindDodgeTurn === gameState.turnCount - 1 ||
    (target.lightWindDodgeTurn === gameState.turnCount && userIsBackhand);
  if (lightWindDodges && !skill.semiSure && skill.accuracy < 100) {
    applyQingnianSuppression(user, skill);
    addMessage(target.name + " 闪避了" + user.name + " 的非必中技能！");
    return;
  }
  // 命中判定：半必中（semiSure）仅在对方"必定闪避"时 miss，其余必中
  const guaranteedFirst = skill.sureFirst && gameState.pendingFirstMove === who;
  if (skill.semiSure) {
    if (target.sureDodge && !guaranteedFirst) {
      applyQingnianSuppression(user, skill);
      addMessage(target.name + " 必定闪避了 " + user.name + " 的 " + skill.name + "！" + ppChange);
      if (skill.onMiss) skill.onMiss(user, target, ctx);
      return;
    }
  } else if (skill.accuracy < 100 && Math.random() * 100 > skill.accuracy) {
    applyQingnianSuppression(user, skill);
    addMessage(user.name + " 的 " + skill.name + " 没有命中！" + ppChange);
    return;
  }
  // 化念作刃先手闪避：target 有标志、本技能非必中、user 为后手 → 闪避
  if (!skill.semiSure && target.dodgeNextNonSure && skill.accuracy < 100 && userIsBackhand) {
    applyQingnianSuppression(user, skill);
    addMessage(target.name + " 闪避了后手非必中技能！视物攻+2！" + ppChange);
    target.atkStage = Math.min(6, target.atkStage + 2);
    target.dodgeNextNonSure = false;
    updateBattleUI(); checkFaints(); return;
  }
  // 闪避失败：target 有标志、本技能必中、user 为后手 → 倒置双方强化+删对方2PP
  if (!skill.semiSure && target.dodgeNextNonSure && skill.accuracy >= 100 && userIsBackhand) {
    target.dodgeNextNonSure = false;
    [user, target].forEach(function(p){
      STAGE_FIELDS.forEach(function(k){ if (p[k] !== 0) p[k] = -p[k]; });
    });
    ctx.deletePP(user, -1, 2);
    addMessage("闪避失败！倒置双方强化，删除对方全体2PP！");
  }
  
  addMessage(user.name + " 使用了 " + skill.name + ppChange + "！");
  applyQingnianSuppression(user, skill);

  // 瞬华环境：先手出招回100精力
  var userIsFirstMove = (gameState.pendingFirstMove === (isPlayer ? "player" : "ai"));
  if (gameState.field === "shunhua" && userIsFirstMove) {
    ctx.doHeal(user, 100);
    ctx.msg("【瞬华环境】先手出招回复100精力！");
  }
  if (skill.onUse) {
    skill.onUse(user, target, ctx);
  } else if (skill.category === "status") {
    applyLegacyStatusSkill(user, target, skill, ctx);
  } else {
    const result = ctx.doDamage(user, target, skill.power, skill.category, skill.element);
    lastEff = result.effectiveness; lastDmgVal = result.damage;
    addMessage("造成 " + result.damage + " 点伤害！" + getEffLabel(result.effectiveness) + (result.isCrit ? " 命中要害！" : ""));
    if (skill.effect && skill.effectChance > 0 && Math.random() * 100 < skill.effectChance) {
      var eff = getEffectiveness(getEffectiveSkillElement(user, skill.element), target.element);
      if (eff > 0) ctx.applyStatus(target, skill.effect);
    }
  }
  
  if (priorNilex && skill.category !== "status" && skill.power > 0) resolveNilexFollowup(user, target, ctx, priorNilex);

  // 迷雾天气：主动行动结算后 80% 概率令对手混乱
  if (gameState.weather === "mist" && !target.isFainted() && !hasStatusImmunity(target, "confuse") && Math.random() < 0.8) {
    applyEffect(target, "confuse", { turns: 1, message: "迷雾缭绕，" + target.name + " 在行动后陷入混乱！" });
  }
  // 瞬华环境：技能伤害被抵抗则追加原伤害30%固伤
  var resistEff = (ctx && ctx._lastEff !== undefined) ? ctx._lastEff : lastEff;
  var resistDmg = (ctx && ctx._lastDmg !== undefined) ? ctx._lastDmg : lastDmgVal;
  if (gameState.field === "shunhua" && skill.category !== "status" && resistEff < 1 && resistEff > 0 && resistDmg > 0) {
    var reflect = Math.floor(resistDmg * 0.3);
    ctx.doFixedDamage(target, reflect, user, { scaled: true });
    ctx.msg("【瞬华环境】伤害被抵抗，追加" + reflect + "固伤！");
  }
  // 血脉技能后钩子（清念翼系触发/PP回复/切换期）
  if (user.bloodline && user.bloodline.onSkillUse) {
    user.bloodline.onSkillUse(user, target, ctx, skill);
  }

  updateBattleUI();
  checkFaints();
}

function applyLegacyStatusSkill(user, target, skill, ctx = createBattleContext()) {
  var name = skill.name;
  if (name === "祈雨") ctx.modifyStat(user, "spatk", 2);
  else if (name === "水流环") { user.heal(Math.floor(user.maxHp / 4)); addMessage(user.name + " 回复了HP！"); }
  else if (name === "光合作用") { user.heal(Math.floor(user.maxHp / 2)); addMessage(user.name + " 回复了大量HP！"); }
  else if (name === "龙之舞") { ctx.modifyStat(user, "atk", 1); ctx.modifyStat(user, "spd", 1); }
  else if (name === "极光幕") { ctx.modifyStat(user, "def", 1); ctx.modifyStat(user, "spdef", 1); }
  else if (name === "烟雾") {
    ctx.modifyStat(target, "accuracy", -1);
  }
  else if (name === "冰冻之风") {
    ctx.modifyStat(target, "spd", -1);
    var res = ctx.doDamage(user, target, 55, "special", skill.element); addMessage("造成 " + res.damage + " 点伤害！"); }
  else if (name === "寄生种子") { if (Math.random() * 100 < 90) ctx.applyStatus(target, "leech_seed"); }
  else if (skill.effect && skill.effectChance > 0 && Math.random() * 100 < skill.effectChance) ctx.applyStatus(target, skill.effect);
}

// ---------- SWITCH ----------
function applyEndOfTurnEffects(pet) {
  if (!pet || pet.isFainted()) return;
  for (const [affected, status, divisor] of [[pet.status === "burn", "烧伤", 16], [pet.poisoned, "中毒", 8]]) {
    if (!affected || pet.isFainted()) continue;
    const damage = Math.floor(pet.maxHp / divisor);
    createBattleContext().doFixedDamage(pet, damage);
    addMessage(pet.name + " 因" + status + "受到 " + damage + " 点伤害！");
  }
  if (pet.bindTurns > 0) { pet.bindTurns--; if (pet.bindTurns <= 0) addMessage(pet.name + " 解除了束缚！"); }
  if (pet.leechSeed) { var drain = Math.floor(pet.maxHp / 8); pet.takeDamage(drain); var opp = pet === gameState.playerActive ? gameState.aiActive : gameState.playerActive; if (opp && !opp.isFainted()) opp.heal(drain); addMessage(pet.name + " 被寄生种子吸取了 " + drain + " HP！"); }
}

function clearGrantedDefenses(pet) {
  pet.shield = 0;
  pet.damageReduction = 0;
  pet.damageReductionTurns = 0;
  pet.damageCap = Infinity;
  pet.damageCapTurns = 0;
  pet.damageCapThreshold = 0;
  pet.reflectBackhand = false;
}

function leaveBattlefield(pet) {
  trackQingnianSwitch(pet, true);
  gameState.pendingJianghuaByPet?.delete(pet);
  if (pet.bloodline?.name === "明念") endMingnian(pet);
  for (const active of [gameState.playerActive, gameState.aiActive]) {
    if (active?.bloodlineData?.markTarget === pet) endMingnian(active);
  }
  pet.qlSealMark = false;
  pet.turnEffects = pet.turnEffects.filter(effect => effect.name !== "微灵封体印");
}

function callBloodlineEnter(pet) {
  if (!pet) return;
  if (gameState.banEffects) clearGrantedDefenses(pet);
  if (pet.bloodline?.onEnter) pet.bloodline.onEnter(pet, createBattleContext());
  trackQingnianSwitch(pet, false);
}

function hasSwitchLock(pet) {
  if (pet.switchLocked) return true;
  if (pet.deepSleepLock) {
    const { target, token } = pet.deepSleepLock;
    if (!target.isFainted() && target.status === "deep_sleep" && target.deepSleepToken === token) return true;
    delete pet.deepSleepLock;
  }
  const turn = gameState.turnCount + (gameState.resolvingTurn ? 0 : 1);
  for (const [name, throughTurn] of pet.switchLockSources || []) {
    if (throughTurn >= turn) return true;
    pet.switchLockSources.delete(name);
  }
  return false;
}

function canSwitchPet(user) {
  if (user.bindTurns > 0) { addMessage(user.name + " 被束缚了，无法换宠！"); return false; }
  if (hasSwitchLock(user)) { addMessage(user.name + " 无法换宠！"); return false; }
  return true;
}

function playerSwitch(petIdx) {
  if (!canSubmitPlayerAction()) return;
  const user = gameState.playerActive, incoming = gameState.playerParty[petIdx];
  if (!user || user.isFainted() || !incoming || incoming === user || incoming.isFainted() || !canSwitchPet(user)) return;
  gameState.waitingForSwitch = false;
  const panel = document.querySelector("#switch-panel");
  if (panel?.closeLayer) panel.closeLayer(true);
  else if (panel) panel.classList.remove("show");
  submitPlayerAction({ kind: "switch", user, incoming });
}

function executeSwitchAction(action, who) {
  const { user, incoming } = action;
  const activeKey = who === "player" ? "playerActive" : "aiActive";
  if (gameState[activeKey] !== user || user.isFainted() || incoming.isFainted() || !canSwitchPet(user)) return null;
  addMessage(who === "player" ? "回来吧，" + user.name + "！" : "对手收回了 " + user.name + "！");
  leaveBattlefield(user);
  gameState[activeKey] = incoming;
  incoming.lastDealtDamage = incoming.currentDealt || 0; incoming.currentDealt = 0;
  callBloodlineEnter(incoming);
  addMessage(who === "player" ? "上吧，" + incoming.name + "！" : "对手换上了 " + incoming.name + "！");
  updateBattleUI();
  return incoming;
}

function checkFaints() {
  // R06：先处理不灭魂体等致死保护，再判定濒死/胜负
  postDamageProcessing();
  if (gameState.battleOver) return false;
  var player = gameState.playerActive, ai = gameState.aiActive;
  if (player && player.isFainted()) { leaveBattlefield(player); addMessage(player.name + " 倒下了！"); var np = gameState.playerParty.find(function(p) { return !p.isFainted() && p !== player; }); if (np) { gameState.playerActive = np; callBloodlineEnter(np); addMessage("上吧，" + np.name + "！"); renderBattle(document.querySelector("#app")); } else { endBattle(false); return true; } }
  if (ai && ai.isFainted()) { leaveBattlefield(ai); addMessage(ai.name + " 倒下了！"); var na = gameState.aiParty.find(function(p) { return !p.isFainted() && p !== ai; }); if (na) { gameState.aiActive = na; callBloodlineEnter(na); addMessage("对手派出了 " + na.name + "！"); renderBattle(document.querySelector("#app")); } else { endBattle(true); return true; } }
  return false;
}

function endBattle(playerWin, fled = false) {
  closeBloodlinePreview();
  gameState.battleOver = true;
  stopTurnTimer();
  if (isDeveloperBattle()) {
    addMessage(fled ? "我方逃跑，测试结束。" : playerWin ? "战斗结束，我方胜利。" : "战斗结束，对方胜利。", "system");
    renderBattleLog();
    const leave = document.querySelector("#flee-btn");
    if (leave) { leave.textContent = "返回主菜单"; leave.title = "返回主菜单"; }
  }
  document.querySelector("#result-overlay").classList.add("show");
  document.querySelector("#result-emoji").textContent = fled ? "" : playerWin ? "\u{1F3C6}" : "\u{1F494}";
  const result = document.querySelector("#result-text");
  result.textContent = fled ? "测试结束" : playerWin ? "你赢了！" : "你输了...";
  result.className = "result-text " + (fled ? "" : playerWin ? "win" : "lose");
  const actions = document.querySelector("#battle-actions");
  if (actions) actions.innerHTML = "";
}

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

var battleVisual = { battleId: null, player: null, ai: null, skillScroll: 0 };
function resetBattleVisual() { closeBloodlinePreview(); clearBattleVisualTasks(); battleVisual = { battleId: null, player: null, ai: null, skillScroll: 0 }; }
function hpPercent(pet) { return Math.max(0, Math.min(100, (pet.hp / pet.maxHp) * 100)); }
function setMarkupIfChanged(el, html) { if (el && el.visualMarkup !== html) { el.innerHTML = html; el.visualMarkup = html; } }
function enterBattleSprite(sprite) {
  if (sprite.finishEnter) sprite.finishEnter();
  if (prefersReducedMotion()) return;
  sprite.classList.remove("pet-enter"); void sprite.offsetWidth; sprite.classList.add("pet-enter");
  sprite.finishEnter = battleVisualTask(sprite, motionDuration("--motion-panel", 180), function() { sprite.classList.remove("pet-enter"); sprite.finishEnter = null; });
}
function syncBattleIdentity(side, pet) {
  var sprite = document.querySelector("#" + side + "-sprite"), info = document.querySelector("#" + side + "-info");
  if (!sprite) return;
  if (info) syncBattleBloodline(info.querySelector(".battle-bloodline-slot"), pet);
  if (sprite.visualPet === pet) return;
  var changed = sprite.visualPet !== undefined;
  if (sprite.finishHit) sprite.finishHit();
  if (sprite.finishEnter) sprite.finishEnter();
  sprite.classList.remove("hit", "pet-enter"); sprite.textContent = pet.emoji;
  sprite.visualPet = pet;
  var el = ELEMENTS[pet.element], name = info && info.querySelector(".pet-info-name");
  var level = info && info.querySelector(".pet-info-lv"), element = info && info.querySelector(".pet-info-element");
  if (name) name.textContent = pet.name;
  if (level) level.textContent = "Lv." + pet.level;
  if (info && el) info.style.borderLeft = "3px solid " + el.color;
  if (element && el) { element.style.background = el.bg; element.style.color = el.color; element.innerHTML = elemIcon(pet.element) + el.name; }
  if (changed) enterBattleSprite(sprite);
}
function updateBattleSide(side, pet) {
  var bar = document.querySelector("#" + side + "-hp-bar");
  if (!pet || !bar) return;
  syncBattleIdentity(side, pet);
  var ghost = bar.parentNode.querySelector(".hp-bar-ghost"), text = document.querySelector("#" + side + "-hp-text");
  var shield = document.querySelector("#" + side + "-shield"), marks = document.querySelector("#" + side + "-marks"), status = document.querySelector("#" + side + "-status");
  var pct = hpPercent(pet), previous = battleVisual[side], fresh = !previous || previous.pet !== pet;
  if (!ghost) { ghost = document.createElement("div"); ghost.className = "hp-bar-ghost"; ghost.style.width = pct + "%"; bar.parentNode.insertBefore(ghost, bar); }
  if (fresh) { bar.style.transition = "none"; ghost.style.transition = "none"; bar.style.width = pct + "%"; ghost.style.width = pct + "%"; void bar.offsetWidth; bar.style.transition = ""; ghost.style.transition = ""; }
  else if (pct !== previous.hp) {
    if (pct > previous.hp || prefersReducedMotion()) { ghost.style.transition = "none"; ghost.style.width = pct + "%"; void ghost.offsetWidth; ghost.style.transition = ""; }
    else ghost.style.width = pct + "%";
    bar.style.width = pct + "%";
  }
  bar.className = "hp-bar-inner" + (pct < 25 ? " critical" : pct < 50 ? " low" : "");
  if (text) text.textContent = pet.hp + "/" + pet.maxHp;
  if (shield) {
    var shieldPct = Math.min(100, pet.shield / pet.maxHp * 100);
    var fill = shield.querySelector(".shield-bar-inner");
    if (pet.shield > 0) {
      if (shield.finishShield) { shield.finishShield(); shield.finishShield = null; fill = shield.querySelector(".shield-bar-inner"); }
      if (!fill) { shield.innerHTML = '<div class="shield-bar-outer"><div class="shield-bar-inner"></div></div><div class="shield-value"></div>'; fill = shield.querySelector(".shield-bar-inner"); if (fill) fill.style.width = Math.min(100, pet.shield / pet.maxHp * 100) + "%"; }
      else if (fresh) { fill.style.transition = "none"; fill.style.width = shieldPct + "%"; void fill.offsetWidth; fill.style.transition = ""; }
      else if (previous.shieldPct !== shieldPct) fill.style.width = shieldPct + "%";
      var value = shield.querySelector(".shield-value"); if (value) value.textContent = "🛡️" + pet.shield;
    } else if (fill && fresh) { shield.innerHTML = ""; }
    else if (fill && previous && previous.shield > 0) {
      fill.style.width = "0%";
      var shieldValue = shield.querySelector(".shield-value"); if (shieldValue) shieldValue.textContent = "";
      shield.finishShield = battleVisualTask(shield, motionDuration("--motion-hp", 280), function() { shield.innerHTML = ""; shield.finishShield = null; });
    }
  }
  if (marks) marks.textContent = Object.keys(pet.marks).length > 0 ? Object.entries(pet.marks).map(function(e) { return e[0] + ":" + e[1]; }).join(" ") : "";
  setMarkupIfChanged(status, renderStatusBadges(pet));
  battleVisual[side] = { pet: pet, hp: pct, shield: pet.shield, shieldPct: Math.min(100, pet.shield / pet.maxHp * 100) };
}
function updateBattleUI() {
  var p = gameState.playerActive, a = gameState.aiActive;
  if (battleVisual.battleId !== gameState.battleId) { resetBattleVisual(); battleVisual.battleId = gameState.battleId; }
  updateBattleSide("player", p); updateBattleSide("ai", a);
  var msgs = document.querySelector("#battle-messages");
  if (msgs) renderBattleLog();
  // 天气/环境显示
  var wEl = document.querySelector("#battle-weather");
  if (wEl) {
    var wParts = [];
    if (gameState.weather) {
      var wInfo = WEATHER_DISPLAY[gameState.weather];
      if (wInfo) wParts.push('<span class="w-item has-weather"><span class="w-icon" aria-hidden="true">' + wInfo[0] + '</span><span>' + wInfo[1] + '</span><span class="w-turns">' + (gameState.weatherTurns || 0) + '\u56de\u5408</span></span>');
    }
    if (gameState.field) {
      var fInfo = {"dream":["\u{1F319}","\u68a6\u5883"],"shunhua":["\u2728","\u77ac\u534e"]}[gameState.field] || null;
      if (!fInfo) fInfo = ["\u2753", "\u672a\u77e5\u73af\u5883"];
      wParts.push('<span class="w-item has-field"><span class="w-icon" aria-hidden="true">' + fInfo[0] + '</span><span>' + fInfo[1] + '</span><span class="w-turns">' + (gameState.fieldTurns || 0) + '\u56de\u5408</span></span>');
    }
    wEl.hidden = wParts.length === 0;
    setMarkupIfChanged(wEl, wParts.join(""));
  }
  var pSt = document.querySelector("#player-stages"); if (pSt && p) pSt.innerHTML = renderStages(p);
  var aSt = document.querySelector("#ai-stages"); if (aSt && a) aSt.innerHTML = renderStages(a);
}

function renderStages(pet) {
  if (!pet) return "";
  var h = '<div class="stage-grid">';
  Object.entries(STAGE_LABELS).forEach(function([stat, label]) {
    var v = pet[stat + "Stage"] || 0;
    h += '<span class="stage-pill' + (v > 0 ? " up" : v < 0 ? " down" : "") + '">' + label + (v > 0 ? "+" + v : v < 0 ? v : "\u00b10") + "</span>";
  });
  return h + "</div>";
}

function renderAbnormalBadges(pet) {
  var h = "";
  if (pet.status) {
    var label = STATUS_LABELS[pet.status] || pet.status;
    // 有时限状态：显示剩余回合
    if (["sleep", "deep_sleep", "fear"].includes(pet.status) && pet.statusTurns > 0) label += " " + pet.statusTurns + "回合";
    if (pet.status === "freeze") label += "（待解冻）";
    h += '<span class="status-badge ' + pet.status + '">' + label + "</span>";
  }
  if (pet.confuseTurns > 0) h += '<span class="status-badge confuse">混乱 ' + pet.confuseTurns + "回合</span>";
  if (pet.bindTurns > 0) h += '<span class="status-badge bind">束缚 ' + pet.bindTurns + "回合</span>";
  if (pet.leechSeed) h += '<span class="status-badge poison">寄生</span>';
  if (pet.poisoned) h += '<span class="status-badge poison">中毒</span>';
  return h;
}

function renderStatusBadges(pet) {
  let h = renderAbnormalBadges(pet);
  const immunityBadges = new Map();
  for (const { source, statuses, turnsLeft } of activeStatusImmunities(pet)) {
    const key = statuses.slice().sort().join(",");
    const badge = immunityBadges.get(key);
    if (badge) {
      badge.sources.push(source);
      badge.turnsLeft = Math.max(badge.turnsLeft, turnsLeft);
    } else {
      immunityBadges.set(key, { sources: [source], statuses, turnsLeft });
    }
  }
  for (const { sources, statuses, turnsLeft } of immunityBadges.values()) {
    const label = ABNORMAL_WITHOUT_BIND.every(status => statuses.includes(status)) ? "免疫异常"
      : statuses.length === 6 ? "免疫控制"
      : "免疫" + STATUS_LABELS[statuses[0]] + "等";
    const tooltip = uiAttr(sources.join("、") + " · " + statuses.map(status => STATUS_LABELS[status]).join("、"));
    h += '<span class="status-badge immune" title="' + tooltip + '">' + label +
      (turnsLeft === Infinity ? "" : " " + turnsLeft + "回合") + "</span>";
  }
  return h;
}

// ---------- SCREENS ----------
var uiPageVersion = 0;
function prefersReducedMotion() {
  return preferences.motion === "reduce" || matchesSystemPreference("(prefers-reduced-motion: reduce)");
}
function motionDuration(name, fallback) {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return fallback;
  var value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  var number = parseFloat(value);
  return isFinite(number) && /^(?:\d*\.)?\d+\s*(ms|s)$/.test(value) ? number * (/ms$/.test(value) ? 1 : 1000) : fallback;
}
// 仅负责视觉清理，不承载游戏时序。
function finishVisualTransition(el, property, duration, done) {
  var finished = false, timer, media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function finish() {
    if (finished) return; finished = true;
    clearTimeout(timer); el.removeEventListener("transitionend", onEnd);
    if (media && media.removeEventListener) media.removeEventListener("change", onChange);
    else if (media && media.removeListener) media.removeListener(onChange);
    done();
  }
  function onEnd(e) { if (e.target === el && e.propertyName === property) finish(); }
  function onChange(e) { if (e.matches) finish(); }
  if (prefersReducedMotion() || el.isConnected === false) { finish(); return finish; }
  el.addEventListener("transitionend", onEnd);
  if (media && media.addEventListener) media.addEventListener("change", onChange);
  else if (media && media.addListener) media.addListener(onChange);
  timer = setTimeout(finish, duration + 50);
  return finish;
}
// 关闭时先固定正在入场的当前画面，再切换至退出样式。
function freezeLayerEntrance(el) {
  var nodes = [el], modal = el.querySelector(".modal"), saved = [];
  if (modal) nodes.push(modal);
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return function() {};
  nodes.forEach(function(node) {
    var style = node.style;
    if (!style || !style.setProperty || !style.removeProperty || !style.getPropertyValue) return;
    var computed = window.getComputedStyle(node), props = ["opacity", "transform", "animation"];
    var original = props.map(function(prop) { return { name: prop, value: style.getPropertyValue(prop), priority: style.getPropertyPriority(prop) }; });
    var opacity = computed.opacity, transform = computed.transform;
    style.setProperty("opacity", opacity); style.setProperty("transform", transform); style.setProperty("animation", "none");
    saved.push({ node: node, original: original });
  });
  if (saved.length) void el.offsetWidth;
  return function(release) {
    saved.forEach(function(entry) {
      entry.original.forEach(function(prop) {
        if (release && prop.name === "animation") return;
        if (prop.value) entry.node.style.setProperty(prop.name, prop.value, prop.priority);
        else entry.node.style.removeProperty(prop.name);
      });
    });
  };
}
// 捕获具体节点；force 用于重开和页面销毁，避免旧回调影响新弹层。
function prepareLayer(el, onClosed) {
  var state = "open", finish = null, forced = false, restoreStyles = function() {};
  function complete(restoreFocus) { state = "closed"; onClosed(restoreFocus); restoreStyles(false); }
  el.closeLayer = function(force) {
    if (state === "closed") return;
    if (force === true) {
      forced = true;
      if (finish) { finish(); return; }
      complete(false); return;
    }
    if (state !== "open") return;
    state = "closing";
    if (!prefersReducedMotion() && el.isConnected !== false) restoreStyles = freezeLayerEntrance(el);
    el.classList.add("closing"); restoreStyles(true);
    finish = finishVisualTransition(el, "opacity", motionDuration("--motion-state", 140), function() { complete(!forced); });
  };
  el.layerIsOpen = function() { return state === "open"; };
}
function removeBodyLayer(id) {
  var el = document.getElementById(id);
  if (el) { if (el.closeLayer) el.closeLayer(true); else el.remove(); }
}
function focusScreen(app) {
  var battle = app.querySelector("#btn-battle");
  var target = app.querySelector(".screen-title") || (battle && !battle.disabled && battle) || app.querySelector("button");
  if (target && target.focus) { if (target.classList.contains("screen-title")) target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
}
function showScreen(id) {
  var previous = gameState.screen, changed = previous !== id, app = document.querySelector("#app");
  if (changed) {
    uiPageVersion++;

    var intro = document.getElementById("intro-screen");
    if (intro && !(previous === "intro" && id === "menu" && intro.dataset.leaving)) {
      if (intro.finishIntro) intro.finishIntro(); else intro.remove();
    }
  }
  ["skill-detail-overlay", "modal-overlay", "flee-overlay", "skill-limit-overlay"].forEach(removeBodyLayer);
  ["switch-panel", "result-overlay"].forEach(function(key) { var layer = document.getElementById(key); if (layer && layer.closeLayer) layer.closeLayer(true); });
  if (previous === "battle" && id !== "battle") resetBattleVisual();
  gameState.screen = id; app.innerHTML = "";
  switch(id) { case "intro": renderIntro(app); break; case "menu": renderMenu(app); break; case "team": renderTeamSelect(app); break; case "battle": renderBattle(app); break; case "pets": renderPetManagement(app); break; case "opponent": renderOpponentSelect(app); break; case "skillswap": renderSkillSwap(app); break; case "settings": renderSettings(app); break; }
  if (changed && id !== "intro" && previous !== "intro") {
    var screen = app.querySelector(".screen"); if (screen && !prefersReducedMotion()) screen.classList.add("page-enter");
    focusScreen(app);
  }
}

// 主菜单与启动页共用同一枚标志，suffix 用于避免 SVG 渐变 id 冲突
function logoMarkSvg(suffix) {
  suffix = suffix || "";
  var A = "rocoGoldA" + suffix, B = "rocoGoldB" + suffix;
  return '<svg class="roco-mark" viewBox="0 0 170 110" aria-label="ROCO REMAKE"><defs>' +
    '<linearGradient id="' + A + '" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="#ffe9a8"/><stop offset="50%" stop-color="#e2b04a"/><stop offset="100%" stop-color="#b8841a"/></linearGradient>' +
    '<linearGradient id="' + B + '" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="#d9b45c"/><stop offset="50%" stop-color="#a8801f"/><stop offset="100%" stop-color="#6d5210"/></linearGradient>' +
    '</defs><g class="r-back" transform="translate(52,20) rotate(-13 38 42)"><path d="M22,14 V86 M22,14 H54 A20,20 0 0 1 54,54 H22 M48,54 L76,86" stroke="url(#' + B + ')" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +
    '<g class="r-front" transform="translate(24,0) rotate(11 38 42)"><path d="M22,14 V86 M22,14 H54 A20,20 0 0 1 54,54 H22 M48,54 L76,86" stroke="url(#' + A + ')" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
}

// 启动页：logo 居中，点击后交叉淡出进入主菜单
function renderIntro(app) {
  var old = document.getElementById("intro-screen");
  if (old) old.remove();
  var el = document.createElement("div");
  el.id = "intro-screen";
  el.className = "intro-screen";
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", "点击进入 ROCO REMAKE");
  el.innerHTML = '<div class="intro-logo menu-logo">' + logoMarkSvg("Intro") + '</div><div class="intro-rule"></div><div class="intro-hint">点击进入</div>';
  document.body.appendChild(el);
  var go = function() {
    if (el.dataset.leaving) return;
    el.dataset.leaving = "1";
    el.classList.add("leaving");
    showScreen("menu");
    var version = uiPageVersion;
    el.finishIntro = finishVisualTransition(el, "opacity", motionDuration("--motion-intro", 360), function() {
      el.remove();
      if (uiPageVersion === version && gameState.screen === "menu") focusScreen(app);
    });
  };
  el.addEventListener("click", go);
  el.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
  });
  el.focus({ preventScroll: true });
}

function uiAttr(value) { return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function uiIcon(name) {
  var paths = {
    battle: '<path d="m5 3 6 6-2 2-6-6V3h2Zm14 0-6 6 2 2 6-6V3h-2ZM4 20l5-5m6 0 5 5M2 17l5 5m10 0 5-5M9 11l4 4m2-4-4 4"/>',
    skills: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
    pets: '<path d="M4 4h6v16H4zm10 0h6v16h-6M7 8v3m10 2v3"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + '</svg>';
}
function pageHeader(title, backId, actions) {
  return '<div class="screen-header"><button class="back-btn" id="' + backId + '" aria-label="返回上一页">←</button><span class="screen-title">' + title + '</span>' + (actions || '') + '</div>';
}
function petChoiceCard(pet, attr, selected) {
  var el = ELEMENTS[pet.element] || { name: "?", color: "#888" };
  return '<button type="button" class="pet-card' + (selected ? ' selected' : '') + '" ' + attr + '="' + uiAttr(pet.id) + '"' +
    (selected !== undefined ? ' aria-pressed="' + !!selected + '"' : '') + '><span class="pet-card-check" aria-hidden="true">✓</span><span class="pet-card-emoji" aria-hidden="true">' + escapeHtml(pet.emoji) + '</span><span class="pet-card-name">' + escapeHtml(pet.name) + '</span><span class="pet-card-element" style="color:' + el.color + '">' + elemIcon(pet.element) + el.name + '系</span></button>';
}
var menuMode = "solo";
function renderMenu(app) {
  app.innerHTML = '<div class="menu-screen-bg" aria-hidden="true"><div class="aurora-band b1"></div><div class="aurora-band b2"></div><div class="aurora-band b3"></div></div>' +
    '<main class="screen active menu-shell">' +
      '<div class="menu-topline"><span class="menu-brand-mini">ROCO REMAKE</span></div>' +
      '<header class="menu-header"><div class="menu-logo">' + logoMarkSvg('Menu') + '</div><h1 class="menu-title-cn">洛克王国<span>对战重置版</span></h1></header>' +
      '<nav class="menu-actions-area" aria-label="主菜单"><div class="mode-switch" role="group" aria-label="对战模式">' +
        '<button type="button" id="mode-solo">单机模式</button>' +
        '<button type="button" id="mode-online" aria-label="联机模式，暂未开放">联机模式<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg></button>' +
        '<button type="button" id="mode-developer">开发者·测试模式</button></div><div class="menu-buttons">' +
        '<button class="btn btn-primary" id="btn-battle"><span class="menu-action-copy"><span class="menu-action-title">开始对战</span></span><span class="menu-action-arrow" aria-hidden="true">→</span></button>' +
        '<button class="btn btn-secondary" id="btn-swap"><span class="menu-action-copy"><span class="menu-action-title">局外技能更换</span></span><span class="menu-action-arrow" aria-hidden="true">→</span></button>' +
        '<button class="btn btn-secondary" id="btn-pets"><span class="menu-action-copy"><span class="menu-action-title">宠物管理</span></span><span class="menu-action-arrow" aria-hidden="true">→</span></button>' +
      '</div></nav><div class="menu-footer" aria-hidden="true"></div>' +
    '</main>';
  const battle = app.querySelector("#btn-battle");
  const modes = {
    solo: { title: "开始对战", button: app.querySelector("#mode-solo") },
    online: { title: "联机暂未开放", button: app.querySelector("#mode-online") },
    developer: { title: "开始测试", button: app.querySelector("#mode-developer") }
  };
  function selectMode(mode) {
    menuMode = mode;
    for (const [key, option] of Object.entries(modes)) option.button.setAttribute("aria-pressed", String(key === mode));
    battle.disabled = mode === "online";
    battle.querySelector(".menu-action-title").textContent = modes[mode].title;
  }
  selectMode(menuMode);
  for (const [mode, option] of Object.entries(modes)) option.button.addEventListener("click", function() { selectMode(mode); });
  battle.addEventListener('click', function() {
    if (menuMode === "online") return;
    gameState.selectedTeamIds = []; showScreen('team');
  });
  document.querySelector('#btn-swap').addEventListener('click', function() { showScreen('skillswap'); });
  document.querySelector('#btn-pets').addEventListener('click', function() { showScreen('pets'); });
}

function renderTeamChoice(app, opponent) {
  var pets = getAllPets(), selected = opponent ? gameState.opponentTeamIds : gameState.selectedTeamIds;
  var back = opponent ? 'opp-back' : 'team-back', ready = opponent ? 'opp-ready' : 'btn-ready';
  var attr = opponent ? 'data-opp-id' : 'data-pet-id';
  var content = '<div class="screen active">' + pageHeader(opponent ? '选择对手宠物（1~6只）' : '选择出战宠物（1~6只）', back) + '<div class="pet-grid">';
  pets.forEach(function(pet) { content += petChoiceCard(pet, attr, selected.includes(pet.id)); });
  app.innerHTML = content + '</div><div class="team-ready-bar"><div class="selected-count">已选择 <strong>' + selected.length + '</strong> / 6 只</div><button class="btn btn-primary" id="' + ready + '"' + (selected.length ? '' : ' disabled') + '>' + (opponent ? '确认对手并开战！' : '下一步：选择对手') + '</button></div></div>';
  document.querySelector('#' + back).addEventListener('click', function() { showScreen(opponent ? 'team' : 'menu'); });
  document.querySelector('#' + ready).addEventListener('click', function() { opponent ? confirmOpponentAndBattle() : startBattle(); });
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
  gameState.jianghuaOwners = new Set(); gameState.pendingJianghuaByPet = new Map();
  delete gameState.fieldLockedThrough;
  gameState.wanguHeals = [];
  gameState.qingnianWindows = {};
  gameState.creationOwners = new Set();
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

function displayedPercent(node, fallback) {
  if (!node) return fallback;
  if (typeof window !== "undefined" && window.getComputedStyle && node.parentNode && node.parentNode.getBoundingClientRect) {
    var width = node.parentNode.getBoundingClientRect().width, current = parseFloat(window.getComputedStyle(node).width);
    if (width > 0 && isFinite(current)) return Math.max(0, Math.min(100, current / width * 100));
  }
  var value = parseFloat(node.style.width); return isFinite(value) ? value : fallback;
}
function renderBattle(app) {
  closeBloodlinePreview();
  var p = gameState.playerActive, a = gameState.aiActive;
  var sameBattle = battleVisual.battleId === gameState.battleId;
  if (!sameBattle) { resetBattleVisual(); battleVisual.battleId = gameState.battleId; }
  var oldSkills = sameBattle && document.querySelector(".battle-skill-list"); if (oldSkills) battleVisual.skillScroll = oldSkills.scrollLeft;
  var previousPlayer = sameBattle && battleVisual.player && battleVisual.player.pet === p;
  var previousAi = sameBattle && battleVisual.ai && battleVisual.ai.pet === a;
  const fullLog = isDeveloperBattle();
  const leaveLabel = fullLog && gameState.battleOver ? "返回主菜单" : "逃跑";
  var oldLog = sameBattle && document.querySelector("#battle-messages"), logTop = oldLog && oldLog.scrollTop;
  var logBottom = !oldLog || oldLog.scrollHeight - oldLog.scrollTop - oldLog.clientHeight < 40;
  var pBar = document.querySelector("#player-hp-bar"), aBar = document.querySelector("#ai-hp-bar");
  var pStart = previousPlayer ? displayedPercent(pBar, hpPercent(p)) : hpPercent(p);
  var aStart = previousAi ? displayedPercent(aBar, hpPercent(a)) : hpPercent(a);
  var pGhost = previousPlayer && pBar ? displayedPercent(pBar.parentNode.querySelector(".hp-bar-ghost"), pStart) : pStart;
  var aGhost = previousAi && aBar ? displayedPercent(aBar.parentNode.querySelector(".hp-bar-ghost"), aStart) : aStart;
  clearBattleVisualTasks();
  const noElement = { name:"无属系", color:"#a6b0c1", bg:"transparent" };
  var pEl = ELEMENTS[p.element] || noElement, aEl = ELEMENTS[a.element] || noElement;
  const logTools = fullLog ? '<span class="developer-log-count" id="developer-log-count">完整日志</span>' :
    '<button class="log-tab active" data-filter="all">全部</button><button class="log-tab" data-filter="action">行动</button><button class="log-tab" data-filter="system">系统</button>';
  const logAttributes = fullLog ? ' tabindex="0" role="region" aria-label="完整战斗日志"' : "";
  var html =
    '<div class="battle-bg screen active">' +
    '<div class="battle-weather" id="battle-weather" role="status" hidden></div>' +
    // 顶栏：回合指示 + 倒计时 + 逃跑
    '<div class="battle-top">' +
      '<div class="turn-indicator" id="turn-indicator" style="display:none"></div>' +
      '<div class="turn-timer" id="turn-timer" style="display:none"><span>\u23F3</span><div class="turn-timer-bar"><div class="turn-timer-fill" id="turn-timer-fill" style="width:100%"></div></div><span id="turn-timer-text">20s</span></div>' +
      '<button class="flee-btn" id="flee-btn" title="' + leaveLabel + '">' + (leaveLabel === "逃跑" ? "\u{1F3C3} " : "") + leaveLabel + '</button>' +
    '</div>' +
    // 双宠对置行：玩家左 / 舞台中 / 敌方右
    '<div class="battle-row">' +
      '<div class="battle-side player-side">' +
        '<div class="pet-sprite player" id="player-sprite">' + p.emoji + '</div>' +
        '<div class="pet-info-card" id="player-info" style="border-left:3px solid ' + pEl.color + '">' +
          '<div class="pet-info-top"><span class="pet-info-name">' + p.name + '</span><span class="pet-info-lv">Lv.' + p.level + '</span><span class="pet-info-element" style="background:' + pEl.bg + ';color:' + pEl.color + '">' + elemIcon(p.element) + pEl.name + '</span></div>' +
          '<div class="battle-bloodline-slot"></div>' +
          '<div class="hp-bar-outer"><div class="hp-bar-ghost" style="width:' + pGhost + '%"></div><div class="hp-bar-inner" id="player-hp-bar" style="width:' + pStart + '%"></div></div>' +
          '<div id="player-shield"></div>' +
          '<div class="hp-text" id="player-hp-text">' + p.hp + '/' + p.maxHp + '</div>' +
          '<div class="marks-display" id="player-marks"></div>' +
          '<div id="player-status"></div>' +
          '<div class="stages-bar" id="player-stages"></div>' +
        '</div>' +
      '</div>' +
      '<div class="battle-stage"><div class="stage-vs">VS</div><div class="battle-ground"></div></div>' +
      '<div class="battle-side enemy-side">' +
        '<div class="pet-sprite opponent" id="ai-sprite">' + a.emoji + '</div>' +
        '<div class="pet-info-card" id="ai-info" style="border-left:3px solid ' + aEl.color + '">' +
          '<div class="pet-info-top"><span class="pet-info-name">' + a.name + '</span><span class="pet-info-lv">Lv.' + a.level + '</span><span class="pet-info-element" style="background:' + aEl.bg + ';color:' + aEl.color + '">' + elemIcon(a.element) + aEl.name + '</span></div>' +
          '<div class="battle-bloodline-slot"></div>' +
          '<div class="hp-bar-outer"><div class="hp-bar-ghost" style="width:' + aGhost + '%"></div><div class="hp-bar-inner" id="ai-hp-bar" style="width:' + aStart + '%"></div></div>' +
          '<div id="ai-shield"></div>' +
          '<div class="hp-text" id="ai-hp-text">' + a.hp + '/' + a.maxHp + '</div>' +
          '<div class="marks-display" id="ai-marks"></div>' +
          '<div id="ai-status"></div>' +
          '<div class="stages-bar" id="ai-stages"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    // 底部战斗台：日志左 / 技能面板右
    '<div class="battle-bottom">' +
      '<div class="battle-log"><div class="log-tools">' + logTools +
      '<button class="log-copy" id="log-copy">复制</button></div><div class="battle-messages' + (fullLog ? " developer-log" : "") +
      '" id="battle-messages"' + logAttributes + '></div><button class="log-jump" id="log-jump" hidden>回到最新</button></div>' +
      '<div class="battle-panel"><div class="battle-actions" id="battle-actions"></div></div>' +
    '</div>' +
    // 替换面板
    '<div class="switch-panel" id="switch-panel"><div style="font-size:13px;color:var(--text2);text-align:center;margin-bottom:4px;">选择替换的宠物：</div><div id="switch-list"></div><button class="btn btn-secondary btn-small" id="switch-cancel">取消</button></div>' +
    '</div>' +
    '<div class="result-overlay" id="result-overlay"><div class="result-emoji" id="result-emoji"></div><div class="result-text" id="result-text"></div><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;"><button class="btn btn-secondary" id="result-close">\u{1F4CB} 继续查看</button><button class="btn btn-primary" id="result-back">\u{1F519} 返回主菜单</button></div></div>';
  app.innerHTML = html;
  const logPlaceholder = document.querySelector("#battle-messages");
  if (fullLog && oldLog && logPlaceholder !== oldLog) logPlaceholder?.replaceWith?.(oldLog);
  var jumpBtn = document.querySelector("#log-jump");
  if (jumpBtn) jumpBtn.addEventListener("click", function() { var mm = document.querySelector("#battle-messages"); if (mm) mm.scrollTop = mm.scrollHeight; jumpBtn.hidden = true; });
  Array.prototype.forEach.call(document.querySelectorAll(".log-tab"), function(b) {
    b.addEventListener("click", function() { gameState.logFilter = b.getAttribute("data-filter"); updateBattleUI(); });
  });
  var copyBtn = document.querySelector("#log-copy");
  if (copyBtn) copyBtn.addEventListener("click", copyBattleLog);
  var msgsEl = document.querySelector("#battle-messages");
  if (fullLog && msgsEl) msgsEl.onscroll = function() {
    if (jumpBtn) jumpBtn.hidden = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 40;
  };
  if (!fullLog && msgsEl) msgsEl.addEventListener("click", function(e) {
    var t = e.target && e.target.closest ? e.target.closest(".msg.turn") : null;
    if (!t) return;
    var tn = t.getAttribute("data-turn");
    gameState.logCollapsed = gameState.logCollapsed || {};
    gameState.logCollapsed[tn] = !gameState.logCollapsed[tn];
    updateBattleUI();
  });
  if (previousPlayer && pStart !== hpPercent(p)) battleVisual.player.hp = pStart;
  if (previousAi && aStart !== hpPercent(a)) battleVisual.ai.hp = aStart;
  void app.offsetWidth;
  renderBattleActions();
  updateBattleUI();
  if (previousPlayer && pGhost !== hpPercent(p)) { var pg = document.querySelector("#player-hp-bar").parentNode.querySelector(".hp-bar-ghost"); if (pg) pg.style.width = hpPercent(p) + "%"; }
  if (previousAi && aGhost !== hpPercent(a)) { var ag = document.querySelector("#ai-hp-bar").parentNode.querySelector(".hp-bar-ghost"); if (ag) ag.style.width = hpPercent(a) + "%"; }
  if (oldLog) { var newLog = document.querySelector("#battle-messages"); if (newLog) { newLog.scrollTop = logBottom ? newLog.scrollHeight : logTop; var jump = document.querySelector("#log-jump"); if (jump) jump.hidden = logBottom; } }
  if (sameBattle && !prefersReducedMotion()) {
    [previousPlayer ? null : "#player-sprite", previousAi ? null : "#ai-sprite"].forEach(function(selector) {
      var sprite = selector && document.querySelector(selector);
      if (sprite) enterBattleSprite(sprite);
    });
  }
  ["result-overlay", "switch-panel"].forEach(function(id) {
    var layer = document.getElementById(id);
    prepareLayer(layer, function() { layer.classList.remove("show", "closing"); });
  });
  document.querySelector("#result-back").addEventListener("click", function() { showScreen("menu"); });
  document.querySelector("#result-close").addEventListener("click", function() { var layer = document.querySelector("#result-overlay"); if (!layer.layerIsOpen()) return; layer.querySelectorAll("button").forEach(function(button) { button.disabled = true; }); layer.closeLayer(); var act = document.querySelector("#battle-actions"); if (act) act.innerHTML = "<div style=text-align:center;padding:16px;color:var(--text2);font-size:13px>战斗已结束，可滚动上方日志回顾战况</div>"; });
  document.querySelector("#switch-cancel").addEventListener("click", function() { if (!gameState.waitingForSwitch) return; gameState.waitingForSwitch = false; var panel = document.querySelector("#switch-panel"); panel.querySelectorAll("button").forEach(function(button) { button.disabled = true; }); panel.closeLayer(); startTurnTimer(); });
  document.querySelector("#flee-btn").addEventListener("click", function() {
    if (fullLog && gameState.battleOver) showScreen("menu");
    else showFleeConfirm();
  });
}

// ========== 逃跑确认弹窗 ==========
function showFleeConfirm() {
  closeBloodlinePreview();
  var old = document.getElementById('flee-overlay');
  if (old && old.layerIsOpen && old.layerIsOpen()) return;
  removeBodyLayer('flee-overlay');
  var ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.id = 'flee-overlay';
  ov.innerHTML = '<div class="modal"><h3>\u{1F3C3} 逃跑确认</h3><p style="text-align:center;color:var(--text2);margin-bottom:16px;line-height:1.8;">确定要逃跑吗？<br>' + (isDeveloperBattle() ? "结束测试后可继续查看完整日志。" : "本次战斗进度将不会保留。") + '</p><div class="form-actions"><button class="btn btn-secondary" id="flee-cancel">取消</button><button class="btn btn-danger" id="flee-confirm">确认逃跑</button></div></div>';
  document.body.appendChild(ov);
  var trigger = document.activeElement, version = uiPageVersion;
  prepareLayer(ov, function(restore) { ov.remove(); if (restore && version === uiPageVersion && trigger && trigger.isConnected !== false && trigger.focus) trigger.focus(); });
  function cancel() { if (!ov.layerIsOpen()) return; ov.querySelector("#flee-confirm").disabled = true; ov.closeLayer(); }
  ov.querySelector("#flee-cancel").addEventListener("click", cancel);
  ov.querySelector("#flee-confirm").addEventListener("click", function() {
    if (!ov.layerIsOpen()) return;
    ov.closeLayer(true);
    gameState.pendingPlayerAction = null;
    gameState.pendingPlayerSkill = null;
    gameState.pendingAISkill = null;
    if (isDeveloperBattle()) { endBattle(false, true); return; }
    gameState.battleOver = true;
    stopTurnTimer();
    showScreen("menu");
  });
  ov.addEventListener("click", function(e) { if (e.target === ov) cancel(); });
}

function renderBattleActions() { if (!canSubmitPlayerAction()) return; var container = document.querySelector("#battle-actions"); if (!container) return; var oldList = container.querySelector(".battle-skill-list"); if (oldList) battleVisual.skillScroll = oldList.scrollLeft; container.innerHTML = ""; var player = gameState.playerActive; if (!player || player.isFainted()) return;
  // 异常状态可自动跳过；没有可选技能时仍可通过换宠或空过行动。
  const noAvailableSkill = !player.skills.some(canSelectSkill);
  if (["sleep", "deep_sleep", "freeze", "fear"].includes(player.status) && !noAvailableSkill) {
    var reason = (player.status==="sleep"?"正在睡觉":player.status==="deep_sleep"?"正在沉睡":player.status==="freeze"?"被冰冻":player.status==="fear"?"被恐惧":player.status==="paralyze"?"麻痹无法行动":"无法行动");
    document.querySelector("#battle-actions").innerHTML = "<div style=text-align:center;padding:20px;color:var(--text2);font-size:14px>"+player.name+reason+"<br>自动跳过...</div>";
    stopTurnTimer();
    const battleId = gameState.battleId;
    gameState.autoSkipTimer = setTimeout(function() {
      if (!canSubmitPlayerAction() || gameState.battleId !== battleId || gameState.playerActive !== player) return;
      submitPlayerAction(null);
    }, 800);
    return;
  }
  startTurnTimer();
  var skillList = document.createElement('div'); skillList.className = 'battle-skill-list';
  skillList.setAttribute('aria-label', '出战技能，按第一至第四格排列');
  var utilities = document.createElement('div'); utilities.className = 'battle-utility-list';
  container.appendChild(skillList); container.appendChild(utilities);
  player.skills.forEach(function(skill, idx) {
    const element = getEffectiveSkillElement(player, skill.element);
    const displaySkill = element === skill.element ? skill : { ...skill, element };
    var el = ELEMENTS[element] || {color: '#a6b0c1',bg: 'transparent'};
    var prio = getSkillPriority(skill), prioStr = prio > 8 ? '+' + (prio-8) : prio < 8 ? '-' + (8-prio) : '±0';
    var card = document.createElement('div'); card.className = 'skill-card';
    var btn = document.createElement('button');
    const sealed = isSkillSealed(skill, gameState.turnCount + 1);
    btn.disabled = !canSelectSkill(skill);
    btn.className = 'skill-btn' + (btn.disabled ? ' no-pp' : '');
    btn.style.setProperty('--el',el.color);
    var slotNumber = idx + 1;
    btn.setAttribute('aria-label', '第' + slotNumber + '格：使用' + skill.name + '，剩余' + skill.pp + 'PP' + (skill.passiveLabel ? '，' + skill.passiveLabel : '') + (sealed ? '，封技' : ''));
    btn.innerHTML = '<div class="skill-btn-header"><div class="skill-btn-icon" style="background:' + el.bg + '">' + getSkillIcon(displaySkill) + '</div><div class="skill-btn-name">' + escapeHtml(skill.name) + '</div><div class="skill-btn-prio ' + (prio > 8 ? 'fast' : prio < 8 ? 'slow' : 'normal') + '">' + prioStr + '</div></div><div class="skill-btn-body"><span class="skill-power">' + (sealed ? '封技' : skill.power ? '威力 ' + Math.round(getSkillPower(skill,skill.power)*100)/100 : '变化') + '</span>' + renderSkillPassiveTag(skill) + '<span class="skill-pp-info"><span class="' + (skill.pp/skill.maxPp < .3 ? 'pp-empty' : '') + '">' + skill.pp + '</span> / ' + skill.maxPp + ' PP</span></div>';
    btn.addEventListener('click', function() { btn.classList.add('pressed'); btn.classList.add('selected'); playerUseSkill(idx); });
    var slot = document.createElement('span');
    slot.className = 'skill-slot-label skill-order'; slot.textContent = String(slotNumber);
    slot.setAttribute('aria-hidden', 'true');
    var info = document.createElement('button'); info.className = 'skill-info'; info.textContent = 'i';
    info.setAttribute('aria-label', '查看' + skill.name + '的技能详情');
    info.addEventListener('click', function() { showSkillDetail(displaySkill,info); });
    card.appendChild(btn); card.appendChild(slot); card.appendChild(info); skillList.appendChild(card);
  });
  if (noAvailableSkill) {
    var pass = document.createElement('button'); pass.className = 'action-btn'; pass.id = 'battle-pass'; pass.textContent = '跳过回合';
    pass.addEventListener('click', function() { if (canSubmitPlayerAction() && !gameState.waitingForSwitch) submitPlayerAction(null); });
    utilities.appendChild(pass);
  }
  var swBtn = document.createElement('button'); swBtn.className = 'action-btn';
  if (player.bindTurns > 0) { swBtn.textContent = '🔒 束缚中'; swBtn.disabled = true; }
  else if (hasSwitchLock(player)) { swBtn.textContent = '🔒 换宠锁定'; swBtn.disabled = true; }
  else { swBtn.textContent = '↔ 换宠'; swBtn.addEventListener('click', showSwitchPanel); }
  utilities.appendChild(swBtn);
  skillList.scrollLeft = battleVisual.skillScroll || 0;
}

function showSwitchPanel() { if (!canSubmitPlayerAction() || gameState.waitingForSwitch) return; var panel = document.querySelector("#switch-panel"), list = document.querySelector("#switch-list"); if (!panel || !list) return; gameState.waitingForSwitch = true; stopTurnTimer(); if (panel.closeLayer) panel.closeLayer(true); prepareLayer(panel, function() { panel.classList.remove("show", "closing"); }); document.querySelector("#switch-cancel").disabled = false; panel.classList.add("show"); list.innerHTML = ""; gameState.playerParty.forEach(function(pet, idx) { if (pet === gameState.playerActive) return; var btn = document.createElement("button"); btn.className = "switch-pet-btn" + (pet.isFainted() ? " fainted" : ""); btn.disabled = pet.isFainted(); var hpPct = Math.max(0, (pet.hp / pet.maxHp) * 100); var hpCls = hpPct < 25 ? " critical" : hpPct < 50 ? " low" : ""; var stBadges = renderAbnormalBadges(pet); btn.innerHTML = '<span class="switch-emoji">' + pet.emoji + '</span><div class="switch-pet-info"><span style="font-weight:700">' + pet.name + ' <span style="font-size: 12px;color:var(--text2)">Lv.' + pet.level + '</span></span><div class="switch-pet-hpwrap"><div class="switch-pet-hpbar"><div class="switch-pet-hpfill' + hpCls + '" style="width:' + hpPct + '%"></div></div><span style="font-size: 12px;color:var(--text2)">' + pet.hp + '/' + pet.maxHp + '</span></div><div class="switch-pet-status">' + stBadges + '</div></div>'; btn.addEventListener("click", function() { playerSwitch(idx); }); list.appendChild(btn); }); }

// ---------- SKILL DETAIL (完整机制展示) ----------
function renderSkillPassiveTag(skill) {
  return skill.passiveLabel ? '<span class="skill-passive-tag">' + escapeHtml(skill.passiveLabel) + '</span>' : "";
}
var CATEGORY_NAMES = { physical: "物理", special: "魔法", status: "变化" };
function skillMetaText(skill) {
  const elementLabel = skill.element === null ? "无属系" : (ELEMENTS[skill.element]?.name || "?") + "系";
  var acc = skill.semiSure ? "半必中" : (skill.accuracy >= 100 ? "必中" : (skill.accuracy || 100) + "%");
  var parts = [elementLabel, CATEGORY_NAMES[skill.category] || skill.category, skill.maxPp + "PP", "先手" + fmtPriority(getSkillPriority(skill)), acc];
  if (skill.power) parts.push("基础威力 " + Math.round(getSkillPower(skill, skill.power) * 100) / 100);
  return parts.join(" · ");
}
function showSkillDetail(skill, trigger) {
  if (!skill) return;
  closeBloodlinePreview();
  var old = document.getElementById('skill-detail-overlay');
  if (old) { if (old.closeLayer) old.closeLayer(true); else old.remove(); }
  var returnFocus = trigger || document.activeElement;
  var ov = document.createElement('div'); ov.className = 'modal-overlay show'; ov.id = 'skill-detail-overlay';
  var builtin = DEFAULT_SKILLS.find(function(s) { return s.id === skill.id; });
  var description = escapeHtml(skill.detail || skill.desc || '暂无说明');
  if (skill.bloodlineDetail) description = '<strong class="skill-bloodline-detail">' + escapeHtml(skill.bloodlineDetail) + '</strong>\n\n' + description;
  if (builtin && skill.detail && skill.desc && skill.desc !== builtin.desc) description = escapeHtml(skill.desc) + '\n\n' + description;
  ov.innerHTML = '<div class="modal skill-detail" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title"><h3 id="skill-detail-title">' + escapeHtml(skill.name) + '</h3><div class="skill-detail-meta">' + skillMetaText(skill) + (skill.passiveLabel ? ' · ' + renderSkillPassiveTag(skill) : '') + '</div><div class="skill-detail-body" tabindex="0" aria-label="技能机制正文">' + description + '</div><div class="form-actions"><button class="btn btn-secondary" id="skill-detail-close">关闭</button></div></div>';
  document.body.appendChild(ov);
  var version = uiPageVersion;
  prepareLayer(ov, function(restore) {
    document.removeEventListener('keydown', onKey); ov.remove();
    if (restore && uiPageVersion === version && returnFocus && returnFocus.isConnected !== false && returnFocus.focus) returnFocus.focus();
  });
  function close() { ov.closeLayer(); }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      var items = ov.querySelectorAll('button:not([disabled]), [tabindex="0"]'), first = items[0], last = items[items.length-1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  ov.querySelector('#skill-detail-close').addEventListener('click', function() { close(); });
  ov.addEventListener('click', function(e) { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey);
  ov.querySelector('#skill-detail-close').focus();
}

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

function init() { try { initSettings(); showScreen("intro"); } catch(e) { document.body.innerHTML = "<div style='color:lime;background:#111;padding:20px;font-family:monospace;font-size:14px'><h2 style='color:red'>INIT ERROR</h2><pre>"+e.stack+"</pre></div>"; } }
init();



