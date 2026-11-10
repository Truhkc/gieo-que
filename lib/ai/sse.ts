/**
 * lib/ai/sse —— 流式增量的编解码
 *
 * 前端（components/ChatPanel.tsx、components/InsightPanel.tsx、app/heming/page.tsx）
 * 约定的帧格式只有两种：
 *
 *   data: {"delta":{"text":"…"}}
 *   data: [DONE]
 *
 * 这个模块两头都管：`parseSseData` 把上游厂商的 SSE 拆成 data 负载，
 * `deltaStreamResponse` 把纯文本增量重新编成上面这个格式。
 */
import 'server-only';

/**
 * 把上游 SSE 字节流拆成一条条 `data:` 负载。
 *
 * 关键点是跨 chunk 的半行：网络随时可能在 JSON 中间切断，
 * 所以只有读到换行才认为一行结束，剩下的留在 buf 里等下一个 chunk。
 */
export async function* parseSseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let nl = buf.indexOf('\n');
      while (nl !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith('data:')) yield line.slice(5).trimStart();
        nl = buf.indexOf('\n');
      }
    }

    // 收尾：上游可能不以换行结束最后一帧
    buf += decoder.decode();
    const tail = buf.trim();
    if (tail.startsWith('data:')) yield tail.slice(5).trimStart();
  } finally {
    reader.releaseLock();
  }
}

/** 一条文本增量帧 */
export function encodeDelta(text: string): string {
  return `data: ${JSON.stringify({ delta: { text } })}\n\n`;
}

/** 结束帧 */
export const DONE_FRAME = 'data: [DONE]\n\n';

/**
 * 把文本增量的异步迭代器包成一个 SSE Response。
 *
 * 流一开始，HTTP 状态码就定下了，之后出错改不了 status —— 所以上游中途失败时
 * 只能把错误当成一段正文推给前端，而不是返回 500。这也是前端唯一能看见原因的渠道。
 */
export function deltaStreamResponse(
  source: AsyncIterable<string>,
  init: {
    status?: number;
    headers?: Record<string, string>;
    /**
     * Câu báo lỗi đẩy xuống client khi upstream gãy giữa chừng, theo ngôn ngữ người dùng.
     * Dạng hàm thì nhận lỗi để nêu lý do cụ thể (dùng cho API riêng của người xem).
     */
    errorText?: string | ((err: unknown) => string);
  } = {},
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of source) {
          if (text) controller.enqueue(encoder.encode(encodeDelta(text)));
        }
      } catch (err) {
        // 服务端留全量日志，返回给前端的只有一句人话，不带堆栈或 key
        console.error('[ai] stream aborted:', err);
        const text = typeof init.errorText === 'function'
          ? init.errorText(err)
          : init.errorText ?? '\n\n（生成中断：上游模型接口出错，请稍后重试。）';
        controller.enqueue(encoder.encode(encodeDelta(text)));
      } finally {
        controller.enqueue(encoder.encode(DONE_FRAME));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // 关掉 Nginx 一类反代的响应缓冲，否则流式会被攒成一坨
      'X-Accel-Buffering': 'no',
      ...init.headers,
    },
  });
}

/** 把一段固定文本当成单帧流返回（配置缺失、限流等场景） */
export function textAsDeltaStream(
  text: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  async function* once() {
    yield text;
  }
  return deltaStreamResponse(once(), init);
}
