/**
 * lib/ai/dataset-fallback —— 没配 AI 时，主题标签页直接给数据集原文（越南语界面给 Google 机器翻译）
 *
 * 只用于标签页 / 宫位自动发出的提问（请求体 auto !== false）。用户自己打字的追问没有数据集可答，
 * 仍然显示「Chưa cấu hình AI」。
 */
import 'server-only';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import { lookupInterpWithin } from './interp-dataset';
import { translateZhToVi } from './translate';

/** 没有模型要等，读数据集可以多等一会儿（GitHub 下载偶尔要十几秒） */
const FALLBACK_WAIT_MS = 30_000;

const TOPIC_VI: Record<TopicKey, string> = {
  overview: 'Mệnh cục',
  personality: 'Tính cách',
  love: 'Tình cảm',
  career: 'Sự nghiệp',
  wealth: 'Tài vận',
  health: 'Sức khoẻ',
  family: 'Anh chị em',
  children: 'Con cái',
  move: 'Xuất ngoại, di chuyển',
  friends: 'Quan hệ xã hội',
  home: 'Nhà cửa, điền sản',
  spirit: 'Phúc đức',
  parents: 'Cha mẹ',
};

/**
 * 返回要直接推给前端的整段文字；数据集里查不到时返回 null（调用方照旧显示「未配置 AI」）。
 */
export async function datasetFallbackText(opts: {
  birth: { year: number; month: number; day: number; hour: number; gender: string };
  topic: TopicKey;
  locale: 'vi' | 'zh';
}): Promise<string | null> {
  const hit = await lookupInterpWithin(opts.birth, opts.topic, FALLBACK_WAIT_MS);
  if (!hit.ok) return null;

  if (opts.locale === 'zh') {
    return '**【数据集原文】**\n本站尚未配置 AI，以下是 13 维解读数据集里这张盘的原文。\n\n' + hit.text;
  }

  const vi = await translateZhToVi(hit.text, { cacheKey: `${hit.key.key}:${opts.topic}` });
  const title = `**【${TOPIC_VI[opts.topic]} · theo bộ dữ liệu giải đoán】**`;
  if (!vi) {
    return `${title}\nTrang chưa cấu hình AI và Google Dịch đang không phản hồi, ` +
      'nên dưới đây là **nguyên văn tiếng Trung** của bộ dữ liệu. Thử lại sau ít phút để xem bản dịch.\n\n' +
      hit.text;
  }
  return `${title}\nTrang chưa cấu hình AI, nên dưới đây là **bản dịch máy (Google Dịch)** phần giải đoán ` +
    'chủ đề này trong bộ dữ liệu 13 chiều. Tên sao, tên cung đã chuyển sang âm Hán-Việt; câu chữ có chỗ ' +
    'chưa mượt — bấm "Xem nguyên văn" bên dưới để đối chiếu tiếng Trung.\n\n' + vi;
}
