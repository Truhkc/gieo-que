'use client';

/**
 * Hiển thị bài AI theo đúng hai loại đánh dấu mà prompt cho phép:
 * dòng `**【Tên mục】**` thành tiêu đề mục, `**đậm**` trong dòng thành chữ đậm.
 * (Cùng quy tắc với renderer trong InsightPanel / trang Hợp bàn.)
 */
export default function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, i) => {
        const section = line.match(/^\*\*【(.+?)】\*\*$/);
        if (section) {
          return (
            <div key={i} style={{ paddingTop: i === 0 ? 0 : 14, paddingBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ac)', letterSpacing: '0.04em' }}>
                【{section[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 4 }} />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--tx-2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0 ? part : <strong key={j} style={{ fontWeight: 600, color: 'var(--tx-0)' }}>{part}</strong>,
            )}
          </div>
        );
      })}
      {streaming && (
        <span style={{
          display: 'inline-block', width: 7, height: 13, background: 'var(--ac)', opacity: 0.5,
          borderRadius: 2, animation: 'pulse 1s ease-in-out infinite', verticalAlign: 'middle', marginLeft: 2,
        }} />
      )}
    </div>
  );
}

/** Đọc luồng SSE `data: {"delta":{"text":"…"}}` của các route /api/*, gọi onText với toàn bộ văn bản đã nhận. */
export async function readDeltaStream(res: Response, onText: (text: string) => void): Promise<string> {
  if (!res.body) throw new Error('no body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let pending = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return text;
      try {
        const delta = JSON.parse(data).delta?.text ?? '';
        if (delta) { text += delta; onText(text); }
      } catch { /* bỏ qua khung hỏng */ }
    }
  }
  return text;
}
