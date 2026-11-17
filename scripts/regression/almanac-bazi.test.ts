/**
 * Xem ngày tốt xấu (lib/almanac) và Bát tự (lib/bazi).
 *
 * 1. Bảng dịch tiếng Việt phải phủ mọi tên lunar-javascript có thể trả ra — quét từng ngày
 *    2016–2035 (20 năm, đủ mọi tổ hợp 60 can chi ngày × 12 tháng tiết khí), thiếu một tên là đỏ.
 * 2. Vài ngày mốc có giá trị tra tay, để phát hiện đổi phiên bản thư viện làm lệch kết quả.
 * 3. Thập thần tự tính khớp bảng của thư viện cho đủ 100 cặp can.
 */
import '../lib/server-only-stub';
import assert from 'node:assert/strict';
import { getDayAlmanac, getMonthAlmanac, isValidSolarDate, rateDay, COMMON_ACTIVITIES } from '../../lib/almanac/day';
import {
  VI_CHANG_SHENG, VI_JIEQI, VI_NAYIN, VI_SHEN_SHA, VI_SHI_SHEN, VI_XIU, VI_YI_JI, VI_ZHI_XING,
  VI_POSITION, VI_SHENG_XIAO, viAlmanac,
} from '../../lib/almanac/terms-vi';
import { buildBazi, buildBaziContext, isValidBaziInput, shiShen, yearGanZhi } from '../../lib/bazi/chart';
import { LunarUtil } from 'lunar-javascript';

async function main(): Promise<void> {
  // ── 1. Phủ bảng dịch ──
  const missing = new Set<string>();
  const need = (table: Record<string, string>, name: string, what: string) => {
    if (name && !(name in table)) missing.add(`${what}:${name}`);
  };
  const start = Date.UTC(2016, 0, 1);
  const end = Date.UTC(2035, 11, 31);
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    const a = getDayAlmanac(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    a.yi.forEach(x => need(VI_YI_JI, x, 'yiji'));
    a.ji.forEach(x => need(VI_YI_JI, x, 'yiji'));
    a.jiShen.forEach(x => need(VI_SHEN_SHA, x, 'shensha'));
    a.xiongSha.forEach(x => need(VI_SHEN_SHA, x, 'shensha'));
    need(VI_SHEN_SHA, a.tianShen, 'tianshen');
    need(VI_ZHI_XING, a.zhiXing, 'zhixing');
    need(VI_XIU, a.xiu, 'xiu');
    need(VI_NAYIN, a.naYin, 'nayin');
    need(VI_JIEQI, a.prevJieQi.name, 'jieqi');
    need(VI_JIEQI, a.nextJieQi.name, 'jieqi');
    need(VI_POSITION, a.sha, 'sha');
    need(VI_POSITION, a.positions.xi, 'pos');
    need(VI_POSITION, a.positions.cai, 'pos');
    need(VI_POSITION, a.positions.fu, 'pos');
    need(VI_SHENG_XIAO, a.chong.shengXiao, 'shengxiao');
    assert.equal(a.hours.length, 12);
  }
  for (const x of COMMON_ACTIVITIES) need(VI_YI_JI, x, 'activity');
  for (const x of Object.values(LunarUtil.CHANG_SHENG as string[])) need(VI_CHANG_SHENG, x, 'changsheng');
  assert.deepEqual([...missing], [], `Thiếu bản dịch: ${[...missing].join(', ')}`);
  assert.equal(viAlmanac('yiji', '嫁娶', 'vi'), 'Cưới hỏi');
  assert.equal(viAlmanac('yiji', '嫁娶', 'zh'), '嫁娶');
  assert.equal(viAlmanac('yiji', 'không-có', 'vi'), 'không-có');

  // ── 2. Ngày mốc ──
  const a = getDayAlmanac(2026, 11, 11);
  assert.equal(a.lunar.dayGanZhi, '己丑');
  assert.equal(a.lunar.monthGanZhi, '己亥');
  assert.equal(a.lunar.yearGanZhi, '丙午');
  assert.deepEqual([a.lunar.month, a.lunar.day, a.lunar.leap, a.lunar.monthCn, a.lunar.dayCn], [10, 3, false, '十', '初三']);
  assert.equal(a.solar.week, 3);
  assert.deepEqual([a.tianShen, a.tianShenType, a.zhiXing, a.xiu], ['玉堂', '黄道', '满', '轸']);
  assert.equal(a.chong.ganZhi, '癸未');
  assert.ok(a.ji.includes('嫁娶') && a.yi.includes('安床'));
  assert.deepEqual([a.hours[0].zhi, a.hours[0].start, a.hours[0].end], ['子', '23:00', '00:59']);
  assert.deepEqual([a.hours[11].zhi, a.hours[11].start, a.hours[11].end], ['亥', '21:00', '22:59']);
  // Lập Đông 2026: 17:52 giờ Bắc Kinh → 16:52 giờ Việt Nam
  assert.deepEqual(a.prevJieQi, { name: '立冬', timeVn: '2026-11-07 16:52' });
  assert.equal(getDayAlmanac(2026, 11, 7).jieQiToday?.name, '立冬');
  assert.equal(getDayAlmanac(2026, 11, 8).jieQiToday, null);
  // Tháng nhuận: 2025 có nhuận tháng 6 (âm), 2025-07-25 là mùng 1 nhuận tháng 6
  const leap = getDayAlmanac(2025, 7, 25);
  assert.deepEqual([leap.lunar.month, leap.lunar.day, leap.lunar.leap], [6, 1, true]);

  const month = getMonthAlmanac(2026, 2);
  assert.equal(month.length, 28);
  assert.equal(getMonthAlmanac(2028, 2).length, 29);
  assert.ok(isValidSolarDate(2024, 2, 29) && !isValidSolarDate(2026, 2, 29) && !isValidSolarDate(1900, 1, 1));

  // rateDay
  const base = { yi: ['嫁娶'], ji: ['出行'], tianShenType: '黑道', xiuLuck: '凶' };
  assert.equal(rateDay(base), 'bad');
  assert.equal(rateDay({ ...base, tianShenType: '黄道' }), 'good');
  assert.equal(rateDay(base, '出行'), 'bad');
  assert.equal(rateDay(base, '嫁娶'), 'neutral'); // nên làm nhưng hắc đạo + sao xấu
  assert.equal(rateDay({ ...base, xiuLuck: '吉' }, '嫁娶'), 'good');
  assert.equal(rateDay({ ...base, yi: ['诸事不宜'], tianShenType: '黄道' }), 'bad');

  // ── 3. Bát tự ──
  const G = '甲乙丙丁戊己庚辛壬癸';
  for (const x of G) for (const y of G) assert.equal(shiShen(x, y), LunarUtil.SHI_SHEN[x + y], `${x}${y}`);
  for (const v of Object.values(LunarUtil.SHI_SHEN as Record<string, string>)) if (/^[一-鿿]+$/.test(v)) assert.ok(v in VI_SHI_SHEN, v);

  const c = buildBazi({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male' });
  assert.deepEqual(c.pillars.map(p => p.gan + p.zhi), ['庚午', '辛巳', '庚辰', '庚辰']);
  assert.deepEqual(c.pillars.map(p => p.ganShiShen), ['比肩', '劫财', '日主', '比肩']);
  assert.deepEqual(c.dayMaster, { gan: '庚', wuxing: '金', yang: true });
  assert.deepEqual(c.wuxingCount, { 木: 0, 火: 2, 土: 2, 金: 4, 水: 0 });
  assert.equal(c.daYun.length, 10);
  assert.deepEqual([c.daYun[0].ganZhi, c.daYun[0].startYear, c.daYun[0].startAge], ['壬午', 1997, 8]);
  assert.ok(c.yunStart.forward); // dương nam: thuận
  const f = buildBazi({ year: 1990, month: 5, day: 15, hour: 4, gender: 'female' });
  assert.ok(!f.yunStart.forward); // dương nữ: nghịch
  assert.equal(f.daYun[0].ganZhi, '庚辰');

  const noTime = buildBazi({ year: 1990, month: 5, day: 15, hour: null, gender: 'female' });
  assert.equal(noTime.pillars.length, 3);
  assert.equal(noTime.wuxingCount.木 + noTime.wuxingCount.火 + noTime.wuxingCount.土 + noTime.wuxingCount.金 + noTime.wuxingCount.水, 6);

  // Năm Bát tự đổi ở Lập Xuân (2024-02-04 16:27 giờ Bắc Kinh), không phải Tết
  assert.equal(buildBazi({ year: 2024, month: 2, day: 4, hour: 0, gender: 'male' }).pillars[0].gan + buildBazi({ year: 2024, month: 2, day: 4, hour: 0, gender: 'male' }).pillars[0].zhi, '癸卯');
  const after = buildBazi({ year: 2024, month: 2, day: 4, hour: 11, gender: 'male' });
  assert.equal(after.pillars[0].gan + after.pillars[0].zhi, '甲辰');
  assert.equal(yearGanZhi(2026), '丙午');

  assert.ok(isValidBaziInput({ year: 2000, month: 2, day: 29, hour: 0, gender: 'male' }));
  assert.ok(!isValidBaziInput({ year: 2001, month: 2, day: 29, hour: 0, gender: 'male' }));
  assert.ok(!isValidBaziInput({ year: 2000, month: 1, day: 1, hour: 12, gender: 'male' }));
  assert.ok(!isValidBaziInput({ year: 2000, month: 1, day: 1, hour: 1, gender: 'x' as 'male' }));

  const ctx = buildBaziContext(c, 2026);
  assert.ok(ctx.includes('八字：庚午 辛巳 庚辰 庚辰'));
  assert.ok(ctx.includes('甲申（偏财/比肩）2017–2026，28–37岁 ← 当前大运'));
  assert.ok(ctx.includes('今年 2026 流年：丙午'));

  const { buildBaziSystem } = await import('../../lib/ai/bazi-prompt');
  const sysVi = buildBaziSystem(ctx, 'vi');
  assert.ok(sysVi.includes('越南语') && sysVi.includes('正财=Chính Tài') && sysVi.includes(ctx));
  assert.ok(sysVi.includes('不要引用或编造任何古籍原文'));
  assert.ok(sysVi.includes('**【Gợi ý cải vận】**') && !sysVi.includes('【开运建议】'));
  const sysZh = buildBaziSystem(ctx, 'zh');
  assert.ok(!sysZh.includes('汉越音') && sysZh.includes('**【开运建议】**'));

  console.log('almanac-bazi: OK');
}

main().catch(err => { console.error(err); process.exit(1); });
