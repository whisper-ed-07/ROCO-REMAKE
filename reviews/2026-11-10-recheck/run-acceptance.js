// Correct-behavior expectations for the LCS repair review; failures are genuine failures.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const root = process.argv[2] || path.resolve(__dirname, '../..');
const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'ROCO REMAKE.html'))).digest('hex');
const output = path.join(__dirname, 'runs', sourceHash.slice(0, 12));
fs.mkdirSync(output, {recursive: true});
const checks = [];
const check = (name, pass, actual) => checks.push({name, pass: Boolean(pass), actual});
function probe(name) {
  const stdout = execFileSync(process.execPath, [path.join(__dirname, 'probes', name + '.js'), root], {cwd: root, encoding:'utf8', timeout:30000});
  fs.writeFileSync(path.join(output, name + '.txt'), stdout);
  return stdout;
}
try {
  const rows = probe('engine').trim().split(/\r?\n/).map(line => JSON.parse(line));
  const byName = Object.fromEntries(rows.map(row => [row.name, row]));
  let r = byName.REGRESSION_double_tick;
  check('E01 每回合天气/环境/降华只递减一次', r.weather===5 && r.field===5 && r.element===5, r);
  r = byName.REGRESSION_cache_deadlock;
  check('E02 双方睡醒后回合及行动继续推进', r.turn>=2 && r.pCanAct && r.aCanAct && r.pPP<5 && r.aPP<5, r);
  r = byName.REGRESSION_lethal_reset;
  check('E03 新回合致死保护不被旧幂等标记阻断', r.hp>0 && !r.over, r);
  r = byName.PASS_R06_single_lethal;
  check('E04 单次致死保护先于判负', r.hp===1 && !r.over, r);
  r = byName.PASS_R04_zero_pp;
  check('E05 出手前0PP取消原技能', r.count===0 && r.pp===0, r);
  r = byName.PASS_R05_eject;
  check('E06 驱逐后旧宠物动作失效', r.count===0 && r.active==='bench', r);
  r = byName.PASS_R07_reset;
  check('E07 新局清除降华全局状态', r.element===null && r.buff===null && r.pending===null, r);
  r = byName.PASS_R08_timeout;
  check('E08 旧局回调不推进新局', r.turn===0, r);
  r = byName.PASS_R16_heal;
  check('E09 残脉受伤后立即回复', r.hp===r.max, r);
} catch (e) { check('引擎探针执行', false, e.message); }
try {
  const data = JSON.parse(probe('specs')).checks;
  check('M01 敌方未出招时不自动施加沉脉削弱', data.R11.triggerGatePass, data.R11);
  check('M02 残念记录扣除本次出招PP后的值', data.R12.postUseRecordPass, data.R12);
  check('M03 未经过残脉不得恢复残念记录PP', data.R12.fullCycleRequiredPass, data.R12);
  check('M04 PP缺失本身不触发明念', data.R13.ppMissingPass, data.R13);
  check('M05 明念重新触发要求新的使用记录', data.R13.repeatRequiresNewUsePass, data.R13);
  check('M06 炽光清空对方同格技能', data.R14.pass, data.R14);
  check('M07 残脉回血时点及200精力边界', data.R16.pass, data.R16);
} catch (e) { check('机制探针执行', false, e.message); }
try {
  const rows = JSON.parse(probe('ui'));
  const byName = Object.fromEntries(rows.map(row => [row.check, row]));
  check('S01 四出战槽/五技能池且血脉保留', byName['R02/new-four-slot-rule'].pass, byName['R02/new-four-slot-rule']);
  let r = byName['R09-edit-persisted-then-loadout-save-resets'];
  check('S02 内置宠物直接编辑持久化', r.immediatelyAfterEdit.name==='new-name' && r.immediatelyAfterEdit.level===88, r.immediatelyAfterEdit);
  check('S03 保存技能配置保留之前的宠物编辑', r.afterSkillSave.name==='new-name' && r.afterSkillSave.level===88, r);
  r = byName['legacy-custom-pet-built-in-override-not-migrated'];
  check('S04 旧版合法四槽配置得到迁移', JSON.stringify(r.oldSkills)===JSON.stringify(r.currentBattleSkills) && r.recordStillExists, r);
  r = byName['builtin-skill-edit-still-no-op'];
  check('S05 内置技能编辑持久化', r.nameAfter==='edited-skill', r);
  for (const [label,key] of [
    ['S06 启动保留旧数据与同源设置','R01-version-snippets-preserve-storage'],
    ['S07 换宠期间锁定并只结算一轮','R03-switch-lock-and-one-round'],
    ['S08 旧换宠回调不影响新局','R08-old-switch-callback-after-new-game'],
    ['S09 旧自动跳过回调不影响新局','R08-old-auto-skip-callback-after-new-game']
  ]) check(label, byName[key].pass, byName[key]);
} catch (e) { check('存档/交互探针执行', false, e.message); }
const summary = {sourceHash, total:checks.length, passed:checks.filter(c=>c.pass).length, failed:checks.filter(c=>!c.pass).length, checks};
fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({total:summary.total,passed:summary.passed,failed:summary.failed}));
for (const c of checks) console.log((c.pass?'PASS ':'FAIL ')+c.name);
if(summary.failed) process.exitCode=1;
