/**
 * lib/ai/ratelimit —— 进程内滑动窗口限流
 *
 * 作用范围要说清楚：计数存在单个 Node 进程的内存里。
 *   - 自己跑 `next start` 或单容器部署：有效。
 *   - Serverless（Vercel 等）多实例或冷启动：每个实例一份计数，只能挡住最蠢的连点，
 *     挡不住有心的刷量。
 *
 * 真要防刷，把 check() 换成 Redis 实现（本仓库已有 ioredis 依赖）或上游 WAF。
 * 这里保持进程内，是为了零配置就能跑起来 —— 但别把它当安全边界。
 */
import 'server-only';

interface Window {
  hits: number[];
}

const buckets = new Map<string, Window>();

/** 定期清掉空桶，避免长跑进程里 Map 无限增长 */
let lastSweep = 0;
function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, w] of buckets) {
    if (w.hits.every(t => now - t >= windowMs)) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** 还剩几次 */
  remaining: number;
  /** 需要等多少秒才能再试（allowed 为 true 时是 0） */
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const w = buckets.get(key) ?? { hits: [] };
  w.hits = w.hits.filter(t => now - t < windowMs);

  if (w.hits.length >= limit) {
    buckets.set(key, w);
    const oldest = w.hits[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  w.hits.push(now);
  buckets.set(key, w);
  return { allowed: true, remaining: limit - w.hits.length, retryAfterSec: 0 };
}

/**
 * 取客户端标识。反代会覆写/追加 x-forwarded-for，取**第一个**才是原始客户端。
 * 注意：没有可信反代时这个头可由客户端伪造，所以限流只是减速带，不是认证。
 */
export function clientKey(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** 从环境变量读配额，缺省 每 5 分钟 20 次 */
export function rateLimitConfig(): { limit: number; windowMs: number } {
  const limit = Number.parseInt(process.env.AI_RATE_LIMIT ?? '', 10);
  const windowSec = Number.parseInt(process.env.AI_RATE_WINDOW_SEC ?? '', 10);
  return {
    limit: Number.isInteger(limit) && limit > 0 ? limit : 20,
    windowMs: (Number.isInteger(windowSec) && windowSec > 0 ? windowSec : 300) * 1000,
  };
}
