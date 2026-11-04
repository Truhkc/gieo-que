'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import { vi, viSihua } from '@/lib/i18n/terms';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean; // don't show user bubble for auto/topic messages
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
}

const TOPICS = [
  { key: 'overview',     label: 'Mệnh cục' },
  { key: 'love',        label: 'Tình cảm' },
  { key: 'career',      label: 'Sự nghiệp' },
  { key: 'wealth',      label: 'Tài vận' },
  { key: 'health',      label: 'Sức khoẻ' },
  { key: 'personality', label: 'Tính cách' },
] as const;

const TOPIC_PROMPTS: Record<string, string> = {
  overview: `Hãy lập tổng quan mệnh cục, xuất ra theo đúng cấu trúc sau:

**【Định tính mệnh cục】**
Một câu khái quát cách cục cốt lõi và khí chất của mệnh chủ.

**【Giải đọc chính tinh】**
Đặc chất cốt lõi của chính tinh cung Mệnh, dẫn quan điểm của Nghê Hải Hạ nếu có.

**【Tam phương tứ chính】**
Liên động của ba cung Tài Bạch, Quan Lộc, Thiên Di và cách cục tổng thể.

**【Đại hạn hiện tại】**
Hướng vận của đại hạn đang đi và điều đáng lưu tâm nhất.

**【Ưu thế và lưu ý】**
Ưu thế thiên phú của lá số, cùng rủi ro hoặc bài học cần lưu ý.`,

  love: `Hãy phân tích sâu vận tình cảm hôn nhân, xuất ra theo đúng cấu trúc sau:

**【Cục diện tình cảm】**
Một câu định tính mệnh cục tình cảm.

**【Phân tích cung Phu Thê】**
Chính tinh, tứ hoá tại cung Phu Thê và cách giải theo hệ Nghê Hải Hạ.

**【Liên động cung Phúc Đức】**
Theo khẩu quyết song cung liên tham: xem hôn nhân phải xem cả cung Phúc Đức.

**【Vận tình cảm đại hạn hiện tại】**
Xu hướng 10 năm này và các mốc then chốt.

**【Lời khuyên thực tế】**
Lời khuyên cụ thể, khả thi.`,

  career: `Hãy phân tích sâu vận sự nghiệp, xuất ra theo đúng cấu trúc sau:

**【Cục diện sự nghiệp】**
Một câu định tính: hợp làm công hay hợp khởi nghiệp.

**【Phân tích cung Quan Lộc】**
Chính tinh, tứ hoá tại cung Quan Lộc và phán đoán theo hệ Nghê Hải Hạ.

**【Liên động cung Tài Bạch】**
Quan hệ giữa tài vận và sự nghiệp, nguồn tiền đến từ đâu.

**【Vận sự nghiệp đại hạn hiện tại】**
Hướng đi 10 năm này.

**【Lời khuyên thực tế】**
Hướng nghề, ngành nghề và chiến lược phù hợp.`,

  wealth: `Hãy phân tích sâu tài vận, xuất ra theo đúng cấu trúc sau:

**【Cục diện tài vận】**
Một câu định tính: tiền chủ động hay tiền thụ động.

**【Phân tích cung Tài Bạch】**
Chính tinh, tứ hoá tại cung Tài Bạch, nguồn tiền và cách dòng tiền vận động.

**【Cung Điền Trạch (kho tài)】**
Khả năng tích luỹ và vận bất động sản.

**【Tài vận đại hạn hiện tại】**
Hướng tài vận hiện tại và điều cần tránh.

**【Lời khuyên tài chính】**
Lời khuyên tài chính cụ thể.`,

  health: `Hãy phân tích vận sức khoẻ, xuất ra theo đúng cấu trúc sau:

**【Chính tinh cung Tật Ách】**
Tinh diệu tại cung Tật Ách và hàm nghĩa sức khoẻ.

**【Rủi ro chính】**
Tạng phủ nên lưu tâm và vị trí cần theo dõi. Chỉ nói nên để ý và nên đi khám,
không chẩn đoán bệnh.

**【Xu hướng sức khoẻ đại hạn】**
Xu hướng hiện tại và giai đoạn then chốt.

**【Lời khuyên phòng ngừa】**
Điều cần chú ý và hướng dưỡng sinh cụ thể.`,

  personality: `Hãy phân tích sâu đặc chất tính cách, xuất ra theo đúng cấu trúc sau:

**【Tính cách chính tinh cung Mệnh】**
Đặc chất tính cách cốt lõi của chính tinh cung Mệnh.

**【Tổng hợp tam phương】**
Ảnh hưởng của ba cung Tài Bạch, Quan Lộc, Thiên Di lên tính cách.

**【Mô hình quan hệ】**
Cách tương tác với người khác, phong cách đối nhân xử thế.

**【Ưu thế và bài học đời người】**
Ưu thế thiên phú và bài học cần đối diện.`,
};

/**
 * Lĩnh vực mà mỗi cung chủ quản.
 *
 * Khoá phải khớp **đúng** tên cung do engine trả về (iztro zh-CN): chỉ 命宫
 * có hậu tố 宫, các cung còn lại không, và 交友 trong iztro gọi là 仆役.
 * Bản gốc dùng khoá có hậu tố 宫 nên 11/12 cung tra ra rỗng, prompt gửi đi
 * thành "（主管：）".
 */
const PALACE_ROLES: Record<string, string> = {
  命宫: 'bản thân, tính cách, cách cục tiên thiên',
  兄弟: 'quan hệ anh chị em, đối tác hợp tác',
  夫妻: 'quan hệ tình cảm, trạng thái hôn nhân',
  子女: 'duyên con cái, quan hệ cấp dưới',
  财帛: 'nguồn tài vận, cách kiếm tiền',
  疾厄: 'sức khoẻ thân thể, tai nạn bất ngờ',
  迁移: 'cơ hội xuất ngoại, cục diện nhân mạch',
  仆役: 'bạn bè, quý nhân, tiểu nhân',
  交友: 'bạn bè, quý nhân, tiểu nhân',
  官禄: 'thành tựu sự nghiệp, địa vị xã hội',
  田宅: 'bất động sản, môi trường gia đình',
  福德: 'hưởng thụ tinh thần, phúc phận nội tâm',
  父母: 'quan hệ cha mẹ, văn thư khế ước',
};

/** Render AI markdown: **【Title】** → gold header, **bold** → strong */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}

export default function InsightPanel({ chart, selectedPalace, selectedSiHua }: InsightPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('overview');
  const messagesRef = useRef<Message[]>([]); // always-current copy for closures
  const loadingRef = useRef(false);
  const autoLoaded = useRef(false);
  const lastPalaceBranch = useRef<number | undefined>(undefined);
  const lastSiHuaKey = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-generate 命格总览 on mount
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    sendMessage(TOPIC_PROMPTS.overview, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject palace analysis when palace selected
  useEffect(() => {
    if (!selectedPalace || selectedPalace.branch === lastPalaceBranch.current) return;
    lastPalaceBranch.current = selectedPalace.branch;

    const majorStars = selectedPalace.stars.filter(s => s.type === 'major');
    const starDesc = majorStars.length > 0
      ? majorStars.map(s => `${vi(s.name)}${s.siHua ? ' ' + viSihua(s.siHua) : ''}`).join(', ')
      : 'cung trống (mượn sao cung đối)';
    const role = PALACE_ROLES[selectedPalace.name] ?? '';

    const prompt = `Hãy phân tích trọng tâm **cung ${vi(selectedPalace.name)}** (chủ quản: ${role}),
chính tinh của cung này là ${starDesc}. Xuất ra theo đúng cấu trúc sau:

**【Định tính cung vị】**
Ý nghĩa của cung ${vi(selectedPalace.name)} trong lá số, và phán đoán tổng thể về cách phối tinh diệu này.

**【Giải đọc chính tinh】**
Cách giải chính tinh tại cung này theo hệ Nghê Hải Hạ, dẫn quan điểm cụ thể.

**【Liên động tam phương tứ chính】**
Ảnh hưởng của tam phương tứ chính lên cung này.

**【Lời khuyên thực tế】**
Lời khuyên cụ thể dựa trên cung này.`;

    sendMessage(prompt, true);
  }, [selectedPalace]); // eslint-disable-line react-hooks/exhaustive-deps

  // 注入四化飞化分析
  useEffect(() => {
    if (!selectedSiHua) return;
    const key = `${selectedSiHua.starName}-${selectedSiHua.siHua}-${selectedSiHua.view}`;
    if (key === lastSiHuaKey.current) return;
    lastSiHuaKey.current = key;

    // 找出该星所在宫位
    const palaceOfStar = chart.palaces.find(p =>
      p.stars.some(s => s.name === selectedSiHua.starName)
    );
    const palaceName = palaceOfStar?.name ?? 'không rõ';
    const viewLabel = selectedSiHua.view === 'daxian' ? 'đại hạn' : 'lưu niên';
    const star = vi(selectedSiHua.starName);
    const hua = viSihua(selectedSiHua.siHua);

    const prompt = `Hãy phân tích ảnh hưởng phi hoá của **${star} ${hua} ${viewLabel}**,
xuất ra theo đúng cấu trúc sau:

**【Hàm nghĩa cơ bản】**
Hàm nghĩa cốt lõi của ${hua} trong hệ Nghê Hải Hạ, và ý nghĩa riêng khi ${star} mang ${hua}.

**【Ảnh hưởng tại cung lạc】**
${star} ${hua} rơi vào **cung ${vi(palaceName)}** — lĩnh vực cung này chủ quản chịu ảnh hưởng ra sao.

**【Đường phi hoá tam phương tứ chính】**
Sau khi ${hua} nhập cung ${vi(palaceName)}, liên động tới cung đối và hai cung tam hợp thế nào.

**【Ảnh hưởng tới vận hiện tại】**
Ở tầng ${viewLabel}, ${hua} này tác động cụ thể gì tới vận gần đây của mệnh chủ.

**【Lời khuyên thực tế】**
Lời khuyên cụ thể, khả thi dựa trên tứ hoá này.`;

    sendMessage(prompt, true);
  }, [selectedSiHua]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamResponse = async (apiMessages: { role: 'user' | 'assistant'; content: string }[]) => {
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, messages: apiMessages }),
      });
      if (res.status === 404) throw new Error('api-missing');
      if (!res.ok) throw new Error('请求失败');
      if (!res.body) throw new Error('无响应流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      // SSE 帧可能被网络在 JSON 中间切断，必须跨 chunk 缓冲未读完的半行，
      // 否则长解读会随机丢字。读法与 app/heming/page.tsx 保持一致。
      let pending = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const delta = JSON.parse(data).delta?.text ?? '';
            assistantText += delta;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: assistantText };
              return updated;
            });
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      const missing = e instanceof Error && e.message === 'api-missing';
      setMessages(prev => [...prev, { role: 'assistant', content: missing ? 'Không tìm thấy /api/interpret — repo này đã có sẵn route đó, hãy kiểm tra app/api/interpret/route.ts và khởi động lại dev server. Việc lập lá số không cần API Key.' : 'Giải đoán thất bại, vui lòng thử lại sau.' }]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const sendMessage = (text: string, hidden = false) => {
    if (!text.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text, hidden };
    // Capture current messages synchronously via ref (avoids stale closure)
    const apiMessages = [...messagesRef.current, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    streamResponse(apiMessages);
  };

  const handleTopicClick = (topicKey: string) => {
    if (loadingRef.current) return;
    setActiveTopic(topicKey);
    sendMessage(TOPIC_PROMPTS[topicKey], true);
  };

  const handleSend = () => {
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden card-glass">

      {/* ── Topic buttons ── */}
      <div className="flex-shrink-0 px-2 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="grid grid-cols-6 gap-1">
          {TOPICS.map(t => {
            const isActive = activeTopic === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleTopicClick(t.key)}
                disabled={loading}
                className="py-1.5 text-[10px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40"
                style={{
                  background: isActive ? 'rgba(212,168,67,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(212,168,67,0.3)' : 'var(--t-border)'}`,
                  color: isActive ? 'var(--t-gold)' : 'var(--t-faint)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Loading state before first message */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3" style={{ color: 'var(--t-gold)', opacity: 0.1 }}>✦</div>
            <p className="text-[10px] animate-pulse" style={{ color: 'var(--t-faint)' }}>命格解读生成中…</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            if (msg.role === 'user' && msg.hidden) return null;

            if (msg.role === 'user') {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-[11px]"
                    style={{
                      background: 'rgba(212,168,67,0.08)',
                      border: '1px solid rgba(212,168,67,0.18)',
                      color: 'var(--t-gold)',
                    }}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              );
            }

            // Assistant message
            const isLastMsg = i === messages.length - 1;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--t-faint)' }}
                >
                  <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
                  Giải đoán
                </div>
                <AiContent text={msg.content} streaming={loading && isLastMsg} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Hỏi tiếp, ví dụ: năm nay có nên đổi việc không?"
            disabled={loading}
            className="flex-1 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{
              background: 'var(--t-card)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(212,168,67,0.15)',
              border: '1px solid rgba(212,168,67,0.25)',
              color: 'var(--t-gold)',
            }}
          >
            {loading ? '…' : 'Hỏi'}
          </button>
        </div>
      </div>

    </div>
  );
}
