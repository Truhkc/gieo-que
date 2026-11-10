/**
 * lib/ai/choose-provider —— route nào cũng hỏi một câu: lần này gọi model nào?
 *
 * 1. Người xem gửi kèm API riêng (trường `provider`) → chỉ dùng cái đó.
 * 2. Không có → danh sách của chủ site (AI_PROVIDERS, hoặc AI_PROVIDER đơn lẻ).
 */
import 'server-only';
import { resolveProviders, type AiProvider, type ConfigReason } from './provider';
import { readUserProvider, UserProviderError, userStreamError } from './user-provider';

export type AiChoice =
  | { ok: true; providers: AiProvider[]; user: boolean }
  | { ok: false; reason: ConfigReason; user: boolean };

export async function chooseProviders(body: Record<string, unknown>): Promise<AiChoice> {
  try {
    const own = await readUserProvider(body);
    if (own) return { ok: true, providers: [own], user: true };
  } catch (err) {
    if (err instanceof UserProviderError) return { ok: false, reason: err.reason, user: true };
    throw err;
  }
  const r = resolveProviders();
  return r.ok ? { ok: true, providers: r.providers, user: false } : { ok: false, reason: r.reason, user: false };
}

/** Thông báo khi API riêng người xem nhập không qua được kiểm tra */
export function userProviderInvalidText(reason: ConfigReason, locale: 'vi' | 'zh'): string {
  return locale === 'zh'
    ? `**【自定义 API 不可用】**\n\n${reason.zh}\n\n请在「API 设置」里修改，或清除自定义 API 改用本站默认配置。`
    : `**【API riêng chưa dùng được】**\n\n${reason.vi}\n\n` +
      'Hãy sửa trong «Cài đặt API», hoặc xoá API riêng để dùng cấu hình mặc định của trang.';
}

/** errorText cho deltaStreamResponse: API riêng thì nêu mã lỗi, còn lại dùng câu chung */
export function streamErrorText(choice: { user: boolean }, locale: 'vi' | 'zh', generic: string) {
  return choice.user ? (err: unknown) => userStreamError(err, locale) : generic;
}
