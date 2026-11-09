/**
 * lib/ziwei/locations —— danh sách nơi sinh dùng chung cho biểu mẫu
 *
 * Gộp tỉnh thành Việt Nam với dữ liệu gốc Trung Quốc, đặt Việt Nam lên trước
 * vì đây là trang cho người Việt. Giữ cities.ts nguyên vẹn để còn đồng bộ được
 * với thượng nguồn; phần ghép nằm ở đây.
 */
import { PROVINCES as CN_PROVINCES, type ProvinceInfo } from './cities';
import { VN_PROVINCES } from './cities-vn';

/** Mặc định khi tỉnh không khai báo: giờ Bắc Kinh, như toàn bộ dữ liệu gốc. */
export const DEFAULT_UTC_OFFSET_MINUTES = 480;

/** Kinh tuyến trung tâm của một múi giờ: 480 phút → 120°E, 420 phút → 105°E. */
export function centralMeridian(utcOffsetMinutes: number): number {
  return utcOffsetMinutes / 4;
}

export const ALL_PROVINCES: ProvinceInfo[] = [...VN_PROVINCES, ...CN_PROVINCES];

export function findProvince(name: string): ProvinceInfo | undefined {
  return ALL_PROVINCES.find(p => p.name === name);
}

/** Độ lệch múi giờ của tỉnh; không tìm thấy thì trả mặc định. */
export function provinceUtcOffset(name: string): number {
  return findProvince(name)?.utcOffsetMinutes ?? DEFAULT_UTC_OFFSET_MINUTES;
}

export const VN_GROUP = ALL_PROVINCES.filter(p => p.country === 'VN');
export const CN_GROUP = ALL_PROVINCES.filter(p => p.country !== 'VN');
