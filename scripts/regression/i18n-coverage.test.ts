/**
 * 越南语专名表必须盖住引擎能产出的每一个名称。
 *
 * vi() / viPattern() 查不到时原样返回中文 —— 界面不崩，但会中越夹杂，而且没人会发现。
 * 所以把覆盖面钉死：上游新增一颗星或一个格局，这条测试当场红。
 *
 * 三种取名来源，各用各的办法，不靠「多扫几张盘碰运气」：
 *   1. 静态常量（天干、地支、五行局、十二神煞三套、四化）—— 直接比对引擎常量，完备。
 *   2. 格局名 —— 从 patterns.ts 源码抽字面量，再按四化表推出模板拼的那一族，完备。
 *   3. 星名、宫名、亮度 —— 这些要排出来才知道，按样本扫；另外钉住种类数，
 *      引擎新增星曜时数目对不上也会红。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateChart } from '../../lib/ziwei/algorithm';
import { BRANCHES, JU_NAMES, SI_HUA_TABLE, STEMS } from '../../lib/ziwei/constants';
import { BOSHI_SHEN, JIANG_QIAN_SHEN, SUI_QIAN_SHEN } from '../../lib/ziwei/shier-shen';
import {
  VI_BRANCHES, VI_BRIGHTNESS, VI_PALACES, VI_SHIER_SHEN, VI_SIHUA,
  VI_STARS, VI_STEMS, VI_WUXING_JU, VI_YINYANG_GENDER, vi, viPattern,
} from '../../lib/i18n/terms';

/** 引擎当前能排出的星曜种类数。改了安星逻辑这个数会变，顺带提醒更新专名表。 */
const EXPECTED_STAR_KINDS = 70;

const HAN = /[一-鿿]/;
const missing: string[] = [];
const need = (table: Record<string, string>, name: string, what: string): void => {
  if (!table[name]) missing.push(`${what}：${name}`);
};

// ── 1) 静态常量 ───────────────────────────────────────────
for (const s of STEMS) need(VI_STEMS, s, '天干');
for (const b of BRANCHES) need(VI_BRANCHES, b, '地支');
for (const j of Object.values(JU_NAMES)) need(VI_WUXING_JU, j, '五行局');
for (const h of ['禄', '权', '科', '忌']) need(VI_SIHUA, h, '四化');
for (const n of [...JIANG_QIAN_SHEN, ...SUI_QIAN_SHEN, ...BOSHI_SHEN]) {
  // 十二神煞与星曜有重名（华盖、劫煞、咸池、龙德、天德、大耗），任一表收录即可
  if (!VI_SHIER_SHEN[n] && !VI_STARS[n]) missing.push(`十二神煞：${n}`);
}

// ── 2) 格局名 ─────────────────────────────────────────────
/**
 * `name:` 行上的字面量。含 ternary（`name: x ? 'A' : 'B'`），所以不能只取第一个。
 * 下面这几个是同一行里的**比较操作数**，不是格局名：
 *   火星 —— `shaName === '火星' ? '火贪格' : '铃贪格'`
 *   命 / 迁 —— 模板串 `` `${jiStar.name}化忌入${inMing ? '命' : '迁'}` `` 里的片段
 */
const NOT_PATTERN_NAMES = new Set(['火星', '命', '迁']);

const patternsSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../lib/ziwei/patterns.ts'),
  'utf-8',
);
const literalNames = new Set<string>();
for (const line of patternsSrc.split('\n')) {
  const m = /^\s*name:\s*(.+?),?\s*$/.exec(line);
  if (!m) continue;
  for (const lit of m[1].matchAll(/'([^']+)'/g)) {
    if (!NOT_PATTERN_NAMES.has(lit[1])) literalNames.add(lit[1]);
  }
}
assert.ok(literalNames.size >= 40, `只从 patterns.ts 抽到 ${literalNames.size} 个格局名，抽取逻辑可能失效了`);

// 模板拼的一族：`${禄星}化禄入命`、`${忌星}化忌入{命,迁}`，星名取自四化表
const composedNames = new Set<string>();
for (const row of Object.values(SI_HUA_TABLE)) {
  composedNames.add(`${row[0]}化禄入命`);
  composedNames.add(`${row[3]}化忌入命`);
  composedNames.add(`${row[3]}化忌入迁`);
}

for (const name of [...literalNames, ...composedNames]) {
  const translated = viPattern(name);
  if (translated === name || HAN.test(translated)) missing.push(`格局：${name}`);
}

// ── 3) 扫盘：星名、宫名、亮度 ──────────────────────────────
let charts = 0;
const seenStars = new Set<string>();
// 1960–2019 走满一轮六十甲子；星曜落宫取决于年干支 / 月 / 时，与性别无关
for (let year = 1960; year <= 2019; year++) {
  for (const [month, day] of [[2, 18], [8, 6]] as [number, number][]) {
    for (let hour = 0; hour < 12; hour++) {
      const chart = generateChart({ year, month, day, hour, gender: hour % 2 ? 'male' : 'female' });
      charts++;
      for (const p of chart.palaces) {
        need(VI_PALACES, p.name, '宫名');
        for (const s of p.stars) {
          if (!seenStars.has(s.name)) { seenStars.add(s.name); need(VI_STARS, s.name, '星名'); }
          if (s.brightnessRaw) need(VI_BRIGHTNESS, s.brightnessRaw, '亮度');
        }
      }
      need(VI_WUXING_JU, chart.wuxingJuName, '五行局');
      if (chart.yinYangGender) need(VI_YINYANG_GENDER, chart.yinYangGender, '阴阳男女');
      if (chart.mingZhu) need(VI_STARS, chart.mingZhu, '命主');
      if (chart.shenZhu) need(VI_STARS, chart.shenZhu, '身主');
    }
  }
}

const unique = [...new Set(missing)].sort();
assert.equal(
  unique.length, 0,
  `越南语专名表缺 ${unique.length} 条：\n  ${unique.join('\n  ')}`,
);

assert.equal(
  seenStars.size, EXPECTED_STAR_KINDS,
  `扫 ${charts} 张盘排出 ${seenStars.size} 种星，预期 ${EXPECTED_STAR_KINDS} 种。` +
  '引擎的安星逻辑变了 —— 请核对 lib/i18n/terms.ts 是否需要补条目，再更新 EXPECTED_STAR_KINDS。',
);

// 未收录的输入必须原样返回，不能变成 undefined
assert.equal(vi('这不是专名'), '这不是专名');
assert.equal(viPattern('这不是格局'), '这不是格局');
assert.equal(vi('紫微'), 'Tử Vi');
assert.equal(viPattern('贪狼化禄入命'), 'Tham Lang Hoá Lộc Nhập Mệnh');

console.log(
  `[i18n-coverage] ${charts} 张盘 / ${seenStars.size} 种星 / ` +
  `${literalNames.size + composedNames.size} 个格局名：全部有汉越音`,
);
