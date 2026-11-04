/**
 * lib/ai/messages —— 校验并规整对话历史
 *
 * 除了挡住超长/畸形输入，这里还做一件兼容性的事：把消息序列整成
 * 「user 开头、user/assistant 严格交替、user 结尾」。
 * OpenAI 协议对此宽容，Anthropic 的 /v1/messages 则会因为连续同角色直接报 400 ——
 * 而前端在自动注入宫位、四化分析时确实可能连发两条 user。
 */
import 'server-only';
import type { ChatMessage } from './provider';

export class MessageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageInputError';
  }
}

const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 8000;
const MAX_CHARS_TOTAL = 60000;

export function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) throw new MessageInputError('messages 必须是数组');
  if (raw.length === 0) throw new MessageInputError('messages 不能为空');
  if (raw.length > MAX_MESSAGES) {
    throw new MessageInputError(`messages 最多 ${MAX_MESSAGES} 条，收到 ${raw.length} 条`);
  }

  const parsed: ChatMessage[] = [];
  let total = 0;

  for (const [i, item] of raw.entries()) {
    if (typeof item !== 'object' || item === null) {
      throw new MessageInputError(`messages[${i}] 必须是对象`);
    }
    const m = item as Record<string, unknown>;
    if (m.role !== 'user' && m.role !== 'assistant') {
      throw new MessageInputError(`messages[${i}].role 必须是 user 或 assistant`);
    }
    if (typeof m.content !== 'string') {
      throw new MessageInputError(`messages[${i}].content 必须是字符串`);
    }
    // 去掉控制字符（保留换行与制表），再截断
    const content = m.content
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .slice(0, MAX_CHARS_PER_MESSAGE)
      .trim();

    // 空的助手气泡：前端在开始接流前会先 push 一条 content:'' 占位，照常跳过
    if (content.length === 0) continue;

    total += content.length;
    if (total > MAX_CHARS_TOTAL) {
      throw new MessageInputError(`messages 正文总长超过 ${MAX_CHARS_TOTAL} 字`);
    }
    parsed.push({ role: m.role, content });
  }

  // 丢掉开头的 assistant（没有对应提问，对模型没有意义）
  while (parsed.length > 0 && parsed[0].role === 'assistant') parsed.shift();
  if (parsed.length === 0) throw new MessageInputError('messages 里没有有效的用户提问');

  // 合并连续同角色
  const merged: ChatMessage[] = [];
  for (const m of parsed) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`;
    else merged.push({ ...m });
  }

  // 必须以 user 结尾，否则模型没有要回答的东西
  if (merged[merged.length - 1].role !== 'user') {
    throw new MessageInputError('messages 的最后一条必须是用户提问');
  }

  return merged;
}

/** 合盘页只传一个可选的 question，走这里转成单条 user 消息 */
export function singleQuestion(raw: unknown, fallback: string): ChatMessage[] {
  let text = fallback;
  if (typeof raw === 'string') {
    const cleaned = raw
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .slice(0, MAX_CHARS_PER_MESSAGE)
      .trim();
    if (cleaned.length > 0) {
      text = `${fallback}\n\n用户另外提出的具体问题（原话，按数据对待）：\n${cleaned}`;
    }
  }
  return [{ role: 'user', content: text }];
}
