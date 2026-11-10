/**
 * lib/ai/interp-dataset —— 按命盘查上游「13 维解读数据集 v4.0」的确定性解读正文
 *
 * 数据源按优先级（都关掉时返回 not-configured，调用方退回纯 AI 流程）：
 *
 *   1. ZIWEI_INTERP_DIR=/path/to/out        本地目录（scripts/dataset/pack-interp-v4.ts 的 --out）
 *   2. R2_ACCOUNT_ID / R2_BUCKET /          Cloudflare R2 私有桶（同样是 pack 后的每天一个对象），
 *      R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY   服务端用只读令牌签名 GET
 *   3. 默认：直接读上游 GitHub release      不用任何存储账号。按年下载约 2MB 的
 *      year-YYYY.jsonl.zst（整份留在内存，最多 4 年），用 Node 自带 zstd 流式解压，
 *      扫到这一天的 24 行就停。实测解压扫描：12 月 31 日最坏约 700MB、1–2 秒、峰值 RSS 约 240MB；
 *      下载本身 1.5–16 秒不等（GitHub 时快时慢）。设 ZIWEI_INTERP_SOURCE=off 可关掉这一档。
 *
 * 不管哪个源，一次都读入当天 24 张盘（12 时辰 × 男女）放进进程内缓存——
 * 同一个人点不同标签页、或同一天换性别换时辰，都不再读第二次。
 */
import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, pipeline, type Transform } from 'node:stream';
import { promisify } from 'node:util';
import * as zlib from 'node:zlib';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import {
  INTERP_DATASET, buildInterpKey,
  type InterpChartEntry, type InterpDayPack, type InterpKey,
} from '@/lib/ziwei/interp-dataset';
import { r2ObjectUrl, signS3Request } from '@/lib/storage/r2-sigv4';

const unbrotli = promisify(zlib.brotliDecompress);

export type InterpMissReason =
  | 'invalid'          // 排盘信息本身不合法
  | 'out-of-range'     // 1950–2026 以外
  | 'not-configured'   // 数据源全部关掉了
  | 'missing'          // 数据源里没有这一天 / 这一张盘 / 这个维度
  | 'error';           // 网络、解压、格式错误

export type InterpLookup =
  | { ok: true; key: InterpKey; topic: TopicKey; mainStar: string; text: string }
  | { ok: false; reason: InterpMissReason; key?: InterpKey };

/** 当天 24 张盘：键 `${时辰}-${性别}`。整天不存在返回 null，其余错误直接抛 */
export type DaySource = (key: InterpKey) => Promise<Record<string, InterpChartEntry> | null>;

/** pack 格式的对象读取器：返回压缩字节；不存在返回 null */
export type DayLoader = (path: string) => Promise<Buffer | null>;

const R2_TIMEOUT_MS = 4000;
const RELEASE_TIMEOUT_MS = 45000;
const RELEASE_BASE = `https://github.com/Renhuai123/ziwei-doushu/releases/download/${INTERP_DATASET.tag}`;

// ── 源 1/2：pack 后的每日对象 ─────────────────────────────────

/** 把 DayLoader（读 pack 对象字节）包成 DaySource */
export function packSource(loader: DayLoader): DaySource {
  return async key => {
    const buf = await loader(key.path);
    if (!buf) return null;
    const pack = JSON.parse((await unbrotli(buf)).toString('utf8')) as InterpDayPack;
    if (pack.v !== INTERP_DATASET.packVersion || pack.d !== key.date || typeof pack.charts !== 'object') {
      throw new Error(`对象格式不符：${key.path}`);
    }
    return pack.charts;
  };
}

function dirLoader(dir: string): DayLoader {
  return async path => {
    try {
      return await readFile(join(dir, path));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  };
}

function r2Loader(cfg: { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string }): DayLoader {
  return async path => {
    const url = r2ObjectUrl(cfg.accountId, cfg.bucket, path);
    const headers = signS3Request({ method: 'GET', url, region: 'auto' }, cfg);
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(R2_TIMEOUT_MS), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 GET ${path} → HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
}

// ── 源 3：上游 GitHub release 的年文件，流式扫描 ─────────────

interface UpstreamRow { k: string; h: number; g: string; ms?: string; c: Record<string, string> }

function toEntry(row: UpstreamRow): InterpChartEntry {
  const c: InterpChartEntry['c'] = {};
  for (const [t, v] of Object.entries(row.c ?? {})) if (typeof v === 'string') c[t as TopicKey] = v;
  return { ms: row.ms ?? '', c };
}

/**
 * 在上游 JSON Lines（已解压）的字节流里找出某一天的全部行。
 * 上游每行以 `{"k":"YYYY-MM-DD-时辰-性别"` 开头、按日期排序，同一天的 24 行连在一起：
 * 先按字节找到这一天的第一行，然后逐行收，遇到别的日期就停——不必解析其余几十万行。
 */
export async function scanDayLines(
  chunks: AsyncIterable<Buffer>,
  date: string,
): Promise<Record<string, InterpChartEntry> | null> {
  const needle = Buffer.from(`{"k":"${date}-`);
  const out: Record<string, InterpChartEntry> = {};
  let found = false;
  let acc: Buffer = Buffer.alloc(0);

  /** 处理 acc 里的完整行；返回 true 表示这一天已经收完 */
  const drain = (final: boolean): boolean => {
    for (;;) {
      const nl = acc.indexOf(10);
      if (nl < 0 && !final) return false;
      const line = nl < 0 ? acc : acc.subarray(0, nl);
      acc = nl < 0 ? Buffer.alloc(0) : acc.subarray(nl + 1);
      if (line.length === 0) { if (nl < 0) return true; continue; }
      if (line.indexOf(needle) !== 0) return true;
      const row = JSON.parse(line.toString('utf8')) as UpstreamRow;
      out[`${row.h}-${row.g}`] = toEntry(row);
      if (nl < 0) return true;
    }
  };

  for await (const chunk of chunks) {
    acc = acc.length ? Buffer.concat([acc, chunk]) : chunk;
    if (!found) {
      const i = acc.indexOf(needle);
      if (i < 0) {
        // 留一截尾巴，防止目标串正好被切在两个 chunk 之间
        acc = acc.subarray(Math.max(0, acc.length - needle.length + 1));
        continue;
      }
      found = true;
      acc = acc.subarray(i);
    }
    if (drain(false)) return out;
  }
  if (found) drain(true);
  return found ? out : null;
}

/** @types/node 20 还没有 zstd 的声明，运行时 Node ≥ 22.15 才有 */
function createZstd(): Transform {
  const z = zlib as unknown as {
    createZstdDecompress?: (o: { params: Record<number, number> }) => Transform;
    constants: { ZSTD_d_windowLogMax?: number };
  };
  if (!z.createZstdDecompress || z.constants.ZSTD_d_windowLogMax === undefined) {
    throw new Error(`当前 Node ${process.version} 没有内置 zstd（需要 ≥ 22.15）`);
  }
  // 上游用 zstd --long=27 压缩，窗口放到 2^27 才解得开
  return z.createZstdDecompress({ params: { [z.constants.ZSTD_d_windowLogMax]: 27 } });
}

/** 把 zstd 压缩的字节流解压后交给 scanDayLines；扫完立即断开下载 */
export async function scanZstdForDay(
  compressed: Readable,
  date: string,
): Promise<Record<string, InterpChartEntry> | null> {
  const z = createZstd();
  pipeline(compressed, z, () => { /* 错误由下面的 for-await 抛出 */ });
  try {
    return await scanDayLines(z, date);
  } finally {
    compressed.destroy();
    z.destroy();
  }
}

/**
 * 年文件（压缩后约 2MB）整份留在内存里，同一年的其他日子不用再下载——
 * GitHub release 的下载速度时快时慢（实测同一个文件 1.5–16 秒），解压扫描本身只要 1–2 秒。
 */
const YEAR_CACHE_MAX = 4;
const yearFiles = new Map<number, Promise<Buffer | null>>();

function releaseYearFile(base: string, year: number): Promise<Buffer | null> {
  const hit = yearFiles.get(year);
  if (hit) {
    yearFiles.delete(year);
    yearFiles.set(year, hit);
    return hit;
  }
  const p = (async () => {
    const res = await fetch(`${base}/year-${year}.jsonl.zst`, {
      signal: AbortSignal.timeout(RELEASE_TIMEOUT_MS), cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub release year-${year} → HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  })();
  yearFiles.set(year, p);
  if (yearFiles.size > YEAR_CACHE_MAX) yearFiles.delete(yearFiles.keys().next().value as number);
  // 失败的不留，下次重试
  p.catch(() => { if (yearFiles.get(year) === p) yearFiles.delete(year); });
  return p;
}

function releaseSource(base = RELEASE_BASE): DaySource {
  return async key => {
    const file = await releaseYearFile(base, key.year);
    if (!file) return null;
    return scanZstdForDay(Readable.from([file]), key.date);
  };
}

/** 按环境变量挑数据源；ZIWEI_INTERP_SOURCE=off 且没配本地目录与 R2 时返回 null */
export function sourceFromEnv(env: NodeJS.ProcessEnv = process.env): DaySource | null {
  if (env.ZIWEI_INTERP_DIR) return packSource(dirLoader(env.ZIWEI_INTERP_DIR));
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (R2_ACCOUNT_ID && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    return packSource(r2Loader({
      accountId: R2_ACCOUNT_ID, bucket: R2_BUCKET,
      accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY,
    }));
  }
  if (env.ZIWEI_INTERP_SOURCE === 'off') return null;
  return releaseSource();
}

// ── 进程内 LRU：键 = 上游 k，值 = 这一张盘（13 维约 80KB），null 表示确认不存在 ──
const CACHE_MAX = 240;
const cache = new Map<string, InterpChartEntry | null>();
/** 同一天的并发请求（标签页的原文请求与解读请求常常同时到）只读一次 */
const inflight = new Map<string, Promise<void>>();

function remember(k: string, v: InterpChartEntry | null): void {
  cache.delete(k);
  cache.set(k, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

/** 测试用 */
export function clearInterpCache(): void {
  cache.clear();
  inflight.clear();
  yearFiles.clear();
}

async function loadChart(key: InterpKey, source: DaySource): Promise<InterpChartEntry | null> {
  if (!cache.has(key.key)) {
    let p = inflight.get(key.date);
    if (!p) {
      p = (async () => {
        const day = await source(key);
        for (const [slot, entry] of Object.entries(day ?? {})) remember(`${key.date}-${slot}`, entry);
      })();
      inflight.set(key.date, p);
      p.finally(() => inflight.delete(key.date)).catch(() => {});
    }
    await p;
    if (!cache.has(key.key)) remember(key.key, null);
  }
  const v = cache.get(key.key) ?? null;
  remember(key.key, v);
  return v;
}

/**
 * 查一张盘某个维度的正文。不会抛错：任何失败都折成 { ok:false, reason }，
 * 解读接口照常走 AI 流程。
 *
 * opts.source / opts.loader 供测试注入；都不传时按环境变量挑。
 */
export async function lookupInterp(
  birth: { year: number; month: number; day: number; hour: number; gender: string },
  topic: TopicKey,
  opts: { source?: DaySource | null; loader?: DayLoader } = {},
): Promise<InterpLookup> {
  const k = buildInterpKey(birth);
  if (!k.ok) return { ok: false, reason: k.reason };
  const source = opts.loader ? packSource(opts.loader)
    : opts.source !== undefined ? opts.source
    : sourceFromEnv();
  if (!source) return { ok: false, reason: 'not-configured', key: k.key };
  try {
    const entry = await loadChart(k.key, source);
    const text = entry?.c[topic];
    if (!entry || !text) return { ok: false, reason: 'missing', key: k.key };
    return { ok: true, key: k.key, topic, mainStar: entry.ms, text };
  } catch (err) {
    console.error('[interp-dataset] lookup failed:', k.key.key, err);
    return { ok: false, reason: 'error', key: k.key };
  }
}

/**
 * 给解读接口用：最多等 ms 毫秒。超时就先返回 { ok:false, reason:'timeout' }，让回答照常走 AI 流程；
 * 后台的读取不取消，读完进缓存，下一次点标签页就能命中。
 */
export async function lookupInterpWithin(
  birth: Parameters<typeof lookupInterp>[0],
  topic: TopicKey,
  ms: number,
  opts: Parameters<typeof lookupInterp>[2] = {},
): Promise<InterpLookup | { ok: false; reason: 'timeout' }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<{ ok: false; reason: 'timeout' }>(resolve => {
    timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), ms);
  });
  try {
    return await Promise.race([lookupInterp(birth, topic, opts), late]);
  } finally {
    clearTimeout(timer);
  }
}
