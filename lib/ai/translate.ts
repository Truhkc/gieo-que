/**
 * lib/ai/translate —— 不经 AI，把数据集的中文解读机器翻译成越南语（Google 翻译网页端接口）
 *
 * 用的是 Google 翻译网页版的公开接口 translate.googleapis.com/translate_a/single?client=gtx，
 * 不需要 API key，GitHub 上很多翻译库都这么做。代价要讲清楚：
 *   - 这不是 Google 的正式 API，违反其服务条款，随时可能限流或封掉 Vercel 的出口 IP；
 *   - 只在没配 AI 的时候用（见 app/api/interpret/route.ts），配了 AI 就让模型转述，质量好得多。
 * 任何失败都返回 null，调用方退回显示中文原文。
 *
 * 机器翻译最大的问题是专名：武曲会被译成 "Wuqu"，庙旺译成「兴旺的寺庙」，四化译成「四个现代化」；
 * 就算先换成越南文，Google 也会把 "Phu Thê" 改成 "Phú Thê"、"Tham Lang" 改成 "Thẩm Lãng"。
 * 所以发出去之前把专名换成占位符 ZQ<n>Q（Google 原样保留这种记号），译完再换回汉越音。
 * 专名表与界面用的是同一张（lib/i18n/terms.ts）。小节标题按固定对照表直接给越南文。
 */
import 'server-only';
import {
  VI_BRANCHES, VI_BRIGHTNESS, VI_PALACES, VI_PATTERNS, VI_SIHUA, VI_STARS,
} from '@/lib/i18n/terms';

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t';
/** 单次请求的原文上限（字符） */
const CHUNK_CHARS = 1800;
const TIMEOUT_MS = 12000;

/** 数据集里出现过的全部小节标题（抽样统计 13 个维度得出） */
const HEADERS: Record<string, string> = {
  一句话定调: 'Một câu định tính',
  核心论断: 'Luận đoán cốt lõi',
  命盘推演: 'Suy diễn lá số',
  三方四正联动: 'Liên động tam phương tứ chính',
  命盘依据: 'Căn cứ trên lá số',
  经典出处: 'Xuất xứ kinh điển',
  '四化路径分析 · 落到你这盘': 'Đường đi Tứ Hoá · trên lá số của bạn',
  '四化路径 · 你这盘': 'Đường đi Tứ Hoá · lá số của bạn',
  '⚠️ 风险提醒': '⚠️ Lưu ý rủi ro',
  针对你的命盘: 'Riêng cho lá số của bạn',
  '年干四化·关键宫位影响': 'Tứ Hoá can năm · ảnh hưởng tới các cung then chốt',
  命格总览: 'Tổng quan mệnh cách',
  '身宫 · 后天追求': 'Cung Thân · điều theo đuổi hậu thiên',
  性格总览: 'Tổng quan tính cách',
  感情总览: 'Tổng quan tình cảm',
  事业总览: 'Tổng quan sự nghiệp',
  财运总览: 'Tổng quan tài vận',
  健康总览: 'Tổng quan sức khoẻ',
  '倪师子午流注 · 宫位取象（流派参考）': 'Tý Ngọ lưu chú của thầy Nghê · tượng của cung (tham khảo lưu phái)',
  兄弟总览: 'Tổng quan anh chị em',
  子女总览: 'Tổng quan con cái',
  迁移总览: 'Tổng quan xuất ngoại, di chuyển',
  人际总览: 'Tổng quan quan hệ xã hội',
  田宅总览: 'Tổng quan nhà cửa, điền sản',
  福德总览: 'Tổng quan phúc đức',
  父母总览: 'Tổng quan cha mẹ',
};

/** 星曜、四化、亮度、宫位以外的高频术语与书名 */
const EXTRA_TERMS: Record<string, string> = {
  紫微斗数全书: 'Tử Vi Đẩu Số Toàn Thư',
  紫微斗数全集: 'Tử Vi Đẩu Số Toàn Tập',
  紫微斗数: 'Tử Vi Đẩu Số',
  骨髓赋: 'Cốt Tuỷ Phú',
  太微赋: 'Thái Vi Phú',
  诸星问答论: 'Chư Tinh Vấn Đáp Luận',
  全书: 'Toàn Thư',
  天纪: 'Thiên Kỷ',
  倪海厦: 'Nghê Hải Hạ',
  倪师: 'thầy Nghê',
  三方四正: 'tam phương tứ chính',
  年干四化: 'Tứ Hoá can năm',
  生年四化: 'Tứ Hoá năm sinh',
  本命四化: 'Tứ Hoá bản mệnh',
  四化: 'Tứ Hoá',
  年干: 'can năm',
  大限: 'Đại hạn',
  流年: 'Lưu niên',
  小限: 'Tiểu hạn',
  本宫: 'bản cung',
  对宫: 'cung đối',
  三合: 'tam hợp',
  同宫: 'đồng cung',
  命盘: 'lá số',
  命主: 'mệnh chủ',
  身宫: 'cung Thân',
  空宫: 'cung trống',
  煞星: 'sát tinh',
  吉星: 'cát tinh',
  主星: 'chính tinh',
  六吉星: 'lục cát tinh',
  六煞星: 'lục sát tinh',
  正科桃花: 'chính khoa đào hoa',
  桃花: 'đào hoa',
  庙旺: 'Miếu Vượng',
  落陷: 'Hãm địa',
  羊陀: 'Kình Đà',
  火铃: 'Hoả Linh',
  空劫: 'Không Kiếp',
  辅弼: 'Tả Hữu',
  昌曲: 'Xương Khúc',
  魁钺: 'Khôi Việt',
  杀破狼: 'Sát Phá Tham',
  机月同梁: 'Cơ Nguyệt Đồng Lương',
  子午流注: 'Tý Ngọ lưu chú',
  待核: 'chưa xác minh',
  校勘: 'hiệu khám',
};

const BRANCH_CHARS = Object.keys(VI_BRANCHES).join('');

interface Glossary {
  /** 普通词，长词优先 */
  words: [string, string][];
  /** 需要看上下文的：宫名单用、地支单字 */
  patterns: [RegExp, (m: string) => string][];
}

function buildGlossary(): Glossary {
  const words = new Map<string, string>();
  const add = (zh: string, v: string) => { if (zh.length >= 2) words.set(zh, v); };

  for (const [zh, v] of Object.entries(VI_STARS)) add(zh, v);
  for (const [zh, v] of Object.entries(VI_PATTERNS)) add(zh, v);
  for (const [zh, v] of Object.entries(EXTRA_TERMS)) add(zh, v);
  for (const [h, v] of Object.entries(VI_SIHUA)) add(`化${h}`, `Hoá ${v}`);
  for (const [b, v] of Object.entries(VI_BRIGHTNESS)) {
    words.set(`（${b}）`, `(${v})`);
    words.set(`(${b})`, `(${v})`);
  }
  for (const [zh, v] of Object.entries(VI_PALACES)) {
    const bare = zh.replace(/宫$/, '');
    add(`${bare}宫`, `cung ${v}`);
    add(`${bare}三合`, `tam hợp của cung ${v}`);
    add(`${bare}对宫`, `cung đối của cung ${v}`);
  }

  const palaceAlt = Object.keys(VI_PALACES).map(zh => zh.replace(/宫$/, '')).join('|');
  const palaceVi = (name: string) => {
    const bare = name.replace(/宫$/, '');
    return VI_PALACES[bare] ?? VI_PALACES[`${bare}宫`] ?? name;
  };
  const patterns: Glossary['patterns'] = [
    // 入夫妻（宫）/ 落福德 / 坐命：动词保留中文给 Google 译，宫名（连同可选的「宫」字）走占位符
    [new RegExp(`[入落坐守居在](?:${palaceAlt})宫?`, 'g'), m => `cung ${palaceVi(m.slice(1))}`],
    // 「· 夫妻」「夫妻 ·」：标题行里的宫名
    [new RegExp(`(?<=[·・]\\s?)(${palaceAlt})|(${palaceAlt})(?=\\s?[·・])`, 'g'), m => `cung ${palaceVi(m)}`],
    // 地支单字：「在丑、未」「亥、子」「落子宫」；「妻子、」这种普通词里的「子」不动
    [new RegExp(
      `(?<=[在于落坐居、])[${BRANCH_CHARS}](?=[、，。；）)\\s宫]|$)|(?<=^|[\\s（(：:在于])[${BRANCH_CHARS}](?=、)`,
      'gm',
    ), m => VI_BRANCHES[m] ?? m],
  ];
  return { words: [...words.entries()].sort((a, b) => b[0].length - a[0].length), patterns };
}

let glossary: Glossary | null = null;

const token = (i: number) => `ZQ${i}Q`;
const TOKEN_RE = /ZQ\s?(\d+)\s?Q/g;

/**
 * 把专名、标题换成占位符。返回送去翻译的文本与占位符表。
 * 「入」「落」这类动词保留中文，让 Google 译成 vào / rơi vào，宫名本身走占位符。
 */
export function protectTerms(text: string): { text: string; terms: string[] } {
  glossary ??= buildGlossary();
  const terms: string[] = [];
  const put = (vi: string) => {
    terms.push(vi);
    return ` ${token(terms.length - 1)} `;
  };

  // 1. 上下文规则（动词 + 宫名要先于普通词，否则「夫妻宫」会先被吃掉一半）
  const [verbPalace, ...restPatterns] = glossary.patterns;
  let out = text.replace(verbPalace[0], m => `${m[0]}${put(verbPalace[1](m))}`);
  // 2. 普通词，长词优先
  for (const [zh, v] of glossary.words) {
    if (out.includes(zh)) out = out.split(zh).join(put(v));
  }
  for (const [re, f] of restPatterns) out = out.replace(re, m => put(f(m)));
  return { text: out.replace(/[ \t]{2,}/g, ' '), terms };
}

/** 占位符换回汉越音，并收拾空格与标题格式 */
export function restoreTerms(text: string, terms: string[]): string {
  const restored = text.replace(TOKEN_RE, (m, n: string) => {
    const v = terms[Number(n)];
    return v === undefined ? m : ` ${v} `;
  });
  return repairMarkup(
    restored
      .split('\n')
      .map(line => line
        .replace(/（/g, ' (').replace(/）/g, ') ')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ ([,.;:!?)\]，。、；：！？）”」》])/g, '$1')
        .replace(/([(（\[“「《]) /g, '$1')
        .trimEnd())
      .map(fixStraightQuotes)
      .map(line => (/^\s*\*\*【.+】\*\*\s*$/.test(line) ? line.trim() : line))
      .join('\n'),
  );
}

/**
 * 直引号按出现顺序两两配对：开引号后、闭引号前不留空格，开引号前、闭引号后留一个空格。
 * 占位符换回来时两边补了空格，会变成「" Toàn Thư "」或「Thiên Phủ"tình yêu"」。
 */
export function fixStraightQuotes(line: string): string {
  const parts = line.split('"');
  if (parts.length < 3 || parts.length % 2 === 0) return line;
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    let p = parts[i];
    if (i % 2 === 1) {
      out += `"${p.trim()}"`;
      continue;
    }
    if (i > 0) p = p.replace(/^\s+/, '');
    if (i < parts.length - 1) p = p.replace(/\s+$/, '');
    const lead = i > 0 && p !== '' && !/^[,.;:!?)\]，。、；：！？）”」》—]/.test(p) ? ' ' : '';
    const trail = i < parts.length - 1 && p !== '' && !/[(（\[“「《—]$/.test(p) ? ' ' : '';
    out += lead + p + trail;
  }
  return out;
}

/** 译文的标题与粗体修回前端认的格式 */
export function repairMarkup(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // **[Tổng quan]** / ** [Tổng quan] ** → **【Tổng quan】**
      const h = line.match(/^\s*\*\*\s*[\[【]\s*(.+?)\s*[\]】]\s*\*\*\s*$/);
      if (h) return `**【${h[1]}】**`;
      return line.replace(/\*\*\s+([^*\n]+?)\*\*/g, '**$1**').replace(/\*\*([^*\n]+?)\s+\*\*/g, '**$1**');
    })
    .join('\n');
}

/** 按段落切块，每块不超过 max；单段太长再按句号切 */
export function chunkText(text: string, max = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let cur = '';
  const push = (piece: string) => {
    if (cur && cur.length + piece.length + 1 > max) {
      chunks.push(cur);
      cur = '';
    }
    cur = cur ? `${cur}\n${piece}` : piece;
  };
  for (const para of text.split('\n')) {
    if (para.length <= max) { push(para); continue; }
    for (const sentence of para.split(/(?<=[。！？；])/)) {
      for (let i = 0; i < sentence.length; i += max) push(sentence.slice(i, i + max));
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function translateChunk(q: string, fetchImpl: typeof fetch): Promise<string> {
  // 纯占位符 / 空行就别发了
  if (!/[一-鿿]/.test(q)) return q;
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ q }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Google Dịch HTTP ${res.status}`);
  const data = await res.json() as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Google Dịch trả về định dạng lạ');
  return (data[0] as unknown[])
    .map(seg => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
    .join('');
}

// 进程内缓存：同一张盘同一维度只译一次
const CACHE_MAX = 300;
const cache = new Map<string, string>();

/** 测试用 */
export function clearTranslateCache(): void {
  cache.clear();
}

/**
 * 中文 → 越南语。cacheKey 一般是「上游 k + 维度」。失败返回 null（并打日志）。
 */
export async function translateZhToVi(
  text: string,
  opts: { cacheKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  if (opts.cacheKey && cache.has(opts.cacheKey)) return cache.get(opts.cacheKey)!;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    // 已知小节标题按对照表直接给越南文，不送去翻译——单独一行的占位符会被 Google 弄坏
    const segments: { header?: string; body?: string }[] = [];
    for (const line of text.split('\n')) {
      const h = line.match(/^\*\*【(.+?)】\*\*$/);
      if (h && HEADERS[h[1]]) {
        segments.push({ header: `**【${HEADERS[h[1]]}】**` });
      } else if (segments.length && segments[segments.length - 1].body !== undefined) {
        segments[segments.length - 1].body += `\n${line}`;
      } else {
        segments.push({ body: line });
      }
    }

    const jobs: { seg: number; chunk: string; terms: string[] }[] = [];
    segments.forEach((s, seg) => {
      if (s.body === undefined) return;
      const { text: protectedText, terms } = protectTerms(s.body);
      for (const chunk of chunkText(protectedText)) jobs.push({ seg, chunk, terms });
    });

    // 最多 3 个并发，别一下子把接口打满
    const out: string[] = new Array(jobs.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
      for (let i = next++; i < jobs.length; i = next++) out[i] = await translateChunk(jobs[i].chunk, fetchImpl);
    }));

    const bodies = new Map<number, string[]>();
    jobs.forEach((j, i) => {
      const list = bodies.get(j.seg) ?? [];
      list.push(restoreTerms(out[i], j.terms));
      bodies.set(j.seg, list);
    });
    const result = segments
      .map((s, i) => s.header ?? (bodies.get(i) ?? [s.body ?? '']).join('\n'))
      .join('\n');
    if (opts.cacheKey) {
      cache.set(opts.cacheKey, result);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
    }
    return result;
  } catch (err) {
    console.error('[translate] Google Dịch failed:', err);
    return null;
  }
}
