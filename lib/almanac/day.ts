/**
 * Xem ngày tốt xấu (黄历) — gom dữ liệu một ngày dương lịch từ lunar-javascript.
 *
 * Chỉ làm lịch pháp, không có AI: mọi mục ở đây là tra bảng truyền thống của thư viện
 * (宜忌 theo 建除 + 神煞, 黄道/黑道 theo 十二天神, 二十八宿, giờ hoàng đạo…).
 * Trả về chữ Hán gốc; giao diện tự dịch qua lib/almanac/terms-vi.ts.
 *
 * Múi giờ: thư viện tính tiết khí theo giờ Bắc Kinh (UTC+8). Ở đây đổi thời điểm giao tiết
 * sang giờ Việt Nam (UTC+7) để hiển thị. Ngày âm lịch vẫn theo lịch của thư viện —
 * thỉnh thoảng (vài lần trong một thập kỷ) lệch một ngày đầu tháng so với lịch Việt Nam;
 * can chi ngày, trực, sao, hoàng đạo không bị ảnh hưởng vì chỉ phụ thuộc ngày dương.
 */
import { Solar } from 'lunar-javascript';

export interface AlmanacHour {
  /** Địa chi giờ: 子…亥 */
  zhi: string;
  ganZhi: string;
  /** "23:00", "01:00"… */
  start: string;
  end: string;
  /** 黄道 | 黑道 */
  type: string;
  /** 吉 | 凶 */
  luck: string;
}

export interface JieQiMark {
  name: string;
  /** Thời điểm giao tiết theo giờ Việt Nam, "YYYY-MM-DD HH:mm" */
  timeVn: string;
}

export interface DayAlmanac {
  solar: { year: number; month: number; day: number; /** 0 = Chủ nhật */ week: number };
  lunar: {
    year: number;
    /** 1–12 */
    month: number;
    leap: boolean;
    day: number;
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
    /** Con giáp của năm âm lịch: 马… */
    yearShengXiao: string;
    /** Cách viết chữ Hán: 十 / 初三 (giao diện tiếng Trung) */
    monthCn: string;
    dayCn: string;
  };
  /** Hôm nay là ngày giao tiết (giờ Việt Nam) thì có tên tiết */
  jieQiToday: JieQiMark | null;
  prevJieQi: JieQiMark;
  nextJieQi: JieQiMark;
  /** 十二天神 của ngày, ví dụ 玉堂 */
  tianShen: string;
  /** 黄道 | 黑道 */
  tianShenType: string;
  /** 吉 | 凶 */
  tianShenLuck: string;
  /** 建除: 建 除 满 平… */
  zhiXing: string;
  xiu: string;
  xiuLuck: string;
  naYin: string;
  /** Tuổi xung: can chi + con giáp */
  chong: { ganZhi: string; shengXiao: string };
  /** Hướng sát: 东/南/西/北 */
  sha: string;
  /** Hướng Hỷ thần / Tài thần / Phúc thần */
  positions: { xi: string; cai: string; fu: string };
  yi: string[];
  ji: string[];
  jiShen: string[];
  xiongSha: string[];
  pengZu: [string, string];
  /** 12 giờ trong ngày, bắt đầu từ giờ Tý (23:00 hôm trước – 00:59) */
  hours: AlmanacHour[];
}

const CN_TO_VN_MINUTES = -60;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Đổi một thời điểm của thư viện (giờ Bắc Kinh) sang giờ Việt Nam */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVnTime(solar: any): string {
  const d = new Date(Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute()));
  d.setUTCMinutes(d.getUTCMinutes() + CN_TO_VN_MINUTES);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Tên tiết khí của thư viện có khi là khoá kiểu DONG_ZHI (mục của năm kế); đổi về chữ Hán. */
const JIEQI_KEY: Record<string, string> = {
  DONG_ZHI: '冬至', XIAO_HAN: '小寒', DA_HAN: '大寒', LI_CHUN: '立春', YU_SHUI: '雨水', JING_ZHE: '惊蛰',
  DA_XUE: '大雪',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jieQiMark(jq: any): JieQiMark {
  const raw: string = jq.getName();
  return { name: JIEQI_KEY[raw] ?? raw, timeVn: toVnTime(jq.getSolar()) };
}

export function isValidSolarDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (year < 1901 || year > 2099) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function getDayAlmanac(year: number, month: number, day: number): DayAlmanac {
  const solar = Solar.fromYmd(year, month, day);
  // lunar-javascript chỉ có .d.ts tối thiểu trong repo (lib/ziwei/lunar-javascript.d.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = solar.getLunar() as any;
  const ymd = `${year}-${pad(month)}-${pad(day)}`;

  const prev = jieQiMark(l.getPrevJieQi(true));
  const next = jieQiMark(l.getNextJieQi(true));
  const jieQiToday = [prev, next].find(j => j.timeVn.startsWith(ymd)) ?? null;

  // getTimes(): 13 giờ — [0] Tý sớm 00:00–00:59, [1..11] Sửu…Hợi, [12] Tý muộn 23:00–23:59.
  // Ghép thành 12 giờ theo cách lịch Việt quen dùng: giờ Tý 23:00–00:59.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const times: any[] = l.getTimes();
  const hours: AlmanacHour[] = times.slice(0, 12).map((t, i) => ({
    zhi: t.getZhi(),
    ganZhi: t.getGanZhi(),
    start: i === 0 ? '23:00' : `${pad(i * 2 - 1)}:00`,
    end: `${pad(i * 2)}:59`,
    type: t.getTianShenType(),
    luck: t.getTianShenLuck(),
  }));

  const month0: number = l.getMonth();
  return {
    solar: { year, month, day, week: solar.getWeek() },
    lunar: {
      year: l.getYear(),
      month: Math.abs(month0),
      leap: month0 < 0,
      day: l.getDay(),
      yearGanZhi: l.getYearInGanZhi(),
      monthGanZhi: l.getMonthInGanZhi(),
      dayGanZhi: l.getDayInGanZhi(),
      yearShengXiao: l.getYearShengXiao(),
      monthCn: String(l.getMonthInChinese()).replace(/^闰/, ''),
      dayCn: l.getDayInChinese(),
    },
    jieQiToday,
    prevJieQi: prev,
    nextJieQi: next,
    tianShen: l.getDayTianShen(),
    tianShenType: l.getDayTianShenType(),
    tianShenLuck: l.getDayTianShenLuck(),
    zhiXing: l.getZhiXing(),
    xiu: l.getXiu(),
    xiuLuck: l.getXiuLuck(),
    naYin: l.getDayNaYin(),
    chong: { ganZhi: `${l.getDayChongGan()}${l.getDayChong()}`, shengXiao: l.getDayChongShengXiao() },
    sha: l.getDaySha(),
    positions: {
      xi: l.getDayPositionXiDesc(),
      cai: l.getDayPositionCaiDesc(),
      fu: l.getDayPositionFuDesc(),
    },
    yi: l.getDayYi(),
    ji: l.getDayJi(),
    jiShen: l.getDayJiShen(),
    xiongSha: l.getDayXiongSha(),
    pengZu: [l.getPengZuGan(), l.getPengZuZhi()],
    hours,
  };
}

/**
 * Chấm điểm nhanh một ngày cho lịch tháng: dựa vào hoàng/hắc đạo, sao, trực và
 * việc cần làm (nếu có). Không phải "độ chính xác" — chỉ để tô màu giúp người xem lọc ngày.
 *   good: hợp việc cần làm (có trong 宜, không trong 忌) hoặc — khi không chọn việc — ngày hoàng đạo
 *   bad:  việc cần làm nằm trong 忌, hoặc ngày 诸事不宜, hoặc hắc đạo mà sao xấu
 */
export type DayRating = 'good' | 'neutral' | 'bad';

export function rateDay(a: Pick<DayAlmanac, 'yi' | 'ji' | 'tianShenType' | 'xiuLuck'>, activity?: string): DayRating {
  if (a.yi.includes('诸事不宜')) return 'bad';
  if (activity) {
    if (a.ji.includes(activity)) return 'bad';
    if (a.yi.includes(activity)) return a.tianShenType === '黄道' || a.xiuLuck === '吉' ? 'good' : 'neutral';
    return 'neutral';
  }
  if (a.tianShenType === '黄道') return 'good';
  if (a.xiuLuck === '凶') return 'bad';
  return 'neutral';
}

/** Các việc hay được hỏi nhất — dùng làm bộ lọc "tìm ngày tốt cho việc…" */
export const COMMON_ACTIVITIES = [
  '嫁娶', '纳采', '开市', '交易', '立券', '出行', '移徙', '入宅', '动土', '修造', '上梁',
  '安床', '求财', '祭祀', '祈福', '求医', '治病', '安葬', '破土', '入学', '赴任', '理发', '裁衣',
] as const;

export interface MonthDay {
  day: number;
  lunarDay: number;
  lunarMonth: number;
  leap: boolean;
  dayGanZhi: string;
  tianShenType: string;
  zhiXing: string;
  rating: DayRating;
  jieQi: string | null;
}

export function getMonthAlmanac(year: number, month: number, activity?: string): MonthDay[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: MonthDay[] = [];
  for (let d = 1; d <= days; d++) {
    const a = getDayAlmanac(year, month, d);
    out.push({
      day: d,
      lunarDay: a.lunar.day,
      lunarMonth: a.lunar.month,
      leap: a.lunar.leap,
      dayGanZhi: a.lunar.dayGanZhi,
      tianShenType: a.tianShenType,
      zhiXing: a.zhiXing,
      rating: rateDay(a, activity),
      jieQi: a.jieQiToday?.name ?? null,
    });
  }
  return out;
}
