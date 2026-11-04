/**
 * POST /api/interpret —— 单盘 AI 解读（流式）
 *
 * 请求：{ chart: ZiweiChart, messages: { role: 'user'|'assistant', content: string }[] }
 * 响应：text/event-stream，帧格式 `data: {"delta":{"text":"…"}}`，收尾 `data: [DONE]`
 *
 * 调用方：components/ChatPanel.tsx、components/InsightPanel.tsx
 *
 * 一个取舍：AI 没配好时这里返回 200 + 一帧说明文字，而不是 503。
 * 前端只对 404 有专门分支，其他非 2xx 统一显示「解读失败，请稍后重试」——
 * 那样开发者永远看不到真正的原因。配置缺失时额外带上 `x-ai-config: missing`
 * 响应头，方便监控区分。
 */
import { buildInterpretSystem } from '@/lib/ai/prompts';
import { resolveProvider, streamChat, type ChatMessage } from '@/lib/ai/provider';
import { deltaStreamResponse, textAsDeltaStream } from '@/lib/ai/sse';
import { MessageInputError, normalizeMessages } from '@/lib/ai/messages';
import { HttpError, jsonError, rateLimitGuard, readJsonBody } from '@/lib/ai/http';
import { ChartInputError, sanitizeChart } from '@/lib/ziwei/chart-input';
import { buildChartContext } from '@/lib/ziwei/chart-context';

// iztro / lunar-javascript 与 patterns.ts 的 'server-only' 都要求 Node 运行时
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 流式解读通常 30–60 秒。Vercel 免费档上限 60s，Pro 档可以调到 300。
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  let system: string;
  let messages: ChatMessage[];

  try {
    const body = await readJsonBody(req);
    const chart = sanitizeChart(body.chart);
    messages = normalizeMessages(body.messages);
    system = buildInterpretSystem(buildChartContext(chart));
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    if (err instanceof ChartInputError) return jsonError(400, `命盘数据不合法：${err.message}`);
    if (err instanceof MessageInputError) return jsonError(400, `对话内容不合法：${err.message}`);
    console.error('[api/interpret] bad request:', err);
    return jsonError(400, '请求无法处理');
  }

  const resolved = resolveProvider();
  if (!resolved.ok) {
    console.error('[api/interpret] provider not configured:', resolved.reason);
    return textAsDeltaStream(
      `**【AI 解读尚未配置】**\n\n${resolved.reason}\n\n` +
        '排盘、命盘展示、古籍阅读都不需要 API Key，现在就能用；' +
        '只有这一栏的 AI 解读需要你在 `.env.local` 里配好模型。\n\n' +
        '可选档位：`AI_PROVIDER=deepseek` / `anthropic` / `openai` / `mimo` / `custom`，' +
        '每档需要的变量见仓库根目录的 `.env.example`。',
      { headers: { 'x-ai-config': 'missing' } },
    );
  }

  return deltaStreamResponse(
    streamChat({
      provider: resolved.provider,
      system,
      messages,
      maxTokens: 4096,
      temperature: 0.7,
      // 用户关掉页面时，把中断传给上游，别继续烧 token
      signal: req.signal,
    }),
  );
}
