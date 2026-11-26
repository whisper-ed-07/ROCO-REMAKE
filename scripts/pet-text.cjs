const fs = require('node:fs');
const path = require('node:path');

const pets = [
  {
    file: '清灵.txt',
    id: 'pet_qingling',
    bloodline: '血脉：清念灵体',
    skills: [
      ['sk_ql_1', '微灵封体'], ['sk_ql_2', '万念俱灰'], ['sk_ql_3', '封灵千噬'],
      ['sk_ql_4', '太虚灵威'], ['sk_ql_5', '万古遗恨'],
    ],
    footer: '清灵是“清念”',
  },
  {
    file: '清羽.txt',
    id: 'pet_qy',
    bloodline: '血脉：清念/残脉',
    skills: [
      ['sk_qy_1', '清翎覆尘'], ['sk_qy_2', '轻风散魂'], ['sk_qy_3', '残念余梦'],
      ['sk_qy_4', '残风临霜'], ['sk_qy_5', '清念沉脉'],
    ],
    footer: '思路：',
  },
  {
    file: '极影迪莫.txt',
    id: 'pet_jydm',
    bloodline: '[图片]血脉：明念',
    skillsHeading: '[图片]专属技能简析',
    skills: [
      ['sk_jydm_1', '极尽降华'], ['sk_jydm_2', '化念作刃'], ['sk_jydm_3', '极影光幕'],
      ['sk_jydm_4', '瞬华若霜'], ['sk_jydm_5', '炽光若焰'],
    ],
  },
  {
    file: '创世神钟.txt',
    id: 'pet_bmhs',
    bloodline: '血脉：不灭魂体',
    skills: [
      ['sk_cszn', '创世之能'], ['sk_nlex', '逆流而行'], ['sk_mszw', '灭世之威'],
      ['sk_fthy', '覆体魂衣'], ['sk_cyjy', '重衍纪元'],
    ],
  },
];

function joinBody(lines) {
  while (lines[0]?.trim() === '') lines.shift();
  while (lines.at(-1)?.trim() === '') lines.pop();
  return lines.join('\n');
}

function readPetText(root) {
  const skillText = {};
  const bloodlineText = {};
  for (const { id, file, skills, footer, bloodline, skillsHeading } of pets) {
    const lines = fs.readFileSync(path.join(root, 'pets', file), 'utf8').split(/\r?\n/);
    let previous = -1;
    const headings = skills.map(([, name]) => {
      const heading = lines.findIndex((line, index) => index > previous &&
        line.replace(/^\[图片\]/, '').startsWith(name + ' '));
      if (heading < 0) throw new Error(file + ' 找不到技能标题 ' + name);
      previous = heading;
      return heading;
    });
    const bloodlineStart = lines.indexOf(bloodline);
    const bloodlineEnd = skillsHeading ? lines.indexOf(skillsHeading) : headings[0];
    if (bloodlineStart < 0 || bloodlineEnd <= bloodlineStart || bloodlineEnd > headings[0]) {
      throw new Error(file + ' 找不到完整血脉正文');
    }
    const bloodlineBody = joinBody(lines.slice(bloodlineStart + 1, bloodlineEnd));
    if (!bloodlineBody) throw new Error(file + ' 缺少血脉正文');
    bloodlineText[id] = bloodlineBody;

    const end = footer ? lines.findIndex((line, index) => index > previous && line.startsWith(footer)) : lines.length;
    if (end < 0) throw new Error(file + ' 找不到文章后记起点 ' + footer);
    skills.forEach(([id, name], index) => {
      const body = joinBody(lines.slice(headings[index] + 1, headings[index + 1] ?? end)
        .filter(line => !/^\[\d{4}-\d{2}-\d{2} 玩家修订。.*原句：/.test(line)));
      if (!body) throw new Error(file + ' 缺少技能正文 ' + name);
      skillText[id] = body;
    });
  }
  return { skillText, bloodlineText };
}

module.exports = { readPetText };
