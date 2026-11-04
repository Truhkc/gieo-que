/**
 * lib/ai/http —— 两个路由共用的入口检查
 */
import 'server-only';
import { checkRateLimit, clientKey, rateLimitConfig } from './ratelimit';

/** 请求体上限。单盘 JSON 约 20–40 KB，合盘翻倍，再留出对话历史的余量。 */
const MAX_BODY_BYTES = 1_000_000;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const declared = req.headers.get('content-length');
  if (declared && Number.parseInt(declared, 10) > MAX_BODY_BYTES) {
    throw new HttpError(413, `请求体过大（上限 ${MAX_BODY_BYTES} 字节）`);
  }

  const text = await req.text();
  // content-length 可以不发或撒谎，拿到实际字节数再查一次
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new HttpError(413, `请求体过大（上限 ${MAX_BODY_BYTES} 字节）`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, '请求体必须是 JSON 对象');
  }
  return parsed as Record<string, unknown>;
}

/** 超限时返回 429 Response，正常时返回 null */
export function rateLimitGuard(req: Request): Response | null {
  const { limit, windowMs } = rateLimitConfig();
  const result = checkRateLimit(clientKey(req), limit, windowMs);
  if (result.allowed) return null;
  return jsonError(429, `请求过于频繁，请 ${result.retryAfterSec} 秒后再试。`, {
    retryAfterSec: result.retryAfterSec,
  });
}
