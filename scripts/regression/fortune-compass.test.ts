/**
 * La bàn vận mệnh (lib/compass/data.ts): bố cục 24 sơn / 8 quái, sơn dưới kim theo góc quay,
 * can ngày tính nhẩm khớp lunar-javascript, và quan hệ ngũ hành.
 */
import assert from 'node:assert/strict';
import { Solar } from 'lunar-javascript';
import {
  MOUNTAINS, STEMS, TRIGRAMS, dayStemIndex, mountainAt, normalizeAngle, relation,
} from '../../lib/compass/data';

// 24 sơn, cách nhau 15°, mỗi quái quản đúng 3 sơn liền nhau
assert.equal(MOUNTAINS.length, 24);
assert.equal(new Set(MOUNTAINS.map(m => m.han)).size, 24);
MOUNTAINS.forEach((m, i) => assert.equal(m.angle, i * 15));
for (let t = 0; t < 8; t++) assert.equal(MOUNTAINS.filter(m => m.trigram === t).length, 3, TRIGRAMS[t].han);
// Sơn mang tên quái nằm giữa cung của chính quái đó (艮 坤 乾 巽)
for (const [han, gua] of [['艮', '艮'], ['巽', '巽'], ['坤', '坤'], ['乾', '乾']]) {
  const m = MOUNTAINS.find(x => x.han === han)!;
  assert.equal(TRIGRAMS[m.trigram].han, gua);
}
// Phương vị Hậu Thiên: Bắc 坎, Đông 震, Nam 离, Tây 兑
const at = (deg: number) => TRIGRAMS[MOUNTAINS.find(m => m.angle === deg)!.trigram].han;
assert.deepEqual([at(0), at(90), at(180), at(270)], ['坎', '震', '离', '兑']);
assert.deepEqual([at(345), at(15)], ['坎', '坎']); // Nhâm và Quý vẫn thuộc Khảm
// Số Lạc Thư: mỗi số 1–9 trừ 5 xuất hiện đúng một lần
assert.deepEqual(TRIGRAMS.map(t => t.number).sort(), [1, 2, 3, 4, 6, 7, 8, 9]);
// Hào: ☰ ba dương, ☷ ba âm, ☳ chỉ hào dưới dương
assert.deepEqual(TRIGRAMS.find(t => t.han === '震')!.lines, [true, false, false]);
for (const t of TRIGRAMS) assert.equal([...t.symbol].length, 1, t.han);
for (const m of MOUNTAINS) assert.ok(m.message.vi.length > 20 && m.message.zh.length > 8, m.han);

// Kim cố định ở đỉnh: quay đĩa +90° (theo chiều kim đồng hồ) thì điểm 270° (Dậu) lên đỉnh
assert.equal(mountainAt(0).han, '子');
assert.equal(mountainAt(90).han, '酉');
assert.equal(mountainAt(-90).han, '卯');
assert.equal(mountainAt(180).han, '午');
assert.equal(mountainAt(7).han, '子');
assert.equal(mountainAt(8).han, '壬');
assert.equal(mountainAt(-8).han, '癸');
assert.equal(mountainAt(360 * 5 + 15).han, '壬');
assert.equal(normalizeAngle(-30), 330);

// Can ngày tính nhẩm phải khớp thư viện lịch âm (quét 3 năm, đủ mọi vòng 10 can)
for (let t = Date.UTC(2024, 0, 1); t <= Date.UTC(2026, 11, 31); t += 86_400_000) {
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  const gan = Solar.fromYmd(y, m, day).getLunar().getDayGan();
  assert.equal(STEMS[dayStemIndex(y, m, day)], gan, `${y}-${m}-${day}`);
}
assert.equal(STEMS[dayStemIndex(1950, 1, 1)], Solar.fromYmd(1950, 1, 1).getLunar().getDayGan());

// Ngũ hành
assert.equal(relation('水', '水'), 'same');
assert.equal(relation('木', '水'), 'dayFeeds');    // ngày Thuỷ sinh quái Mộc
assert.equal(relation('木', '火'), 'feedsDay');    // quái Mộc sinh ngày Hoả
assert.equal(relation('木', '金'), 'dayControls'); // ngày Kim khắc quái Mộc
assert.equal(relation('木', '土'), 'controlsDay'); // quái Mộc khắc ngày Thổ

console.log('fortune-compass: OK');
