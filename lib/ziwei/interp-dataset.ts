/**
 * lib/ziwei/interp-dataset —— 上游「13 维解读数据集 v4.0」的键与对象格式（纯函数，前后端、脚本共用）
 *
 * 数据集：Renhuai123/ziwei-doushu 的 GitHub release `v4.0-13d`
 *   674,976 张命盘（公历 1950–2026 每个真实日期 × 12 时辰 × 男女）× 13 维中文解读，
 *   由上游网站断语库确定性生成（不经 AI）。许可 CC BY 4.0，须署名；
 *   正文里嵌的倪海厦《天纪》原话不在这份授权内（见 DATASET_ATTRIBUTION）。
 *
 * 上游按年一个 zstd 文件发布（解压后共 57GB），线上没法直接用。
 * scripts/dataset/pack-interp-v4.ts 把它重新打包成「每天一个 brotli 压缩的 JSON」，
 * 每个对象装当天 24 张盘（12 时辰 × 男女），约 146KB，Node 自带 zlib 就能解。
 *
 * 取键口径：上游生成时**没有做真太阳时校正**，键是「排盘日 + 时辰」。
 * 本仓库 chart.birthInfo 的 year/month/day 已经是子时换日后的排盘日，hour 是 0–11 的时辰序号，
 * 正好对得上，直接拿来用。
 */
import type { TopicKey } from './db-analysis';

export const INTERP_DATASET = {
  /** 上游 release tag */
  tag: 'v4.0-13d',
  firstYear: 1950,
  lastYear: 2026,
  /** 对象存储里的前缀；换数据集版本时一起换，旧对象不会被误读 */
  prefix: 'v4',
  /** 对象格式版本（InterpDayPack.v） */
  packVersion: 1,
} as const;

/** 上游 c 字段的 13 个维度，与 TopicKey 一一对应 */
export const INTERP_TOPICS: readonly TopicKey[] = [
  'overview', 'personality', 'love', 'career', 'wealth', 'health',
  'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents',
];

export function isInterpTopic(x: unknown): x is TopicKey {
  return typeof x === 'string' && (INTERP_TOPICS as readonly string[]).includes(x);
}

/** 每天一个对象：charts 以 `${时辰}-${性别}` 为键，例如 "3-male" */
export interface InterpDayPack {
  v: number;
  tag: string;
  /** YYYY-MM-DD */
  d: string;
  charts: Record<string, InterpChartEntry>;
}

export interface InterpChartEntry {
  /** 上游 ms 字段：命宫主星（空宫时为借星或空串） */
  ms: string;
  /** 13 维 Markdown 正文 */
  c: Partial<Record<TopicKey, string>>;
}

export interface InterpKey {
  /** YYYY-MM-DD（排盘日） */
  date: string;
  year: number;
  hour: number;
  gender: 'male' | 'female';
  /** InterpDayPack.charts 里的键 */
  slot: string;
  /** 上游 k 字段：YYYY-MM-DD-<时辰>-<male|female> */
  key: string;
  /** 对象存储里的路径（相对前缀根） */
  path: string;
}

export type InterpKeyResult =
  | { ok: true; key: InterpKey }
  | { ok: false; reason: 'invalid' | 'out-of-range' };

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 某个排盘日对应的对象路径，例如 v4/1990/1990-05-09.json.br */
export function interpObjectPath(date: string): string {
  return `${INTERP_DATASET.prefix}/${date.slice(0, 4)}/${date}.json.br`;
}

/**
 * 由排盘信息算出数据集键。日期不存在、时辰越界、性别不对 → invalid；
 * 年份不在 1950–2026 → out-of-range（这种盘只能走 AI 原有流程）。
 */
export function buildInterpKey(b: {
  year: number; month: number; day: number; hour: number; gender: string;
}): InterpKeyResult {
  const { year, month, day, hour, gender } = b;
  if (![year, month, day, hour].every(Number.isInteger)) return { ok: false, reason: 'invalid' };
  if (gender !== 'male' && gender !== 'female') return { ok: false, reason: 'invalid' };
  if (hour < 0 || hour > 11 || month < 1 || month > 12 || day < 1) return { ok: false, reason: 'invalid' };
  // 用 UTC 往返校验日期真实存在（2 月 30 日之类会被 Date 进位）
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return { ok: false, reason: 'invalid' };
  }
  if (year < INTERP_DATASET.firstYear || year > INTERP_DATASET.lastYear) {
    return { ok: false, reason: 'out-of-range' };
  }
  const date = `${year}-${pad2(month)}-${pad2(day)}`;
  return {
    ok: true,
    key: {
      date, year, hour, gender,
      slot: `${hour}-${gender}`,
      key: `${date}-${hour}-${gender}`,
      path: interpObjectPath(date),
    },
  };
}

/** 页面与提示词共用的署名文字 */
export const DATASET_ATTRIBUTION = {
  name: '紫微斗数开源解读数据集 v4.0（13 维）',
  author: 'Renhuai123/ziwei-doushu',
  url: 'https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;
