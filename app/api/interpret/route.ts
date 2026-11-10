/**
 * POST /api/interpret —— 单盘 AI 解读（流式）
 *
 * 请求：{ chart: ZiweiChart, messages: { role: 'user'|'assistant', content: string }[] }
 * 响应：text/event-stream，帧格式 `data: {"delta":{"text":"…"}}`，收尾 `data: [DONE]`
 *
 * 调用方：components/ChatPanel.tsx、components/InsightPanel.tsx
 *
 * 可选字段 topic（13 维之一，见 lib/ziwei/interp-dataset.ts）：带上时先去上游「13 维解读数据集 v4.0」
 * 查本盘这一维的确定性解读原文，作为提示词里的第一依据，模型负责转述成用户的语言并保留出处；
 * 查不到（1950–2026 以外、数据源没配、对象缺失）就照旧只靠倪师原话检索。
 * 命中情况写在响应头 `x-interp-dataset: hit | <原因>`（含 timeout：等了 10 秒没读完）。
 *
 * 一个取舍：AI 没配好时这里返回 200 + 一帧说明文字，而不是 503。
 * 前端只对 404 有专门分支，其他非 2xx 统一显示「解读失败，请稍后重试」——
 * 那样开发者永远看不到真正的原因。配置缺失时额外带上 `x-ai-config: missing`
 * 响应头，方便监控区分。
 */
import { buildInterpretSystem } from '@/lib/ai/prompts';
import { selectKnowledge } from '@/lib/ai/knowledge';
import { resolveProvider, streamChat, type ChatMessage } from '@/lib/ai/provider';
import { deltaStreamResponse, textAsDeltaStream } from '@/lib/ai/sse';
import { MessageInputError, normalizeMessages } from '@/lib/ai/messages';
import { HttpError, jsonError, rateLimitGuard, readJsonBody, readLocale } from '@/lib/ai/http';
import { ChartInputError, sanitizeChart } from '@/lib/ziwei/chart-input';
import { buildChartContext } from '@/lib/ziwei/chart-context';
import { lookupInterpWithin } from '@/lib/ai/interp-dataset';
import { isInterpTopic } from '@/lib/ziwei/interp-dataset';
import { TOPIC_LABEL } from '@/lib/ziwei/db-analysis';

// iztro / lunar-javascript 与 patterns.ts 的 'server-only' 都要求 Node 运行时
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 流式解读通常 30–60 秒。Vercel 免费档上限 60s，Pro 档可以调到 300。
export const maxDuration = 60;

/** Câu báo lỗi khi upstream gãy giữa dòng, theo ngôn ngữ giao diện */
const STREAM_ERROR: Record<'vi' | 'zh', string> = {
  vi: '\n\n(Gián đoạn: API mô hình báo lỗi, vui lòng thử lại sau.)',
  zh: '\n\n（生成中断：上游模型接口出错，请稍后重试。）',
};

export async function POST(req: Request): Promise<Response> {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  let system: string;
  let messages: ChatMessage[];
  let locale: 'vi' | 'zh' = 'vi';
  let datasetStatus = 'none';

  try {
    const body = await readJsonBody(req);
    locale = readLocale(body);
    const chart = sanitizeChart(body.chart);
    messages = normalizeMessages(body.messages);
    // 按最后一问挑重点宫位（问婚姻就多带夫妻宫的原话），再从倪师原话库里检索依据
    const question = [...messages].reverse().find(m => m.role === 'user')?.content;
    let dataset: { label: string; text: string } | undefined;
    if (isInterpTopic(body.topic)) {
      // 数据集默认从 GitHub release 现读，偶尔很慢：最多等 10 秒，晚了就先按 AI 流程答
      const hit = await lookupInterpWithin(chart.birthInfo, body.topic, 10_000);
      datasetStatus = hit.ok ? 'hit' : hit.reason;
      if (hit.ok) dataset = { label: TOPIC_LABEL[body.topic], text: hit.text };
    }
    system = buildInterpretSystem(
      buildChartContext(chart),
      selectKnowledge([chart], { question }).text,
      dataset,
    );
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    if (err instanceof ChartInputError) return jsonError(400, `命盘数据不合法：${err.message}`);
    if (err instanceof MessageInputError) return jsonError(400, `对话内容不合法：${err.message}`);
    console.error('[api/interpret] bad request:', err);
    return jsonError(400, '请求无法处理');
  }

  const resolved = resolveProvider();
  if (!resolved.ok) {
    console.error('[api/interpret] provider not configured:', resolved.reason.zh);
    return textAsDeltaStream(
      locale === 'zh'
        ? `**【AI 解读尚未配置】**\n\n${resolved.reason.zh}\n\n` +
          '排盘、命盘展示、古籍阅读都不需要 API Key，现在就能用；' +
          '只有这一栏的 AI 解读需要你在 `.env.local` 里配好模型。\n\n' +
          '可选档位：`AI_PROVIDER=deepseek` / `anthropic` / `openai` / `mimo` / `custom`，' +
          '每档需要的变量见仓库根目录的 `.env.example`。'
        : `**【Chưa cấu hình AI】**\n\n${resolved.reason.vi}\n\n` +
          'Lập lá số, xem bàn 12 cung và đọc cổ tịch đều không cần API Key — dùng được ngay. ' +
          'Chỉ riêng ô giải đoán này cần bạn khai báo mô hình trong `.env.local`.\n\n' +
          'Các lựa chọn: `AI_PROVIDER=deepseek` / `anthropic` / `openai` / `mimo` / `custom`. ' +
          'Biến cần cho từng loại xem ở `.env.example` tại thư mục gốc.',
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
    { errorText: STREAM_ERROR[locale], headers: { 'x-interp-dataset': datasetStatus } },
  );
}
