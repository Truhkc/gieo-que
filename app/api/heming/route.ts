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
import { HttpError, jsonError, rateLimitGuard, readJsonBody, readLocale } from '@/lib/ai/http';
import { ChartInputError, sanitizeChart } from '@/lib/ziwei/chart-input';
import { buildHemingContext } from '@/lib/ziwei/chart-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;


/** Câu báo lỗi khi upstream gãy giữa dòng, theo ngôn ngữ giao diện */
const STREAM_ERROR: Record<'vi' | 'zh', string> = {
  vi: '\n\n(Gián đoạn: API mô hình báo lỗi, vui lòng thử lại sau.)',
  zh: '\n\n（生成中断：上游模型接口出错，请稍后重试。）',
};

const TASK = '请按系统提示词给定的小节，对下面这两张命盘做合盘分析。';

export async function POST(req: Request): Promise<Response> {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  let system: string;
  let messages: ChatMessage[];
  let locale: 'vi' | 'zh' = 'vi';

  try {
    const body = await readJsonBody(req);
    locale = readLocale(body);
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
    console.error('[api/heming] provider not configured:', resolved.reason.zh);
    return textAsDeltaStream(
      locale === 'zh'
        ? `**【合盘 AI 分析尚未配置】**\n\n${resolved.reason.zh}\n\n` +
          '双方的命盘已经在浏览器里用本仓库的排盘引擎算好了，可以分别到「排盘」页查看；' +
          '只有这段合盘分析需要配置模型。变量清单见仓库根目录的 `.env.example`。'
        : `**【Chưa cấu hình AI hợp bàn】**\n\n${resolved.reason.vi}\n\n` +
          'Lá số của cả hai người đã được engine trong repo tính xong ngay trên trình duyệt, ' +
          'có thể xem riêng ở trang «Lập lá số». Chỉ phần phân tích hợp bàn này cần khai báo mô hình. ' +
          'Danh sách biến xem ở `.env.example` tại thư mục gốc.',
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
    { errorText: STREAM_ERROR[locale] },
  );
}
