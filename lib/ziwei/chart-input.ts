/**
 * lib/ziwei/chart-input —— 校验并净化前端提交的命盘
 *
 * 为什么要这一层：/api/interpret 与 /api/heming 收到的 `chart` 是浏览器 POST 上来的，
 * 而它会被拼进模型的 prompt。任何自由文本都可能是注入载荷（"忽略上面的指令…"），
 * 所以这里不信任输入的任何一个字段，按白名单重建一个干净的 ZiweiChart。
 *
 * 为什么不干脆用 birthInfo 在服务端重排一遍：
 * algorithm.ts 的亮度流派（setBrightnessSchool）是模块级状态，由用户在前端的流派
 * 抽屉里切换。服务端重排会按默认流派出盘，和用户眼前看到的盘不一致 —— 解读就会
 * 对不上。所以保留前端盘的内容，只做结构与字符集净化；格局仍在服务端用
 * detectPatterns 从净化后的盘重新算，不采信前端送来的任何结论。
 */
import 'server-only';
import type {
  BirthInfo,
  DaXian,
  DaXianSiHua,
  LunarInfo,
  Palace,
  SelfSihuaMark,
  SiHua,
  Star,
  StarBrightness,
  ZiweiChart,
} from './types';

export class ChartInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartInputError';
  }
}

// ─── 枚举白名单 ────────────────────────────────────────────
const SIHUA: readonly SiHua[] = ['禄', '权', '科', '忌'];
const BRIGHTNESS_RAW: readonly StarBrightness[] = ['庙', '旺', '得', '利', '平', '不', '闲', '陷', '地'];
const BRIGHTNESS_COARSE = ['bright', 'normal', 'dim'] as const;
const STAR_TYPE = ['major', 'minor', 'lucky', 'sha'] as const;
const GENDER = ['male', 'female'] as const;

/**
 * 命理专名：只允许 1–6 个汉字。
 * 这一条就挡掉了注入 —— 换行、英文指令、标点全部进不来。
 */
const CJK_NAME = /^[一-鿿]{1,6}$/;
/** 四柱：恰好两个汉字（干 + 支） */
const PILLAR = /^[一-鿿]{2}$/;

const MAX_STARS_PER_PALACE = 40;
const MAX_DAXIAN = 16;

// ─── 基础取值 ──────────────────────────────────────────────
function obj(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new ChartInputError(`${field} 必须是对象`);
  }
  return v as Record<string, unknown>;
}

function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new ChartInputError(`${field} 必须是 ${min}–${max} 的整数，收到 ${JSON.stringify(v)}`);
  }
  return v;
}

function optInt(v: unknown, field: string, min: number, max: number): number | undefined {
  return v === undefined || v === null ? undefined : int(v, field, min, max);
}

function cjk(v: unknown, field: string): string {
  if (typeof v !== 'string' || !CJK_NAME.test(v)) {
    throw new ChartInputError(`${field} 必须是 1–6 个汉字，收到 ${JSON.stringify(v)}`);
  }
  return v;
}

function optCjk(v: unknown): string | undefined {
  return typeof v === 'string' && CJK_NAME.test(v) ? v : undefined;
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function must<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  const got = pick(v, allowed);
  if (got === undefined) {
    throw new ChartInputError(`${field} 必须是 ${allowed.join(' / ')} 之一，收到 ${JSON.stringify(v)}`);
  }
  return got;
}

function arr(v: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(v)) throw new ChartInputError(`${field} 必须是数组`);
  if (v.length > max) throw new ChartInputError(`${field} 最多 ${max} 项，收到 ${v.length} 项`);
  return v;
}

/**
 * 唯一的自由文本字段（姓名、省市）。
 * 只留汉字、字母、数字、空格与间隔号，再截断 —— 既能显示，又不可能携带指令。
 */
function freeText(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const cleaned = v
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^一-鿿A-Za-z0-9·\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : undefined;
}

// ─── 各段 ──────────────────────────────────────────────────
function cleanBirthInfo(raw: unknown): BirthInfo {
  const o = obj(raw, 'birthInfo');
  const info: BirthInfo = {
    year: int(o.year, 'birthInfo.year', 1900, 2100),
    month: int(o.month, 'birthInfo.month', 1, 12),
    day: int(o.day, 'birthInfo.day', 1, 31),
    // 注意：hour 是时辰地支索引 0–11，不是 0–23 的小时数
    hour: int(o.hour, 'birthInfo.hour', 0, 11),
    gender: must(o.gender, GENDER, 'birthInfo.gender'),
  };

  const name = freeText(o.name, 24);
  if (name) info.name = name;
  const province = freeText(o.province, 16);
  if (province) info.province = province;
  const city = freeText(o.city, 16);
  if (city) info.city = city;

  if (typeof o.longitude === 'number' && Number.isFinite(o.longitude)
      && o.longitude >= -180 && o.longitude <= 180) {
    info.longitude = o.longitude;
  }

  if (o.origInput !== undefined && o.origInput !== null) {
    const p = obj(o.origInput, 'birthInfo.origInput');
    info.origInput = {
      year: int(p.year, 'birthInfo.origInput.year', 1900, 2100),
      month: int(p.month, 'birthInfo.origInput.month', 1, 12),
      day: int(p.day, 'birthInfo.origInput.day', 1, 31),
      clockHour: int(p.clockHour, 'birthInfo.origInput.clockHour', 0, 23),
      clockMinute: int(p.clockMinute, 'birthInfo.origInput.clockMinute', 0, 59),
    };
  }

  return info;
}

function cleanPillars(raw: unknown): [string, string, string, string] | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  if (!raw.every(p => typeof p === 'string' && PILLAR.test(p))) return undefined;
  return [raw[0], raw[1], raw[2], raw[3]] as [string, string, string, string];
}

function cleanLunarInfo(raw: unknown): LunarInfo {
  const o = obj(raw, 'lunarInfo');
  const info: LunarInfo = {
    lunarYear: int(o.lunarYear, 'lunarInfo.lunarYear', 1900, 2100),
    // 负数 = 闰月，口径见 types.ts
    lunarMonth: int(o.lunarMonth, 'lunarInfo.lunarMonth', -12, 12),
    lunarDay: int(o.lunarDay, 'lunarInfo.lunarDay', 1, 30),
    yearStem: int(o.yearStem, 'lunarInfo.yearStem', 0, 9),
    yearBranch: int(o.yearBranch, 'lunarInfo.yearBranch', 0, 11),
    isLeapMonth: o.isLeapMonth === true,
  };
  const fp = cleanPillars(o.fourPillars);
  if (fp) info.fourPillars = fp;
  const fpl = cleanPillars(o.fourPillarsLunar);
  if (fpl) info.fourPillarsLunar = fpl;
  return info;
}

function cleanStar(raw: unknown, field: string): Star {
  const o = obj(raw, field);
  const star: Star = {
    name: cjk(o.name, `${field}.name`),
    type: must(o.type, STAR_TYPE, `${field}.type`),
  };
  const sihua = pick(o.siHua, SIHUA);
  if (sihua) star.siHua = sihua;
  const coarse = pick(o.brightness, BRIGHTNESS_COARSE);
  if (coarse) star.brightness = coarse;
  const rawB = pick(o.brightnessRaw, BRIGHTNESS_RAW);
  if (rawB) star.brightnessRaw = rawB;
  return star;
}

function cleanSelfSihua(raw: unknown, field: string): SelfSihuaMark[] {
  return arr(raw, field, 8).map((m, i) => {
    const o = obj(m, `${field}[${i}]`);
    return {
      siHua: must(o.siHua, SIHUA, `${field}[${i}].siHua`),
      starName: cjk(o.starName, `${field}[${i}].starName`),
    };
  });
}

function cleanPalace(raw: unknown, i: number): Palace {
  const field = `palaces[${i}]`;
  const o = obj(raw, field);

  const palace: Palace = {
    branch: int(o.branch, `${field}.branch`, 0, 11),
    stem: int(o.stem, `${field}.stem`, 0, 9),
    name: cjk(o.name, `${field}.name`),
    stars: arr(o.stars, `${field}.stars`, MAX_STARS_PER_PALACE)
      .map((s, j) => cleanStar(s, `${field}.stars[${j}]`)),
  };

  if (Array.isArray(o.daXianAge) && o.daXianAge.length === 2) {
    palace.daXianAge = [
      int(o.daXianAge[0], `${field}.daXianAge[0]`, 0, 200),
      int(o.daXianAge[1], `${field}.daXianAge[1]`, 0, 200),
    ];
  }
  if (o.isCurrentDaXian === true) palace.isCurrentDaXian = true;
  if (o.isMingGong === true) palace.isMingGong = true;
  if (o.isShenGong === true) palace.isShenGong = true;
  if (o.isEmpty === true) palace.isEmpty = true;

  if (o.selfSihua !== undefined && o.selfSihua !== null) {
    palace.selfSihua = cleanSelfSihua(o.selfSihua, `${field}.selfSihua`);
  }

  // 对宫恒等于 (branch + 6) % 12，不采信前端的值，直接重算
  palace.oppositeBranch = (palace.branch + 6) % 12;

  const borrowedFrom = optInt(o.borrowedFromBranch, `${field}.borrowedFromBranch`, 0, 11);
  if (borrowedFrom !== undefined) palace.borrowedFromBranch = borrowedFrom;
  const borrowedName = optCjk(o.borrowedFromName);
  if (borrowedName) palace.borrowedFromName = borrowedName;
  if (Array.isArray(o.borrowedStars)) {
    palace.borrowedStars = arr(o.borrowedStars, `${field}.borrowedStars`, MAX_STARS_PER_PALACE)
      .map((s, j) => cjk(s, `${field}.borrowedStars[${j}]`));
  }

  return palace;
}

function cleanDaXianSiHua(raw: unknown, field: string): DaXianSiHua | undefined {
  if (raw === undefined || raw === null) return undefined;
  const o = obj(raw, field);
  return {
    stemIndex: int(o.stemIndex, `${field}.stemIndex`, 0, 9),
    stemName: cjk(o.stemName, `${field}.stemName`),
    lu: optCjk(o.lu) ?? '',
    quan: optCjk(o.quan) ?? '',
    ke: optCjk(o.ke) ?? '',
    ji: optCjk(o.ji) ?? '',
  };
}

function cleanDaXian(raw: unknown, i: number): DaXian {
  const field = `daXians[${i}]`;
  const o = obj(raw, field);
  const dx: DaXian = {
    startAge: int(o.startAge, `${field}.startAge`, 0, 200),
    endAge: int(o.endAge, `${field}.endAge`, 0, 200),
    palaceBranch: int(o.palaceBranch, `${field}.palaceBranch`, 0, 11),
    palaceName: cjk(o.palaceName, `${field}.palaceName`),
  };
  const stemIndex = optInt(o.stemIndex, `${field}.stemIndex`, 0, 9);
  if (stemIndex !== undefined) dx.stemIndex = stemIndex;
  const stemName = optCjk(o.stemName);
  if (stemName) dx.stemName = stemName;
  const sihua = cleanDaXianSiHua(o.siHua, `${field}.siHua`);
  if (sihua) dx.siHua = sihua;
  return dx;
}

/**
 * 主入口：返回一个只含白名单字段的 ZiweiChart。
 * 校验不过就抛 ChartInputError，路由把它转成 400。
 */
export function sanitizeChart(raw: unknown, label = 'chart'): ZiweiChart {
  const o = obj(raw, label);

  const palacesRaw = arr(o.palaces, `${label}.palaces`, 12);
  if (palacesRaw.length !== 12) {
    throw new ChartInputError(`${label}.palaces 必须是 12 宫，收到 ${palacesRaw.length} 宫`);
  }
  const palaces = palacesRaw.map(cleanPalace);

  const branches = new Set(palaces.map(p => p.branch));
  if (branches.size !== 12) {
    throw new ChartInputError(`${label}.palaces 的 12 个地支必须互不重复`);
  }

  const chart: ZiweiChart = {
    birthInfo: cleanBirthInfo(o.birthInfo),
    lunarInfo: cleanLunarInfo(o.lunarInfo),
    mingGongBranch: int(o.mingGongBranch, `${label}.mingGongBranch`, 0, 11),
    shenGongBranch: int(o.shenGongBranch, `${label}.shenGongBranch`, 0, 11),
    wuxingJu: int(o.wuxingJu, `${label}.wuxingJu`, 2, 6),
    wuxingJuName: cjk(o.wuxingJuName, `${label}.wuxingJuName`),
    ziweiPos: int(o.ziweiPos, `${label}.ziweiPos`, 0, 11),
    palaces,
    daXians: arr(o.daXians, `${label}.daXians`, MAX_DAXIAN).map(cleanDaXian),
    currentAge: int(o.currentAge, `${label}.currentAge`, 0, 200),
    currentDaXianIndex: int(o.currentDaXianIndex, `${label}.currentDaXianIndex`, -2, MAX_DAXIAN),
  };

  const mingZhu = optCjk(o.mingZhu);
  if (mingZhu) chart.mingZhu = mingZhu;
  const shenZhu = optCjk(o.shenZhu);
  if (shenZhu) chart.shenZhu = shenZhu;
  const yyg = optCjk(o.yinYangGender);
  if (yyg) chart.yinYangGender = yyg;

  // analysisCacheProfile 是 /api/generate 下发的签名标记，解读侧用不到，直接丢掉

  return chart;
}
