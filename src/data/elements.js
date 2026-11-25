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

