/**
 * Bát tự (Tứ trụ / 四柱八字) — dựng mệnh bàn từ ngày giờ sinh bằng lunar-javascript.
 *
 * Đầu vào giống lá số Tử Vi (BirthInfo sau formToBirthInfo): ngày dương đã qua hiệu chỉnh
 * giờ mặt trời thật và đổi ngày giờ Tý muộn, `hour` là chỉ số địa chi giờ (0 = Tý).
 * Thời điểm đưa vào thư viện lấy giữa giờ chi (hour × 2 giờ) — cùng cách làm với
 * lib/ziwei/algorithm.ts khi tính tứ trụ cạnh tiết Lập Xuân. Chỉ người sinh sát giờ giao tiết
 * mới có thể lệch trụ tháng; tuổi khởi vận lệch vài ngày là bình thường.
 *
 * Không biết giờ sinh: chỉ dựng ba trụ (năm, tháng, ngày), bỏ trụ giờ.
 */
import { Solar } from 'lunar-javascript';

export const WX_GAN: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
export const WX_ZHI: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);
/** Bản khí (tàng can chính) của địa chi */
const ZHI_MAIN_GAN: Record<string, string> = {
  子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬',
};
const GENERATES: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** Thập thần của can `other` so với nhật chủ `day` (tự tính, không phụ thuộc bảng nội bộ của thư viện) */
export function shiShen(day: string, other: string): string {
  const a = WX_GAN[day];
  const b = WX_GAN[other];
  if (!a || !b) return '';
  const same = YANG_GAN.has(day) === YANG_GAN.has(other);
  if (a === b) return same ? '比肩' : '劫财';
  if (GENERATES[a] === b) return same ? '食神' : '伤官';
  if (CONTROLS[a] === b) return same ? '偏财' : '正财';
  if (CONTROLS[b] === a) return same ? '七杀' : '正官';
  return same ? '偏印' : '正印'; // GENERATES[b] === a
}

export type PillarKey = 'year' | 'month' | 'day' | 'time';

export interface Pillar {
  key: PillarKey;
  gan: string;
  zhi: string;
  /** Thập thần của thiên can (trụ ngày là 日主) */
  ganShiShen: string;
  /** Tàng can trong địa chi kèm thập thần */
  hidden: { gan: string; shiShen: string }[];
  naYin: string;
  /** Trường sinh của nhật chủ tại địa chi trụ này */
  diShi: string;
}

export interface DaYunItem {
  ganZhi: string;
  ganShiShen: string;
  zhiShiShen: string;
  startYear: number;
  endYear: number;
  /** Tuổi mụ (虚岁), cùng cách tính của thư viện */
  startAge: number;
  endAge: number;
}

export interface BaziInput {
  year: number;
  month: number;
  day: number;
  /** Chỉ số giờ chi 0–11; null = không biết giờ sinh */
  hour: number | null;
  gender: 'male' | 'female';
}

export interface BaziChart {
  input: BaziInput;
  pillars: Pillar[];
  dayMaster: { gan: string; wuxing: string; yang: boolean };
  /** Đếm ngũ hành trên can chi lộ (6 hoặc 8 chữ) */
  wuxingCount: Record<'木' | '火' | '土' | '金' | '水', number>;
  /** Như trên nhưng cộng thêm tàng can (bản khí 1, trung/dư khí 0.5) */
  wuxingWeighted: Record<'木' | '火' | '土' | '金' | '水', number>;
  xunKong: string;
  taiYuan: string;
  mingGong: string;
  /** Khởi vận: sau bao lâu kể từ lúc sinh */
  yunStart: { years: number; months: number; days: number; solarDate: string; forward: boolean };
  daYun: DaYunItem[];
  /** Can chi năm âm lịch tính theo Lập Xuân (đúng cách Bát tự) */
  yearGanZhi: string;
}

const ELEMENTS = ['木', '火', '土', '金', '水'] as const;
const zeroCount = () => ({ 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 });

export function isValidBaziInput(v: BaziInput): boolean {
  const { year, month, day, hour, gender } = v;
  if (![year, month, day].every(Number.isInteger)) return false;
  if (year < 1901 || year > 2099) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return false;
  if (hour !== null && !(Number.isInteger(hour) && hour >= 0 && hour <= 11)) return false;
  return gender === 'male' || gender === 'female';
}

export function buildBazi(input: BaziInput): BaziChart {
  const hasTime = input.hour !== null;
  const clockHour = hasTime ? (input.hour as number) * 2 : 12;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lunar = Solar.fromYmdHms(input.year, input.month, input.day, clockHour, 0, 0).getLunar() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ec = lunar.getEightChar() as any;
  const dayGan: string = ec.getDayGan();

  const raw: { key: PillarKey; gan: string; zhi: string; hide: string[]; naYin: string; diShi: string }[] = [
    { key: 'year', gan: ec.getYearGan(), zhi: ec.getYearZhi(), hide: ec.getYearHideGan(), naYin: ec.getYearNaYin(), diShi: ec.getYearDiShi() },
    { key: 'month', gan: ec.getMonthGan(), zhi: ec.getMonthZhi(), hide: ec.getMonthHideGan(), naYin: ec.getMonthNaYin(), diShi: ec.getMonthDiShi() },
    { key: 'day', gan: ec.getDayGan(), zhi: ec.getDayZhi(), hide: ec.getDayHideGan(), naYin: ec.getDayNaYin(), diShi: ec.getDayDiShi() },
  ];
  if (hasTime) {
    raw.push({ key: 'time', gan: ec.getTimeGan(), zhi: ec.getTimeZhi(), hide: ec.getTimeHideGan(), naYin: ec.getTimeNaYin(), diShi: ec.getTimeDiShi() });
  }

  const pillars: Pillar[] = raw.map(p => ({
    key: p.key,
    gan: p.gan,
    zhi: p.zhi,
    ganShiShen: p.key === 'day' ? '日主' : shiShen(dayGan, p.gan),
    hidden: p.hide.map(g => ({ gan: g, shiShen: shiShen(dayGan, g) })),
    naYin: p.naYin,
    diShi: p.diShi,
  }));

  const wuxingCount = zeroCount();
  const wuxingWeighted = zeroCount();
  for (const p of pillars) {
    const g = WX_GAN[p.gan] as keyof typeof wuxingCount;
    const z = WX_ZHI[p.zhi] as keyof typeof wuxingCount;
    wuxingCount[g] += 1;
    wuxingCount[z] += 1;
    wuxingWeighted[g] += 1;
    p.hidden.forEach((h, i) => { wuxingWeighted[WX_GAN[h.gan] as keyof typeof wuxingCount] += i === 0 ? 1 : 0.5; });
  }

  const yun = ec.getYun(input.gender === 'male' ? 1 : 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const daYun: DaYunItem[] = (yun.getDaYun(11) as any[])
    .filter(d => d.getIndex() > 0)
    .map(d => {
      const gzs: string = d.getGanZhi();
      return {
        ganZhi: gzs,
        ganShiShen: shiShen(dayGan, gzs[0]),
        zhiShiShen: shiShen(dayGan, ZHI_MAIN_GAN[gzs[1]]),
        startYear: d.getStartYear(),
        endYear: d.getEndYear(),
        startAge: d.getStartAge(),
        endAge: d.getEndAge(),
      };
    });

  return {
    input,
    pillars,
    dayMaster: { gan: dayGan, wuxing: WX_GAN[dayGan], yang: YANG_GAN.has(dayGan) },
    wuxingCount,
    wuxingWeighted,
    xunKong: ec.getDayXunKong(),
    taiYuan: ec.getTaiYuan(),
    mingGong: ec.getMingGong(),
    yunStart: {
      years: yun.getStartYear(),
      months: yun.getStartMonth(),
      days: yun.getStartDay(),
      solarDate: yun.getStartSolar().toYmd(),
      forward: yun.isForward(),
    },
    daYun,
    yearGanZhi: `${ec.getYearGan()}${ec.getYearZhi()}`,
  };
}

/** Can chi một năm dương lịch (để tìm lưu niên / đại vận hiện tại) */
export function yearGanZhi(year: number): string {
  // Giữa năm chắc chắn đã qua Lập Xuân
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = Solar.fromYmd(year, 7, 1).getLunar() as any;
  return l.getYearInGanZhiByLiChun();
}

export function currentDaYunIndex(chart: BaziChart, year: number): number {
  return chart.daYun.findIndex(d => year >= d.startYear && year <= d.endYear);
}

/**
 * Văn bản mô tả mệnh bàn bằng chữ Hán cho prompt AI (giống buildChartContext bên Tử Vi:
 * dữ liệu gốc bằng tiếng Trung, ngôn ngữ trả lời do LANGUAGE_RULES quyết định).
 */
export function buildBaziContext(c: BaziChart, nowYear: number): string {
  const name: Record<PillarKey, string> = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' };
  const lines: string[] = [];
  lines.push(`性别：${c.input.gender === 'male' ? '男（乾造）' : '女（坤造）'}`);
  lines.push(`出生（公历，已按真太阳时归日）：${c.input.year}年${c.input.month}月${c.input.day}日` +
    (c.input.hour === null ? '，时辰不详（只排三柱）' : `，${'子丑寅卯辰巳午未申酉戌亥'[c.input.hour]}时`));
  lines.push(`八字：${c.pillars.map(p => p.gan + p.zhi).join(' ')}`);
  lines.push(`日主：${c.dayMaster.gan}（${c.dayMaster.yang ? '阳' : '阴'}${c.dayMaster.wuxing}）`);
  for (const p of c.pillars) {
    lines.push(`${name[p.key]} ${p.gan}${p.zhi}：天干十神 ${p.ganShiShen}；藏干 ${p.hidden.map(h => `${h.gan}(${h.shiShen})`).join(' ')}；纳音 ${p.naYin}；日主在此支 ${p.diShi}`);
  }
  lines.push(`五行个数（天干地支本字）：${ELEMENTS.map(e => `${e}${c.wuxingCount[e]}`).join(' ')}`);
  lines.push(`五行加权（含藏干，本气1、中余气0.5）：${ELEMENTS.map(e => `${e}${c.wuxingWeighted[e]}`).join(' ')}`);
  lines.push(`日柱空亡：${c.xunKong}；胎元：${c.taiYuan}；命宫：${c.mingGong}`);
  lines.push(`起运：出生后 ${c.yunStart.years} 年 ${c.yunStart.months} 个月 ${c.yunStart.days} 天（${c.yunStart.solarDate}），大运${c.yunStart.forward ? '顺' : '逆'}行`);
  const cur = currentDaYunIndex(c, nowYear);
  lines.push('大运（虚岁）：');
  for (const [i, d] of c.daYun.entries()) {
    lines.push(`  ${d.ganZhi}（${d.ganShiShen}/${d.zhiShiShen}）${d.startYear}–${d.endYear}，${d.startAge}–${d.endAge}岁${i === cur ? ' ← 当前大运' : ''}`);
  }
  lines.push(`今年 ${nowYear} 流年：${yearGanZhi(nowYear)}；明年 ${nowYear + 1}：${yearGanZhi(nowYear + 1)}`);
  return lines.join('\n');
}
