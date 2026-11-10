/**
 * lib/ai/interp-dataset —— 按命盘查上游「13 维解读数据集 v4.0」的确定性解读正文
 *
 * 数据来源两选一（都没配就返回 not-configured，调用方退回纯 AI 流程）：
 *
 *   ZIWEI_INTERP_DIR=/path/to/out          本地目录（开发用），即 pack 脚本的 --out
 *   R2_ACCOUNT_ID / R2_BUCKET /            Cloudflare R2 私有桶，服务端用只读令牌签名 GET
 *   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 *
 * 对象格式与键见 lib/ziwei/interp-dataset.ts。每次查询只取当天一个对象（约 146KB），
 * 解压后只留下这一张盘的 13 维正文放进进程内缓存——同一个人点不同标签页不用重复下载。
 */
import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliDecompress } from 'node:zlib';
import { promisify } from 'node:util';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import {
  INTERP_DATASET, buildInterpKey,
  type InterpChartEntry, type InterpDayPack, type InterpKey,
} from '@/lib/ziwei/interp-dataset';
import { r2ObjectUrl, signS3Request } from '@/lib/storage/r2-sigv4';

const unbrotli = promisify(brotliDecompress);

export type InterpMissReason =
  | 'invalid'          // 排盘信息本身不合法
  | 'out-of-range'     // 1950–2026 以外
  | 'not-configured'   // 没配数据源
  | 'missing'          // 数据源里没有这一天 / 这一张盘 / 这个维度
  | 'error';           // 网络、解压、格式错误

export type InterpLookup =
  | { ok: true; key: InterpKey; topic: TopicKey; mainStar: string; text: string }
  | { ok: false; reason: InterpMissReason; key?: InterpKey };

/** 返回压缩后的对象字节；不存在时返回 null，其余错误直接抛 */
export type DayLoader = (path: string) => Promise<Buffer | null>;

const FETCH_TIMEOUT_MS = 4000;

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
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 GET ${path} → HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
}

/** 按环境变量挑数据源；都没配返回 null */
export function loaderFromEnv(env: NodeJS.ProcessEnv = process.env): DayLoader | null {
  if (env.ZIWEI_INTERP_DIR) return dirLoader(env.ZIWEI_INTERP_DIR);
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (R2_ACCOUNT_ID && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    return r2Loader({
      accountId: R2_ACCOUNT_ID, bucket: R2_BUCKET,
      accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY,
    });
  }
  return null;
}

// ── 进程内 LRU：键 = 上游 k，值 = 这一张盘（13 维约 80KB），null 表示确认不存在 ──
const CACHE_MAX = 200;
const cache = new Map<string, InterpChartEntry | null>();
const inflight = new Map<string, Promise<InterpChartEntry | null>>();

function remember(k: string, v: InterpChartEntry | null): void {
  cache.delete(k);
  cache.set(k, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

/** 测试用 */
export function clearInterpCache(): void {
  cache.clear();
  inflight.clear();
}

async function loadChart(key: InterpKey, loader: DayLoader): Promise<InterpChartEntry | null> {
  if (cache.has(key.key)) {
    const v = cache.get(key.key)!;
    remember(key.key, v);
    return v;
  }
  const pending = inflight.get(key.key);
  if (pending) return pending;

  const p = (async () => {
    const buf = await loader(key.path);
    if (!buf) return null;
    const pack = JSON.parse((await unbrotli(buf)).toString('utf8')) as InterpDayPack;
    if (pack.v !== INTERP_DATASET.packVersion || pack.d !== key.date || typeof pack.charts !== 'object') {
      throw new Error(`对象格式不符：${key.path}`);
    }
    // 当天其余 23 张盘也顺手放进缓存——同一天换性别、换时辰的盘很常见
    for (const [slot, entry] of Object.entries(pack.charts)) {
      if (slot !== key.slot) remember(`${key.date}-${slot}`, entry);
    }
    return pack.charts[key.slot] ?? null;
  })();
  inflight.set(key.key, p);
  try {
    const v = await p;
    remember(key.key, v);
    return v;
  } finally {
    inflight.delete(key.key);
  }
}

/**
 * 查一张盘某个维度的正文。不会抛错：任何失败都折成 { ok:false, reason }，
 * 解读接口照常走 AI 流程。
 */
export async function lookupInterp(
  birth: { year: number; month: number; day: number; hour: number; gender: string },
  topic: TopicKey,
  opts: { loader?: DayLoader | null } = {},
): Promise<InterpLookup> {
  const k = buildInterpKey(birth);
  if (!k.ok) return { ok: false, reason: k.reason };
  const loader = opts.loader !== undefined ? opts.loader : loaderFromEnv();
  if (!loader) return { ok: false, reason: 'not-configured', key: k.key };
  try {
    const entry = await loadChart(k.key, loader);
    const text = entry?.c[topic];
    if (!entry || !text) return { ok: false, reason: 'missing', key: k.key };
    return { ok: true, key: k.key, topic, mainStar: entry.ms, text };
  } catch (err) {
    console.error('[interp-dataset] lookup failed:', k.key.key, err);
    return { ok: false, reason: 'error', key: k.key };
  }
}
