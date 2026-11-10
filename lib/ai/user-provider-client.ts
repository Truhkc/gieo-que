/**
 * lib/ai/user-provider-client —— phía trình duyệt của «API riêng»
 *
 * Cấu hình chỉ nằm trong localStorage của người xem; mỗi request AI gửi kèm trong
 * trường `provider`. Server kiểm tra rồi gọi thẳng endpoint đó (lib/ai/user-provider.ts),
 * không lưu, không ghi log key.
 */

export type UserProviderKind = 'openai' | 'anthropic';

export interface UserProviderConfig {
  kind: UserProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Mẫu điền sẵn. Model chỉ là gợi ý — người dùng sửa theo gói của mình. */
export const USER_PROVIDER_PRESETS: { id: string; label: string; config: Omit<UserProviderConfig, 'apiKey'> }[] = [
  { id: 'shopaikey', label: 'ShopAIKey (Claude)', config: { kind: 'anthropic', baseUrl: 'https://api.shopaikey.com', model: 'claude-sonnet-5-5' } },
  { id: 'anthropic', label: 'Anthropic', config: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5' } },
  { id: 'openai', label: 'OpenAI', config: { kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' } },
  { id: 'deepseek', label: 'DeepSeek', config: { kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' } },
  { id: 'gemini', label: 'Google Gemini', config: { kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' } },
  { id: 'openrouter', label: 'OpenRouter', config: { kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4.5' } },
  { id: 'custom', label: 'Tuỳ chỉnh / 自定义', config: { kind: 'openai', baseUrl: '', model: '' } },
];

const STORAGE_KEY = 'tuvi.userProvider.v1';
const EVENT = 'tuvi:user-provider-changed';

function isConfig(v: unknown): v is UserProviderConfig {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (c.kind === 'openai' || c.kind === 'anthropic')
    && typeof c.baseUrl === 'string' && typeof c.apiKey === 'string' && typeof c.model === 'string'
    && c.baseUrl.length > 0 && c.apiKey.length > 0 && c.model.length > 0;
}

export function loadUserProvider(): UserProviderConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isConfig(parsed) ? parsed : null;
  } catch {
    return null; // chế độ ẩn danh / bị chặn storage: coi như chưa cài
  }
}

export function saveUserProvider(config: UserProviderConfig | null): boolean {
  try {
    if (config) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function onUserProviderChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Gắn API riêng (nếu có) vào body request AI */
export function withUserProvider<T extends object>(body: T): T & { provider?: UserProviderConfig } {
  if (typeof window === 'undefined') return body;
  const provider = loadUserProvider();
  return provider ? { ...body, provider } : body;
}
