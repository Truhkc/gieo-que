/**
 * Nơi sinh ở Việt Nam phải trừ theo kinh tuyến 105°E, không phải 120°E.
 *
 * Đồng hồ Việt Nam chạy UTC+7. Công thức cũ cố định `(kinh độ − 120) × 4` ngầm
 * giả định giờ Bắc Kinh, nên với một người sinh ở Hà Nội nó lệch đúng 60 phút —
 * đủ để rơi sang canh giờ khác, và canh giờ sai thì cung Mệnh sai, cả lá số sai.
 *
 * Mốc kiểm: Hà Nội (105.85°E), đồng hồ 13:05.
 *   đúng : 13:05 + (105.85 − 105) × 4 = 13:08 → giờ Mùi (chi 7)
 *   sai   : 13:05 + (105.85 − 120) × 4 = 12:08 → giờ Ngọ (chi 6)
 */
import assert from 'node:assert/strict';
import { calcTrueSolarBranch, formToBirthInfo } from '../../lib/ziwei/share';
import { CN_GROUP, VN_GROUP, findProvince, provinceUtcOffset } from '../../lib/ziwei/locations';
import type { BirthFormState } from '../../components/BirthForm';

const HANOI = 105.85;
const VN_TZ = 420;
const CN_TZ = 480;

// ── 1) chi canh giờ ───────────────────────────────────────
assert.equal(calcTrueSolarBranch(13, 5, HANOI, VN_TZ), 7, 'Hà Nội 13:05 phải là giờ Mùi');
assert.equal(calcTrueSolarBranch(13, 5, HANOI, CN_TZ), 6, 'lấy nhầm 120°E sẽ ra giờ Ngọ — đây là lỗi cần tránh');

// mặc định (không truyền) phải giữ nguyên hành vi cũ: giờ Bắc Kinh
assert.equal(
  calcTrueSolarBranch(13, 5, HANOI),
  calcTrueSolarBranch(13, 5, HANOI, CN_TZ),
  'bỏ trống utcOffsetMinutes phải tương đương 480, để dữ liệu gốc không đổi',
);

// địa danh Trung Quốc không được đổi kết quả
assert.equal(calcTrueSolarBranch(13, 5, 116.4, CN_TZ), calcTrueSolarBranch(13, 5, 116.4), 'Bắc Kinh giữ nguyên');

// ── 2) xuyên suốt biểu mẫu → BirthInfo ────────────────────
const base: BirthFormState = {
  name: '', year: '1990', month: '5', day: '9',
  clockHour: '13', clockMinute: '5', unknownTime: false,
  province: 'Hà Nội', city: 'Hà Nội', longitude: HANOI,
  utcOffsetMinutes: VN_TZ, gender: 'male',
};
assert.equal(formToBirthInfo(base).hour, 7, 'formToBirthInfo phải dùng múi giờ của nơi sinh');
assert.equal(
  formToBirthInfo({ ...base, utcOffsetMinutes: undefined }).hour, 6,
  'không có múi giờ thì quay về 480 — chứng tỏ trường này thực sự có tác dụng',
);

// ── 3) dữ liệu địa danh ───────────────────────────────────
assert.ok(VN_GROUP.length >= 50, `danh sách tỉnh Việt Nam quá ngắn: ${VN_GROUP.length}`);
assert.ok(CN_GROUP.length > 30, 'dữ liệu tỉnh Trung Quốc gốc phải còn nguyên');

for (const p of VN_GROUP) {
  assert.equal(p.country, 'VN', `${p.name} thiếu country`);
  assert.equal(p.utcOffsetMinutes, VN_TZ, `${p.name} phải là UTC+7`);
  assert.ok(p.cities.length > 0, `${p.name} không có thành phố nào`);
  for (const c of p.cities) {
    // Việt Nam nằm trong khoảng 102°E–110°E
    assert.ok(c.longitude > 102 && c.longitude < 110, `${p.name}/${c.name} kinh độ sai: ${c.longitude}`);
  }
}

for (const p of CN_GROUP) {
  assert.notEqual(p.country, 'VN');
  assert.equal(provinceUtcOffset(p.name), CN_TZ, `${p.name} phải giữ giờ Bắc Kinh`);
}

assert.ok(findProvince('Hà Nội'), 'phải tra được Hà Nội');
assert.equal(provinceUtcOffset('Hà Nội'), VN_TZ);
assert.equal(provinceUtcOffset('không tồn tại'), CN_TZ, 'tỉnh lạ thì về mặc định');

// tên tỉnh không được trùng giữa hai nước
const names = [...VN_GROUP, ...CN_GROUP].map(p => p.name);
assert.equal(new Set(names).size, names.length, 'có tên tỉnh bị trùng');

console.log(
  `[vn-true-solar-time] ${VN_GROUP.length} tỉnh Việt Nam (UTC+7) + ${CN_GROUP.length} tỉnh Trung Quốc (UTC+8): ` +
  'hiệu chỉnh theo đúng kinh tuyến trung tâm của từng múi giờ',
);
