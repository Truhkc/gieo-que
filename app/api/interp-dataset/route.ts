/**
 * GET /api/interp-dataset —— 一张盘某个维度的确定性解读原文（上游 13 维数据集 v4.0，中文）
 *
 *   /api/interp-dataset?y=1990&m=5&d=9&h=3&g=male&topic=love
 *
 * y/m/d 是排盘日（chart.birthInfo，已含子时换日），h 是时辰 0–11，g 是 male|female，
 * topic 是 13 维之一（lib/ziwei/interp-dataset.ts INTERP_TOPICS）。
 *
 * 响应：
 *   200 { ok: true,  key, topic, mainStar, text, attribution }
 *   200 { ok: false, reason: 'out-of-range' | 'not-configured' | 'missing' | 'error', attribution }
 *   400 { ok: false, reason: 'invalid' }
 *
 * 查不到也回 200：这是「没有原文可看」，不是请求出错，前端照常显示 AI 解读。
 * 命中时允许 CDN 缓存一天——同一个键的内容是确定的，换数据集版本时 key 前缀会跟着换。
 */
import { lookupInterp } from '@/lib/ai/interp-dataset';
import { rateLimitGuard } from '@/lib/ai/http';
import { DATASET_ATTRIBUTION, isInterpTopic } from '@/lib/ziwei/interp-dataset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: Record<string, unknown>, cache: string): Response {
  return new Response(JSON.stringify({ ...body, attribution: DATASET_ATTRIBUTION }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

export async function GET(req: Request): Promise<Response> {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  const q = new URL(req.url).searchParams;
  const num = (name: string) => {
    const v = q.get(name);
    return v !== null && /^\d{1,4}$/.test(v) ? Number(v) : NaN;
  };
  const topic = q.get('topic');
  if (!isInterpTopic(topic)) return json(400, { ok: false, reason: 'invalid' }, 'no-store');

  const result = await lookupInterp(
    { year: num('y'), month: num('m'), day: num('d'), hour: num('h'), gender: q.get('g') ?? '' },
    topic,
  );
  if (result.ok) {
    return json(200, {
      ok: true, key: result.key.key, topic, mainStar: result.mainStar, text: result.text,
    }, 'public, max-age=3600, s-maxage=86400');
  }
  return json(result.reason === 'invalid' ? 400 : 200, { ok: false, reason: result.reason }, 'no-store');
}
