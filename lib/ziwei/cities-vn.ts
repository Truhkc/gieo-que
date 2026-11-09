/**
 * lib/ziwei/cities-vn —— tỉnh thành Việt Nam cho hiệu chỉnh chân thái dương thời
 *
 * Bản gốc chỉ có địa danh Trung Quốc, nên người sinh ở Việt Nam không chọn được
 * nơi sinh và mất luôn phần hiệu chỉnh giờ.
 *
 * Điểm then chốt là **múi giờ**, không chỉ kinh độ. Đồng hồ Việt Nam chạy theo
 * UTC+7, kinh tuyến trung tâm 105°E; đồng hồ Trung Quốc theo UTC+8, kinh tuyến
 * 120°E. Công thức cũ `(kinh độ − 120) × 4` ngầm giả định giờ Bắc Kinh, áp cho
 * một người sinh ở Hà Nội sẽ lệch đúng 60 phút — đủ để nhảy nửa canh giờ, và ở
 * sát ranh giới canh giờ thì sai cả lá số. Vì vậy mỗi tỉnh mang theo
 * `utcOffsetMinutes` riêng.
 *
 * Kinh độ lấy ở trung tâm tỉnh lỵ, làm tròn 0,01° (~2,7 km, tức ~11 giây thời
 * gian) — nhỏ hơn nhiều so với sai số của việc nhớ giờ sinh.
 *
 * Danh sách theo tên tỉnh quen thuộc trước đợt sắp xếp hành chính 2025, vì
 * người dùng tra theo nơi sinh ngày xưa chứ không theo bản đồ hành chính hiện tại.
 */
import type { ProvinceInfo } from './cities';

/** Việt Nam dùng giờ Đông Dương UTC+7 từ 1975 tới nay */
const VN_OFFSET = 420;

const vn = (name: string, cities: { name: string; longitude: number }[]): ProvinceInfo => ({
  name,
  cities,
  country: 'VN',
  utcOffsetMinutes: VN_OFFSET,
});

export const VN_PROVINCES: ProvinceInfo[] = [
  // ─── Đồng bằng sông Hồng ───────────────────────────────
  vn('Hà Nội', [
    { name: 'Hà Nội', longitude: 105.85 },
    { name: 'Hà Đông', longitude: 105.78 },
    { name: 'Sơn Tây', longitude: 105.5 },
  ]),
  vn('Hải Phòng', [{ name: 'Hải Phòng', longitude: 106.68 }]),
  vn('Quảng Ninh', [
    { name: 'Hạ Long', longitude: 107.08 },
    { name: 'Móng Cái', longitude: 107.97 },
    { name: 'Uông Bí', longitude: 106.77 },
  ]),
  vn('Hải Dương', [{ name: 'Hải Dương', longitude: 106.33 }]),
  vn('Hưng Yên', [{ name: 'Hưng Yên', longitude: 106.05 }]),
  vn('Bắc Ninh', [{ name: 'Bắc Ninh', longitude: 106.08 }]),
  vn('Bắc Giang', [{ name: 'Bắc Giang', longitude: 106.19 }]),
  vn('Vĩnh Phúc', [{ name: 'Vĩnh Yên', longitude: 105.6 }]),
  vn('Thái Bình', [{ name: 'Thái Bình', longitude: 106.34 }]),
  vn('Nam Định', [{ name: 'Nam Định', longitude: 106.18 }]),
  vn('Hà Nam', [{ name: 'Phủ Lý', longitude: 105.91 }]),
  vn('Ninh Bình', [{ name: 'Ninh Bình', longitude: 105.97 }]),

  // ─── Trung du và miền núi phía Bắc ─────────────────────
  vn('Phú Thọ', [{ name: 'Việt Trì', longitude: 105.4 }]),
  vn('Thái Nguyên', [{ name: 'Thái Nguyên', longitude: 105.84 }]),
  vn('Bắc Kạn', [{ name: 'Bắc Kạn', longitude: 105.83 }]),
  vn('Cao Bằng', [{ name: 'Cao Bằng', longitude: 106.25 }]),
  vn('Lạng Sơn', [{ name: 'Lạng Sơn', longitude: 106.76 }]),
  vn('Tuyên Quang', [{ name: 'Tuyên Quang', longitude: 105.22 }]),
  vn('Hà Giang', [{ name: 'Hà Giang', longitude: 104.98 }]),
  vn('Yên Bái', [{ name: 'Yên Bái', longitude: 104.87 }]),
  vn('Lào Cai', [
    { name: 'Lào Cai', longitude: 103.97 },
    { name: 'Sa Pa', longitude: 103.84 },
  ]),
  vn('Lai Châu', [{ name: 'Lai Châu', longitude: 103.47 }]),
  vn('Điện Biên', [{ name: 'Điện Biên Phủ', longitude: 103.02 }]),
  vn('Sơn La', [{ name: 'Sơn La', longitude: 103.92 }]),
  vn('Hoà Bình', [{ name: 'Hoà Bình', longitude: 105.34 }]),

  // ─── Bắc Trung Bộ ──────────────────────────────────────
  vn('Thanh Hoá', [{ name: 'Thanh Hoá', longitude: 105.78 }]),
  vn('Nghệ An', [
    { name: 'Vinh', longitude: 105.67 },
    { name: 'Cửa Lò', longitude: 105.72 },
  ]),
  vn('Hà Tĩnh', [{ name: 'Hà Tĩnh', longitude: 105.9 }]),
  vn('Quảng Bình', [{ name: 'Đồng Hới', longitude: 106.6 }]),
  vn('Quảng Trị', [{ name: 'Đông Hà', longitude: 107.1 }]),
  vn('Thừa Thiên Huế', [{ name: 'Huế', longitude: 107.58 }]),

  // ─── Nam Trung Bộ ──────────────────────────────────────
  vn('Đà Nẵng', [{ name: 'Đà Nẵng', longitude: 108.22 }]),
  vn('Quảng Nam', [
    { name: 'Tam Kỳ', longitude: 108.48 },
    { name: 'Hội An', longitude: 108.33 },
  ]),
  vn('Quảng Ngãi', [{ name: 'Quảng Ngãi', longitude: 108.8 }]),
  vn('Bình Định', [{ name: 'Quy Nhơn', longitude: 109.22 }]),
  vn('Phú Yên', [{ name: 'Tuy Hoà', longitude: 109.32 }]),
  vn('Khánh Hoà', [
    { name: 'Nha Trang', longitude: 109.19 },
    { name: 'Cam Ranh', longitude: 109.15 },
  ]),
  vn('Ninh Thuận', [{ name: 'Phan Rang', longitude: 108.99 }]),
  vn('Bình Thuận', [{ name: 'Phan Thiết', longitude: 108.1 }]),

  // ─── Tây Nguyên ────────────────────────────────────────
  vn('Lâm Đồng', [
    { name: 'Đà Lạt', longitude: 108.44 },
    { name: 'Bảo Lộc', longitude: 107.81 },
  ]),
  vn('Đắk Lắk', [{ name: 'Buôn Ma Thuột', longitude: 108.05 }]),
  vn('Đắk Nông', [{ name: 'Gia Nghĩa', longitude: 107.69 }]),
  vn('Gia Lai', [{ name: 'Pleiku', longitude: 108.0 }]),
  vn('Kon Tum', [{ name: 'Kon Tum', longitude: 108.0 }]),

  // ─── Đông Nam Bộ ───────────────────────────────────────
  vn('TP. Hồ Chí Minh', [
    { name: 'TP. Hồ Chí Minh', longitude: 106.7 },
    { name: 'Thủ Đức', longitude: 106.75 },
    { name: 'Củ Chi', longitude: 106.49 },
  ]),
  vn('Đồng Nai', [{ name: 'Biên Hoà', longitude: 106.82 }]),
  vn('Bình Dương', [{ name: 'Thủ Dầu Một', longitude: 106.65 }]),
  vn('Bà Rịa – Vũng Tàu', [{ name: 'Vũng Tàu', longitude: 107.08 }]),
  vn('Tây Ninh', [{ name: 'Tây Ninh', longitude: 106.13 }]),
  vn('Bình Phước', [{ name: 'Đồng Xoài', longitude: 106.89 }]),

  // ─── Đồng bằng sông Cửu Long ───────────────────────────
  vn('Long An', [{ name: 'Tân An', longitude: 106.41 }]),
  vn('Tiền Giang', [{ name: 'Mỹ Tho', longitude: 106.36 }]),
  vn('Bến Tre', [{ name: 'Bến Tre', longitude: 106.38 }]),
  vn('Trà Vinh', [{ name: 'Trà Vinh', longitude: 106.34 }]),
  vn('Vĩnh Long', [{ name: 'Vĩnh Long', longitude: 105.97 }]),
  vn('Đồng Tháp', [{ name: 'Cao Lãnh', longitude: 105.63 }]),
  vn('An Giang', [
    { name: 'Long Xuyên', longitude: 105.44 },
    { name: 'Châu Đốc', longitude: 105.12 },
  ]),
  vn('Kiên Giang', [
    { name: 'Rạch Giá', longitude: 105.08 },
    { name: 'Phú Quốc', longitude: 103.96 },
  ]),
  vn('Cần Thơ', [{ name: 'Cần Thơ', longitude: 105.78 }]),
  vn('Hậu Giang', [{ name: 'Vị Thanh', longitude: 105.47 }]),
  vn('Sóc Trăng', [{ name: 'Sóc Trăng', longitude: 105.97 }]),
  vn('Bạc Liêu', [{ name: 'Bạc Liêu', longitude: 105.72 }]),
  vn('Cà Mau', [{ name: 'Cà Mau', longitude: 105.15 }]),
];
