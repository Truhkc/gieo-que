/**
 * POST /api/heming —— 合盘 AI 分析（流式）
 *
 * 请求：{ chartA: ZiweiChart, chartB: ZiweiChart, question?: string }
 * 响应：与 /api/interpret 同一套 SSE 帧格式
 *
 * 调用方：app/heming/page.tsx
 *
 * 合盘的 prompt 比单盘重得多（两张盘 + 方法论 + 断语），所以 maxTokens 给到 6000，
 * 温度略低一点 —— 合盘要给评级，发挥空间越小越一致。
 */
import { buildHemingKnowledge, buildHemingSystem } from '@/lib/ai/prompts';
import { resolveProvider, streamChat, type ChatMessage } from '@/lib/ai/provider';
import { deltaStreamResponse, textAsDeltaStream } from '@/lib/ai/sse';
import { singleQuestion } from '@/lib/ai/messages';
import { HttpError, jsonError, rateLimitGuard, readJsonBody } from '@/lib/ai/http';
import { ChartInputError, sanitizeChart } from '@/lib/ziwei/chart-input';
import { buildHemingContext } from '@/lib/ziwei/chart-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TASK = '请按系统提示词给定的小节，对下面这两张命盘做合盘分析。';

export async function POST(req: Request): Promise<Response> {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  let system: string;
  let messages: ChatMessage[];

  try {
    const body = await readJsonBody(req);
    const chartA = sanitizeChart(body.chartA, 'chartA');
    const chartB = sanitizeChart(body.chartB, 'chartB');
    messages = singleQuestion(body.question, TASK);
    system = buildHemingSystem(
      buildHemingContext(chartA, chartB),
      buildHemingKnowledge(chartA, chartB),
    );
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    if (err instanceof ChartInputError) return jsonError(400, `命盘数据不合法：${err.message}`);
    console.error('[api/heming] bad request:', err);
    return jsonError(400, '请求无法处理');
  }

  const resolved = resolveProvider();
  if (!resolved.ok) {
    console.error('[api/heming] provider not configured:', resolved.reason);
    return textAsDeltaStream(
      `**【合盘 AI 分析尚未配置】**\n\n${resolved.reason}\n\n` +
        '双方的命盘已经在浏览器里用本仓库的排盘引擎算好了，可以分别到「排盘」页查看；' +
        '只有这段合盘分析需要配置模型。变量清单见仓库根目录的 `.env.example`。',
      { headers: { 'x-ai-config': 'missing' } },
    );
  }

  return deltaStreamResponse(
    streamChat({
      provider: resolved.provider,
      system,
      messages,
      maxTokens: 6000,
      temperature: 0.6,
      signal: req.signal,
    }),
  );
}
