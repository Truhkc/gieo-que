/**
 * lib/ai/knowledge —— 按命盘从倪师《天纪》原话库里检索依据
 *
 * 模型自己「记得」的斗数知识不可核对。这里把 docs/tianji-ziwei 的 1848 条原话
 * （每条都有讲次与视频时间）按本盘的星曜、宫位、四化、格局打分，挑最相关的一批
 * 塞进系统提示词，要求模型的论断落在这些条目上并标出处。
 *
 * 只做检索，不做判断：选哪些条目由下面的打分规则决定，怎么解读交给模型。
 * 同一张盘 + 同一个问题，检索结果永远相同。
 */
import 'server-only';
import type { Palace, Star, ZiweiChart } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns';
import { sanfangSizheng } from '@/lib/ziwei/chart-context';
import { TIANJI_CORPUS, type TianjiEntry } from './tianji-corpus.generated';

/** 宫名（iztro 口径，不带「宫」字，命宫除外） */
type PalaceKey = '命宫' | '兄弟' | '夫妻' | '子女' | '财帛' | '疾厄' | '迁移' | '仆役' | '官禄' | '田宅' | '福德' | '父母';

/** 用户问题 → 重点宫位。越南语与中文都认；没命中就只按命宫三方检索 */
const TOPICS: { palace: PalaceKey; re: RegExp }[] = [
  { palace: '夫妻', re: /hôn nhân|vợ|chồng|tình duyên|tình cảm|người yêu|kết hôn|lấy (vợ|chồng)|婚|夫妻|配偶|感情|桃花|恋爱/i },
  { palace: '官禄', re: /sự nghiệp|công việc|nghề|thăng tiến|công danh|kinh doanh|事业|工作|官禄|职业|升迁/i },
  { palace: '财帛', re: /tiền|tài chính|tài lộc|giàu|thu nhập|của cải|财|钱|收入|富/i },
  { palace: '疾厄', re: /sức khỏe|sức khoẻ|bệnh|ốm|健康|疾|病|身体/i },
  { palace: '子女', re: /con cái|con trai|con gái|sinh con|có con|子女|孩子|儿子|女儿/i },
  { palace: '父母', re: /cha mẹ|bố mẹ|phụ mẫu|父母|爸妈/i },
  { palace: '兄弟', re: /anh em|anh chị|chị em|兄弟|姐妹/i },
  { palace: '田宅', re: /nhà cửa|nhà đất|bất động sản|mua nhà|田宅|房子|房产/i },
  { palace: '仆役', re: /bạn bè|đồng nghiệp|cấp dưới|giao hữu|交友|朋友|仆役|同事/i },
  { palace: '迁移', re: /xuất ngoại|đi xa|định cư|di chuyển|thiên di|迁移|出国|外地/i },
  { palace: '福德', re: /phúc đức|tinh thần|hưởng thụ|福德|精神|享受/i },
];

const SHA = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];

/** 册名 → 提示词里的分组标题 */
const BOOK_LABEL: Record<string, string> = {
  '01-stars': '星曜',
  '02-palaces': '宫位',
  '03-patterns': '格局',
  '04-sihua': '四化',
  '05-illness': '疾厄',
  '07-methodology': '批命方法',
};

/** 方法论里与「怎么看这张盘」直接相关的几条小标题 */
const METHOD_H3 = ['看一个宫一定看三方四正与对面', '命好不如限好', '十年为主流年为辅'];

export interface KnowledgeOptions {
  /** 额外指定的重点宫位（合盘固定传夫妻 / 福德） */
  focus?: PalaceKey[];
  /** 用户这一轮的提问，用来推断重点宫位 */
  question?: string;
  /** 原话正文的字数上限（不含出处），默认 9000 */
  budget?: number;
  /** 条数上限，默认 70 */
  maxEntries?: number;
}

export interface KnowledgeResult {
  text: string;
  /** 选中的条目，按原语料顺序 */
  entries: TianjiEntry[];
  focus: PalaceKey[];
}

function palaceKey(name: string): string {
  return name === '命宫' ? name : name.replace(/宫$/, '');
}

/** 一宫「坐着」的星：主星（空宫用借来的）+ 吉煞 */
function seatedStars(p: Palace): { name: string; star?: Star }[] {
  const majors = p.stars.filter(s => s.type === 'major');
  const list: { name: string; star?: Star }[] = majors.length > 0
    ? majors.map(s => ({ name: s.name, star: s }))
    : (p.borrowedStars ?? []).map(name => ({ name }));
  for (const s of p.stars) if (s.type === 'lucky' || s.type === 'sha') list.push({ name: s.name, star: s });
  return list;
}

/** 01-stars 的 h2 是否在讲这颗星 */
function h2CoversStar(h2: string, star: string): boolean {
  if (h2.includes(star)) return true;
  return h2.startsWith('六杀') && SHA.includes(star);
}

/** patterns.ts 的格局名 → 语料里可能出现的写法（去掉「格」「入命」等尾巴） */
function patternNeedles(name: string): string[] {
  const core = name.replace(/(格|入命|三星会)$/, '');
  return core.length >= 2 ? [name, core] : [name];
}

interface Ctx {
  /** 星名 → 它在各张盘上落的宫与权重 */
  stars: Map<string, { palace: string; weight: number; bright?: string }[]>;
  /** 宫名 → 权重 */
  palaces: Map<string, number>;
  /** 生年四化：化X → 星与宫 */
  sihua: { kind: string; star: string; palace: string }[];
  patterns: string[];
  health: boolean;
  mingEmpty: boolean;
}

function addStar(ctx: Ctx, name: string, palace: string, weight: number, bright?: string) {
  const list = ctx.stars.get(name) ?? [];
  list.push({ palace, weight, bright });
  ctx.stars.set(name, list);
}

function buildCtx(charts: ZiweiChart[], focus: PalaceKey[]): Ctx {
  const ctx: Ctx = { stars: new Map(), palaces: new Map(), sihua: [], patterns: [], health: focus.includes('疾厄'), mingEmpty: false };
  const bump = (k: string, w: number) => ctx.palaces.set(k, Math.max(ctx.palaces.get(k) ?? 0, w));

  for (const chart of charts) {
    const sanfang = new Set(sanfangSizheng(chart, chart.mingGongBranch).map(p => p.branch));
    for (const p of chart.palaces) {
      const key = palaceKey(p.name);
      const isMing = p.branch === chart.mingGongBranch;
      const isFocus = focus.includes(key as PalaceKey);
      const w = isMing ? 6 : isFocus ? 5 : sanfang.has(p.branch) ? 3 : 0;
      if (isMing) { bump('命宫', 5); ctx.mingEmpty ||= !!p.isEmpty; }
      else if (isFocus) bump(key, 6);
      else if (sanfang.has(p.branch)) bump(key, 2);
      if (w > 0) for (const s of seatedStars(p)) addStar(ctx, s.name, key, w, s.star?.brightnessRaw);
      for (const s of p.stars) if (s.siHua) ctx.sihua.push({ kind: `化${s.siHua}`, star: s.name, palace: key });
    }
    try {
      for (const pat of detectPatterns(chart)) ctx.patterns.push(...patternNeedles(pat.name));
    } catch {
      /* 格局识别失败不影响检索其余部分 */
    }
  }
  return ctx;
}

function score(e: TianjiEntry, ctx: Ctx): number {
  switch (e.b) {
    case '01-stars': {
      if (e.h2 === '庙旺利陷') return 1;
      let best = 0;
      for (const [name, seats] of ctx.stars) {
        if (!h2CoversStar(e.h2, name)) continue;
        for (const seat of seats) {
          let s = seat.weight;
          if (e.q.includes(seat.palace)) s += 3;           // 原话正好在讲这颗星落这个宫
          if (seat.bright === '陷' && e.q.includes('陷')) s += 2;
          if ((seat.bright === '庙' || seat.bright === '旺') && /[庙旺]/.test(e.q)) s += 1;
          best = Math.max(best, s);
        }
      }
      return best;
    }
    case '02-palaces': {
      if (e.h2.startsWith('三方四正')) return ctx.mingEmpty ? 5 : 3;
      if (e.h2.startsWith('总论')) return 1;
      let best = 0;
      for (const [palace, w] of ctx.palaces) {
        if (!e.h2.startsWith(palace)) continue;
        let s = w;
        // 宫位条目里点到了本盘坐在这宫的星，相关度更高
        for (const [star, seats] of ctx.stars) if (seats.some(x => x.palace === palace) && e.q.includes(star)) s += 2;
        best = Math.max(best, s);
      }
      return best;
    }
    case '03-patterns': {
      if (e.h3 === '总格取舍') return ctx.patterns.length > 0 ? 3 : 0;
      return ctx.patterns.some(n => e.h3.includes(n) || e.q.includes(n)) ? 8 : 0;
    }
    case '04-sihua': {
      if (e.h2.startsWith('一、') || e.h2.startsWith('二、')) return 2;
      let best = 0;
      for (const h of ctx.sihua) {
        if (!e.h2.includes(h.kind)) continue;
        let s = 1;
        if (e.q.includes(h.star)) s += 4;
        if (e.q.includes(h.palace)) s += 2;
        best = Math.max(best, s);
      }
      return best;
    }
    case '05-illness':
      return ctx.health ? (e.h2.startsWith('⚠️') || e.h2.startsWith('与中医') ? 5 : 3) : 0;
    case '07-methodology':
      return e.h2 === '批命顺序与原则' && METHOD_H3.includes(e.h3) ? 2 : 0;
    default:
      return 0;
  }
}

export function detectFocus(question: string | undefined): PalaceKey[] {
  if (!question) return [];
  return TOPICS.filter(t => t.re.test(question)).map(t => t.palace);
}

function renderEntry(e: TianjiEntry): string {
  return `- 「${e.q}」（《天纪》${e.l} ${e.t}）${e.n ? `〔勘误：${e.n}〕` : ''}`;
}

/** 按命盘（单盘或合盘的两张）检索倪师原话 */
export function selectKnowledge(charts: ZiweiChart[], opts: KnowledgeOptions = {}): KnowledgeResult {
  const focus = [...new Set([...(opts.focus ?? []), ...detectFocus(opts.question)])];
  const budget = opts.budget ?? 9000;
  const maxEntries = opts.maxEntries ?? 70;
  const ctx = buildCtx(charts, focus);

  const ranked = TIANJI_CORPUS
    .map((e, i) => ({ e, i, s: score(e, ctx) }))
    // 太短的句子离开上下文就看不懂（「你当武官的话前途黯淡无光。」之类单独拿出来会误导）
    .filter(x => x.s > 0 && x.e.q.length >= 16)
    .sort((a, b) => b.s - a.s || a.i - b.i);

  // 每个小类设上限，免得一颗星的 40 多条把别的挤掉；重点宫位放宽
  const perGroup = new Map<string, number>();
  const picked: typeof ranked = [];
  let used = 0;
  for (const x of ranked) {
    if (picked.length >= maxEntries) break;
    const group = `${x.e.b}|${x.e.h2}`;
    const cap = x.e.b === '02-palaces' && focus.some(f => x.e.h2.startsWith(f)) ? 14 : 8;
    const n = perGroup.get(group) ?? 0;
    if (n >= cap || used + x.e.q.length > budget) continue;
    perGroup.set(group, n + 1);
    used += x.e.q.length;
    picked.push(x);
  }
  picked.sort((a, b) => a.i - b.i);

  // 同一小类的条目散在不同讲次里，按小类归拢；小类之间按首次出现的先后排
  const groups = new Map<string, string[]>();
  for (const { e } of picked) {
    const key = `${BOOK_LABEL[e.b] ?? e.b} · ${e.h2}${e.h3 && e.b === '03-patterns' ? ` · ${e.h3}` : ''}`;
    const list = groups.get(key) ?? [];
    list.push(renderEntry(e));
    groups.set(key, list);
  }
  const text = [...groups].map(([k, rows]) => `### ${k}\n${rows.join('\n')}`).join('\n\n');

  return {
    text: picked.length > 0 ? text : '（知识库里没有检索到与本盘直接相关的倪师原话。）',
    entries: picked.map(x => x.e),
    focus,
  };
}
