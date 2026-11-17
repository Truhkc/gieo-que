/**
 * POST /api/bazi —— Bát tự (四柱八字) AI luận giải (stream)
 *
 * Request: { birth: { year, month, day, hour: 0–11 | null, gender: 'male'|'female' }, question?: string, locale?: 'vi'|'zh' }
 *   birth là ngày đã qua formToBirthInfo (giờ mặt trời thật, đổi ngày giờ Tý muộn) — giống lá số Tử Vi.
 * Response: cùng định dạng SSE với /api/interpret.
 *
 * Server tự dựng lại tứ trụ từ ngày giờ sinh (lib/bazi/chart.ts), không tin dữ liệu mệnh bàn từ trình duyệt.
 */
import { buildBaziSystem, BAZI_TASK } from '@/lib/ai/bazi-prompt';
import { streamChatWithFallback, type ChatMessage } from '@/lib/ai/provider';
import { chooseProviders, streamErrorText, userProviderInvalidText, type AiChoice } from '@/lib/ai/choose-provider';
import { deltaStreamResponse, textAsDeltaStream } from '@/lib/ai/sse';
import { singleQuestion } from '@/lib/ai/messages';
import { HttpError, jsonError, rateLimitGuard, readJsonBody, readLocale } from '@/lib/ai/http';
import { buildBazi, buildBaziContext, isValidBaziInput, type BaziInput } from '@/lib/bazi/chart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Bài luận 9 mục dài cỡ bài tab chủ đề bên Tử Vi (đo được > 60 s); Vercel Hobby + Fluid compute cho tối đa 300 s.
export const maxDuration = 300;

const STREAM_ERROR: Record<'vi' | 'zh', string> = {
  vi: '\n\n(Gián đoạn: API mô hình báo lỗi, vui lòng thử lại sau.)',
  zh: '\n\n（生成中断：上游模型接口出错，请稍后重试。）',
};

function readBirth(raw: unknown): BaziInput {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'thiếu birth');
  const b = raw as Record<string, unknown>;
  const input: BaziInput = {
    year: Number(b.year),
    month: Number(b.month),
    day: Number(b.day),
    hour: b.hour === null || b.hour === undefined ? null : Number(b.hour),
    gender: b.gender as BaziInput['gender'], // isValidBaziInput kiểm tra đúng 'male' | 'female'
  };
  if (!isValidBaziInput(input)) throw new HttpError(400, 'ngày giờ sinh không hợp lệ (1901–2099)');
  return input;
}

export async function POST(req: Request): Promise<Response> {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  let system: string;
  let messages: ChatMessage[];
  let locale: 'vi' | 'zh' = 'vi';
  let choice: AiChoice;

  try {
    const body = await readJsonBody(req);
    locale = readLocale(body);
    choice = await chooseProviders(body);
    const chart = buildBazi(readBirth(body.birth));
    // Năm hiện tại theo giờ Việt Nam
    const nowYear = new Date(Date.now() + 7 * 3600_000).getUTCFullYear();
    system = buildBaziSystem(buildBaziContext(chart, nowYear), locale);
    messages = singleQuestion(body.question, BAZI_TASK[locale]);
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    console.error('[api/bazi] bad request:', err);
    return jsonError(400, 'Yêu cầu không xử lý được');
  }

  if (!choice.ok && choice.user) {
    return textAsDeltaStream(userProviderInvalidText(choice.reason, locale), { headers: { 'x-ai-config': 'user-invalid' } });
  }
  if (!choice.ok) {
    const resolved = choice;
    console.error('[api/bazi] provider not configured:', resolved.reason.zh);
    return textAsDeltaStream(
      locale === 'zh'
        ? `**【八字 AI 分析尚未配置】**\n\n${resolved.reason.zh}\n\n四柱、十神、大运已在浏览器里排好，可以直接查看；只有这段 AI 分析需要配置模型，或点「API 设置」填入你自己的 API Key。`
        : `**【Chưa cấu hình AI luận Bát tự】**\n\n${resolved.reason.vi}\n\nTứ trụ, thập thần và đại vận đã được tính xong ngay trên trình duyệt, xem được luôn. Chỉ phần luận giải AI này cần khai báo mô hình — hoặc bấm «Cài đặt API» để dùng API key của riêng bạn.`,
      { headers: { 'x-ai-config': 'missing' } },
    );
  }

  return deltaStreamResponse(
    streamChatWithFallback(choice.providers, {
      system,
      messages,
      maxTokens: 4096,
      temperature: 0.6,
      signal: req.signal,
    }),
    { errorText: streamErrorText(choice, locale, STREAM_ERROR[locale]) },
  );
}
