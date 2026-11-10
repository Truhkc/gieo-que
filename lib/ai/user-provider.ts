/**
 * lib/ai/user-provider —— API riêng do người xem tự nhập (bring your own key)
 *
 * Người xem dán Base URL + API key + model trong ô cài đặt; trình duyệt lưu ở
 * localStorage và gửi kèm mỗi request trong trường `provider`. Server dùng đúng
 * endpoint đó thay cho key của chủ site, không chuyển sang key của chủ site khi lỗi.
 *
 * Vì server sẽ gọi một URL do người lạ đưa vào, phải chặn SSRF:
 *   - chỉ https, cổng 443, không kèm user:pass
 *   - host không được là localhost / IP nội bộ / tên miền nội bộ; tên miền thì
 *     phân giải DNS và từ chối nếu bất kỳ địa chỉ nào là nội bộ
 *   - request đi ra không theo redirect (AiProvider.untrusted → redirect: 'error')
 * Rủi ro còn lại: DNS rebinding giữa lúc kiểm tra và lúc fetch. Chấp nhận được với
 * một endpoint chỉ nhận POST JSON và không trả body về cho người gọi khi lỗi.
 *
 * Key không bao giờ được ghi log.
 */
import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { AiProvider, ConfigReason } from './provider';

export class UserProviderError extends Error {
  reason: ConfigReason;
  constructor(reason: ConfigReason) {
    super(reason.zh);
    this.name = 'UserProviderError';
    this.reason = reason;
  }
}

const bad = (vi: string, zh: string) => new UserProviderError({ vi, zh });

function ipv4Private(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && (b === 18 || b === 19));
}

/** true nếu địa chỉ IP không phải địa chỉ công khai trên internet */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) {
    const s = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (s === '::' || s === '::1') return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4Private(mapped[1]);
    if (/^::ffff:/.test(s)) return true; // dạng hex của IPv4-mapped: chặn luôn cho chắc
    const first = Number.parseInt(s.split(':')[0] || '0', 16);
    return (first & 0xfe00) === 0xfc00   // fc00::/7  unique local
      || (first & 0xffc0) === 0xfe80     // fe80::/10 link-local
      || (first & 0xff00) === 0xff00;    // ff00::/8  multicast
  }
  return true; // không phải IP hợp lệ → coi như không an toàn
}

const INTERNAL_SUFFIX = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

/** Ném UserProviderError nếu URL không phải https công khai. Trả về URL đã chuẩn hoá (không có / cuối). */
export async function assertPublicHttpsUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw bad('Base URL không đúng định dạng.', 'Base URL 格式不正确。');
  }
  if (url.protocol !== 'https:') throw bad('Base URL phải bắt đầu bằng https://', 'Base URL 必须以 https:// 开头。');
  if (url.username || url.password) throw bad('Base URL không được chứa tài khoản/mật khẩu.', 'Base URL 不能包含账号密码。');
  if (url.port && url.port !== '443') throw bad('Base URL chỉ được dùng cổng 443.', 'Base URL 只能使用 443 端口。');
  if (url.search || url.hash) throw bad('Base URL không được có ?query hoặc #.', 'Base URL 不能带查询参数或 #。');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (INTERNAL_SUFFIX.test(host) || !host.includes('.') && !isIP(host)) {
    throw bad('Base URL phải là tên miền công khai.', 'Base URL 必须是公网域名。');
  }

  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true, verbatim: true })).map(a => a.address);
    } catch {
      throw bad(`Không phân giải được tên miền «${host}».`, `无法解析域名「${host}」。`);
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw bad('Base URL trỏ vào địa chỉ nội bộ, không được phép.', 'Base URL 指向内网地址，不允许使用。');
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/**
 * Đọc trường `provider` trong body. Không có → null (dùng cấu hình của chủ site).
 * Có nhưng sai → UserProviderError với lý do hai ngôn ngữ.
 */
export async function readUserProvider(body: Record<string, unknown>): Promise<AiProvider | null> {
  const raw = body.provider;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw bad('Cấu hình API riêng không hợp lệ.', '自定义 API 配置不合法。');
  const r = raw as Record<string, unknown>;

  const kind = r.kind;
  if (kind !== 'openai' && kind !== 'anthropic') {
    throw bad('Loại API phải là OpenAI-compatible hoặc Anthropic.', 'API 类型只能是 OpenAI 兼容或 Anthropic。');
  }
  const apiKey = typeof r.apiKey === 'string' ? r.apiKey.trim() : '';
  if (apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey)) {
    throw bad('API key trống hoặc không hợp lệ.', 'API Key 为空或不合法。');
  }
  const model = typeof r.model === 'string' ? r.model.trim() : '';
  if (!/^[\w.:/@+-]{1,120}$/.test(model)) throw bad('Tên model trống hoặc có ký tự lạ.', '模型名为空或包含非法字符。');
  const baseUrlRaw = typeof r.baseUrl === 'string' ? r.baseUrl.trim() : '';
  if (!baseUrlRaw || baseUrlRaw.length > 300) throw bad('Thiếu Base URL.', '缺少 Base URL。');

  const baseUrl = await assertPublicHttpsUrl(baseUrlRaw);
  return { id: 'user', kind, baseUrl, apiKey, model, untrusted: true };
}

/** Câu báo lỗi khi API riêng của người xem hỏng — chỉ nêu mã HTTP, không lộ body hay key */
export function userStreamError(err: unknown, locale: 'vi' | 'zh'): string {
  const status = err instanceof Error ? err.message.match(/responded (\d{3})/)?.[1] : undefined;
  const hint: Record<string, { vi: string; zh: string }> = {
    '401': { vi: 'key sai hoặc đã bị thu hồi', zh: 'Key 错误或已失效' },
    '403': { vi: 'key không có quyền dùng model này', zh: 'Key 无权使用该模型' },
    '404': { vi: 'sai Base URL hoặc sai tên model', zh: 'Base URL 或模型名有误' },
    '429': { vi: 'hết hạn mức hoặc gọi quá nhanh', zh: '额度用尽或请求过快' },
  };
  const h = status ? hint[status] : undefined;
  if (locale === 'zh') {
    return `\n\n（你的自定义 API 返回错误${status ? ` ${status}` : ''}${h ? `：${h.zh}` : ''}。请在「API 设置」里检查后重试。）`;
  }
  return `\n\n(API riêng của bạn báo lỗi${status ? ` ${status}` : ''}${h ? `: ${h.vi}` : ''}. Hãy kiểm tra lại trong «Cài đặt API» rồi thử lại.)`;
}
