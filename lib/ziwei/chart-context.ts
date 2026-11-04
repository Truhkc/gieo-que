/**
 * lib/ziwei/chart-context —— 把命盘序列化成模型读得懂的文本
 *
 * 排盘引擎输出的是结构化数据，模型要的是一段紧凑、无歧义的描述。
 * 这里只做「翻译」，不下任何命理判断 —— 格局来自 detectPatterns，
 * 断语留给模型，本文件不塞任何预设结论。
 *
 * 输入必须是 sanitizeChart() 的产物。
 */
import 'server-only';
import type { Palace, Star, ZiweiChart } from './types';
import { BRANCHES, SHICHEN, STEMS, STAR_DESCRIPTIONS } from './constants';
import { detectPatterns, getMingGongSummary } from './patterns';
import { getSiHuaByStem } from './sihua';

/** 命宫起算的宫序：0=命宫，1=兄弟，…，11=父母（地支逆时针每减 1 进一宫） */
function palaceOffset(chart: ZiweiChart, palace: Palace): number {
  return (chart.mingGongBranch - palace.branch + 12) % 12;
}

function orderedPalaces(chart: ZiweiChart): Palace[] {
  return [...chart.palaces].sort((a, b) => palaceOffset(chart, a) - palaceOffset(chart, b));
}

function ganzhi(stem: number, branch: number): string {
  return `${STEMS[stem] ?? '?'}${BRANCHES[branch] ?? '?'}`;
}

/** 紫微(庙·化权) */
function renderStar(s: Star): string {
  const marks: string[] = [];
  if (s.brightnessRaw) marks.push(s.brightnessRaw);
  if (s.siHua) marks.push(`化${s.siHua}`);
  return marks.length > 0 ? `${s.name}(${marks.join('·')})` : s.name;
}

const TYPE_LABEL: Record<Star['type'], string> = {
  major: '主星',
  lucky: '吉星',
  sha: '煞星',
  minor: '杂曜',
};
const TYPE_ORDER: Star['type'][] = ['major', 'lucky', 'sha', 'minor'];

function renderStarGroups(stars: Star[]): string {
  const groups = TYPE_ORDER
    .map(t => {
      const inGroup = stars.filter(s => s.type === t);
      return inGroup.length > 0 ? `${TYPE_LABEL[t]}: ${inGroup.map(renderStar).join('、')}` : null;
    })
    .filter((x): x is string => x !== null);
  return groups.length > 0 ? groups.join(' | ') : '无星';
}

function renderPalaceLine(chart: ZiweiChart, p: Palace): string {
  const tags: string[] = [];
  if (p.isMingGong) tags.push('命宫');
  if (p.isShenGong) tags.push('身宫');
  if (p.isCurrentDaXian) tags.push('当前大限');
  if (p.daXianAge) tags.push(`大限 ${p.daXianAge[0]}–${p.daXianAge[1]} 岁`);

  const parts = [`${p.name}（${ganzhi(p.stem, p.branch)}）`];
  if (tags.length > 0) parts.push(`[${tags.join('·')}]`);
  parts.push(renderStarGroups(p.stars));

  if (p.isEmpty) {
    const borrowed = p.borrowedStars?.length
      ? `借对宫${p.borrowedFromName ?? ''}主星：${p.borrowedStars.join('、')}`
      : `空宫，借对宫${p.borrowedFromName ?? ''}`;
    parts.push(borrowed);
  }
  if (p.selfSihua?.length) {
    parts.push(`宫干自化：${p.selfSihua.map(m => `${m.starName}自化${m.siHua}`).join('、')}`);
  }
  return `- ${parts.join(' ｜ ')}`;
}

/** 三方四正 = 本宫 + 对宫 + 两个三合宫 */
function sanfangSizheng(chart: ZiweiChart, branch: number): Palace[] {
  const wanted = [branch, (branch + 4) % 12, (branch + 6) % 12, (branch + 8) % 12];
  return wanted
    .map(b => chart.palaces.find(p => p.branch === b))
    .filter((p): p is Palace => p !== undefined);
}

function majorStarNames(p: Palace): string {
  const majors = p.stars.filter(s => s.type === 'major');
  if (majors.length > 0) return majors.map(renderStar).join('、');
  return p.borrowedStars?.length ? `空宫（借：${p.borrowedStars.join('、')}）` : '空宫';
}

function renderPatterns(chart: ZiweiChart): string {
  let patterns;
  try {
    patterns = detectPatterns(chart);
  } catch (err) {
    console.error('[chart-context] detectPatterns failed:', err);
    return '（格局识别未能完成，本次解读请只依据上面的宫位与四化数据。）';
  }
  if (patterns.length === 0) return '（未触发已收录的格局规则。）';

  const LEVEL: Record<string, string> = {
    excellent: '上格',
    good: '吉格',
    neutral: '中性',
    caution: '需注意',
  };

  return patterns.slice(0, 20).map(p => {
    const lines = [`- **${p.name}**（${LEVEL[p.level] ?? p.level}）涉及宫位：${p.palaces.join('、') || '—'}`];
    lines.push(`  释义：${p.description}`);
    if (p.conditions?.required?.length) lines.push(`  已满足必要条件：${p.conditions.required.join('；')}`);
    if (p.conditions?.bonus?.length) lines.push(`  加分项：${p.conditions.bonus.join('；')}`);
    if (p.conditions?.breaking?.length) lines.push(`  破格警示：${p.conditions.breaking.join('；')}`);
    if (p.source) lines.push(`  出处：${p.source}`);
    return lines.join('\n');
  }).join('\n');
}

function renderBasics(chart: ZiweiChart): string {
  const b = chart.birthInfo;
  const l = chart.lunarInfo;
  const shichen = SHICHEN[b.hour];
  const lines: string[] = [];

  if (b.name) lines.push(`- 称呼：${b.name}`);
  lines.push(`- 性别：${b.gender === 'male' ? '男' : '女'}${chart.yinYangGender ? `（${chart.yinYangGender}）` : ''}`);
  lines.push(
    `- 公历生日（排盘日）：${b.year} 年 ${b.month} 月 ${b.day} 日 ` +
    `${shichen ? `${shichen.name}（${shichen.range}）` : `时辰索引 ${b.hour}`}`,
  );
  if (b.origInput) {
    const o = b.origInput;
    const shifted = o.year !== b.year || o.month !== b.month || o.day !== b.day;
    lines.push(
      `- 用户实际填写：${o.year}-${String(o.month).padStart(2, '0')}-${String(o.day).padStart(2, '0')} ` +
      `${String(o.clockHour).padStart(2, '0')}:${String(o.clockMinute).padStart(2, '0')}` +
      (shifted ? '（已按晚子时换日规则归到次日排盘）' : ''),
    );
  }
  if (b.province || b.city) {
    lines.push(`- 出生地：${[b.province, b.city].filter(Boolean).join(' ')}${b.longitude !== undefined ? `（经度 ${b.longitude.toFixed(2)}°，已做真太阳时校正）` : '（未做经度校正）'}`);
  } else {
    lines.push('- 出生地：未填（未做真太阳时校正）');
  }

  const leap = l.isLeapMonth ? '闰' : '';
  lines.push(`- 农历：${l.lunarYear} 年 ${leap}${Math.abs(l.lunarMonth)} 月 ${l.lunarDay} 日`);
  lines.push(`- 生年干支：${ganzhi(l.yearStem, l.yearBranch)}`);
  if (l.fourPillars) lines.push(`- 四柱（节气口径）：${l.fourPillars.join(' ')}`);
  if (l.fourPillarsLunar) lines.push(`- 四柱（农历口径，与紫微同历法）：${l.fourPillarsLunar.join(' ')}`);
  lines.push(`- 五行局：${chart.wuxingJuName}`);
  lines.push(`- 命宫地支：${BRANCHES[chart.mingGongBranch]} ｜ 身宫地支：${BRANCHES[chart.shenGongBranch]} ｜ 紫微坐：${BRANCHES[chart.ziweiPos]}`);
  if (chart.mingZhu) lines.push(`- 命主：${chart.mingZhu}${chart.shenZhu ? ` ｜ 身主：${chart.shenZhu}` : ''}`);
  lines.push(`- 当前年龄：${chart.currentAge} 岁`);

  return lines.join('\n');
}

function renderBirthSihua(chart: ZiweiChart): string {
  const map = getSiHuaByStem(chart.lunarInfo.yearStem);
  const stem = STEMS[chart.lunarInfo.yearStem] ?? '?';
  const where = (starName: string): string => {
    if (!starName) return '—';
    const p = chart.palaces.find(pl => pl.stars.some(s => s.name === starName));
    return p ? `${starName} 在 ${p.name}` : `${starName}（本盘未见）`;
  };
  return [
    `生年 ${stem} 干四化：`,
    `- 化禄：${where(map['禄'])}`,
    `- 化权：${where(map['权'])}`,
    `- 化科：${where(map['科'])}`,
    `- 化忌：${where(map['忌'])}`,
  ].join('\n');
}

function renderCurrentDaXian(chart: ZiweiChart): string {
  const dx = chart.daXians[chart.currentDaXianIndex];
  if (!dx) {
    // currentDaXianIndex 可能是童限标记（CHILDHOOD_DAXIAN_INDEX = -2）
    return `当前运限：童限或未落在已排的大限区间内（currentDaXianIndex=${chart.currentDaXianIndex}，当前 ${chart.currentAge} 岁）。`;
  }
  const lines = [
    `当前大限：第 ${chart.currentDaXianIndex + 1} 限，${dx.startAge}–${dx.endAge} 岁，` +
    `落 ${dx.palaceName}（${dx.stemName ?? '?'}${BRANCHES[dx.palaceBranch] ?? '?'}）`,
  ];
  if (dx.siHua) {
    lines.push(
      `大限宫干 ${dx.siHua.stemName} 四化：化禄 ${dx.siHua.lu || '—'}、化权 ${dx.siHua.quan || '—'}、` +
      `化科 ${dx.siHua.ke || '—'}、化忌 ${dx.siHua.ji || '—'}`,
    );
  }
  const all = chart.daXians
    .map(d => `${d.startAge}–${d.endAge}→${d.palaceName}`)
    .join('，');
  lines.push(`全部大限：${all}`);
  return lines.join('\n');
}

function renderStarGlossary(chart: ZiweiChart): string {
  // 只给本盘命宫与三方四正出现过的主星补一行星性，避免 prompt 里堆无关内容
  const relevant = new Set<string>();
  for (const p of sanfangSizheng(chart, chart.mingGongBranch)) {
    for (const s of p.stars) if (s.type === 'major') relevant.add(s.name);
  }
  const rows = [...relevant]
    .map(name => {
      const d = STAR_DESCRIPTIONS[name];
      return d ? `- ${name}：${d.keywords}（${d.nature}，五行属${d.element}）` : null;
    })
    .filter((x): x is string => x !== null);
  return rows.length > 0 ? rows.join('\n') : '（无）';
}

/** 单盘完整上下文 */
export function buildChartContext(chart: ZiweiChart): string {
  const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  const summary = getMingGongSummary(chart);

  const sections: string[] = [
    `## 基本信息\n${renderBasics(chart)}`,
    `## ${renderBirthSihua(chart)}`,
    `## 命宫概要\n- 命宫主星：${summary.stars.length > 0 ? summary.stars.join('、') : '空宫'}` +
      `\n- 星性：${summary.nature || '—'}\n- 关键词：${summary.keywords.join('、') || '—'}`,
    `## 命宫三方四正（命 / 财帛 / 官禄 / 迁移）\n` +
      sanfangSizheng(chart, chart.mingGongBranch)
        .map(p => `- ${p.name}（${ganzhi(p.stem, p.branch)}）：${majorStarNames(p)}`)
        .join('\n'),
    `## 十二宫详情（命宫起，逆时针）\n${orderedPalaces(chart).map(p => renderPalaceLine(chart, p)).join('\n')}`,
    `## ${renderCurrentDaXian(chart)}`,
    `## 格局识别（本仓库 patterns.ts 规则库，服务端重新计算）\n${renderPatterns(chart)}`,
    `## 相关主星星性速查\n${renderStarGlossary(chart)}`,
  ];

  if (ming === undefined) {
    sections.unshift('> 注意：本盘未找到与 mingGongBranch 对应的宫位，命宫相关判断请谨慎。');
  }

  return sections.join('\n\n');
}

/** 合盘上下文：两张盘 + 婚姻相关宫位的并列摘要 */
export function buildHemingContext(chartA: ZiweiChart, chartB: ZiweiChart): string {
  const focus = (chart: ZiweiChart, label: string): string => {
    // 夫妻宫与福德宫是倪师双宫联参的两个落点；iztro zh-CN 里宫名不带「宫」字
    const byName = (needle: string) =>
      chart.palaces.find(p => p.name.includes(needle));
    const fuqi = byName('夫妻');
    const fude = byName('福德');
    const mingPalace = chart.palaces.find(p => p.branch === chart.mingGongBranch);
    const rows = [
      `- ${label} 命宫：${mingPalace ? majorStarNames(mingPalace) : '—'}`,
      `- ${label} 夫妻宫：${fuqi ? renderStarGroups(fuqi.stars) : '—'}`,
      `  （地支 ${fuqi ? BRANCHES[fuqi.branch] : '—'}，宫干 ${fuqi ? STEMS[fuqi.stem] : '—'}${fuqi?.selfSihua?.length ? `，自化：${fuqi.selfSihua.map(m => `${m.starName}自化${m.siHua}`).join('、')}` : ''}）`,
      `- ${label} 福德宫：${fude ? renderStarGroups(fude.stars) : '—'}`,
    ];
    return rows.join('\n');
  };

  return [
    '# 甲方命盘',
    buildChartContext(chartA),
    '',
    '# 乙方命盘',
    buildChartContext(chartB),
    '',
    '# 双方婚姻宫位并列摘要',
    focus(chartA, '甲方'),
    focus(chartB, '乙方'),
  ].join('\n\n');
}
