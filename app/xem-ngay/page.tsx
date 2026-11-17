'use client';
import { useEffect, useMemo, useState } from 'react';
import SubpageHeader from '@/components/SubpageHeader';
import { useI18n } from '@/components/LocaleProvider';
import {
  COMMON_ACTIVITIES, getDayAlmanac, getMonthAlmanac, isValidSolarDate,
  type DayRating,
} from '@/lib/almanac/day';
import { viAlmanac, type AlmanacTable } from '@/lib/almanac/terms-vi';

/**
 * Xem ngày tốt xấu — tính hoàn toàn trong trình duyệt bằng lunar-javascript, không gọi server.
 * Ngày đang xem được ghi vào ?d=YYYY-MM-DD để gửi link cho người khác.
 */

interface Ymd { y: number; m: number; d: number }

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;

function today(): Ymd {
  // Giờ Việt Nam, kể cả khi máy người xem đặt múi giờ khác
  const now = new Date(Date.now() + 7 * 3600_000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

function shiftDay(a: Ymd, delta: number): Ymd {
  const t = new Date(Date.UTC(a.y, a.m - 1, a.d + delta));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function parseIso(s: string | null): Ymd | null {
  const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const v = { y: +m[1], m: +m[2], d: +m[3] };
  return isValidSolarDate(v.y, v.m, v.d) ? v : null;
}

const WEEK_VI = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEK_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEK_HEAD_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEK_HEAD_ZH = ['一', '二', '三', '四', '五', '六', '日'];

const RATING_COLOR: Record<DayRating, string> = {
  good: 'var(--lu)',
  neutral: 'var(--tx-3)',
  bad: 'var(--ji)',
};

export default function XemNgayPage() {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  // Trang được dựng tĩnh lúc build: "hôm nay" và ?d= chỉ biết được trên trình duyệt,
  // nên chờ mount rồi mới dựng phần lịch (tránh lệch nội dung khi hydrate).
  const [initial, setInitial] = useState<Ymd | null>(null);
  useEffect(() => {
    setInitial(parseIso(new URLSearchParams(window.location.search).get('d')) ?? today());
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <SubpageHeader
        title={zh ? '黄历择日' : 'Xem ngày tốt xấu'}
        hint={zh ? '黄道 · 宜忌 · 吉时' : 'Hoàng đạo · Nên / kiêng · Giờ tốt'}
      />
      <h1 className="xn-h1">{zh ? '黄历 · 每日宜忌' : 'Xem ngày tốt xấu theo lịch vạn niên'}</h1>
      <p className="xn-intro">
        {zh
          ? '查看任意一天的黄道黑道、宜忌、吉时、建除、二十八宿、冲煞与出行方位，并按事项挑选整月吉日。'
          : 'Tra ngày hoàng đạo hay hắc đạo, việc nên làm và nên tránh, giờ hoàng đạo, trực, sao, tuổi xung và hướng xuất hành của bất kỳ ngày nào — và lọc cả tháng để chọn ngày cưới hỏi, khai trương, nhập trạch, động thổ.'}
      </p>
      {initial ? <AlmanacBody initial={initial} /> : <div style={{ height: 600 }} />}
      <style>{CSS}</style>
    </div>
  );
}

function AlmanacBody({ initial }: { initial: Ymd }) {
  const { locale, ganzhi, term } = useI18n();
  const zh = locale === 'zh';
  const L = (vi: string, z: string) => (zh ? z : vi);
  const tr = (table: AlmanacTable, name: string) => viAlmanac(table, name, locale);
  const gz = (s: string) => (s.length === 2 ? ganzhi(s[0], s[1]) : s);

  const [sel, setSel] = useState<Ymd>(initial);
  const [view, setView] = useState<{ y: number; m: number }>({ y: initial.y, m: initial.m });
  const [activity, setActivity] = useState<string>('');

  const pick = (v: Ymd) => {
    setSel(v);
    setView({ y: v.y, m: v.m });
    window.history.replaceState(null, '', `?d=${toIso(v)}`);
  };

  const a = useMemo(() => getDayAlmanac(sel.y, sel.m, sel.d), [sel]);
  const month = useMemo(() => getMonthAlmanac(view.y, view.m, activity || undefined), [view, activity]);
  const firstWeekday = (new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay() + 6) % 7; // T2 = 0

  const lunarText = zh
    ? `农历${a.lunar.leap ? '闰' : ''}${a.lunar.monthCn}月${a.lunar.dayCn}`
    : `Âm lịch: ${a.lunar.day <= 10 ? 'mùng ' : 'ngày '}${a.lunar.day} tháng ${a.lunar.month}${a.lunar.leap ? ' (nhuận)' : ''}`;

  const hoangDao = a.tianShenType === '黄道';
  const goodHours = a.hours.filter(h => h.type === '黄道');

  const monthStep = (delta: number) => {
    const t = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
    setView({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 });
  };

  return (
    <>
      <main className="xn-wrap">
        {/* Chọn ngày */}
        <div className="xn-picker">
          <button type="button" className="xn-btn" onClick={() => pick(shiftDay(sel, -1))} aria-label={L('Ngày trước', '前一天')}>‹</button>
          <input
            type="date"
            className="xn-date"
            value={toIso(sel)}
            min="1901-01-01"
            max="2099-12-31"
            onChange={e => { const v = parseIso(e.target.value); if (v) pick(v); }}
            aria-label={L('Chọn ngày dương lịch', '选择公历日期')}
          />
          <button type="button" className="xn-btn" onClick={() => pick(shiftDay(sel, 1))} aria-label={L('Ngày sau', '后一天')}>›</button>
          <button type="button" className="xn-btn xn-today" onClick={() => pick(today())}>{L('Hôm nay', '今天')}</button>
        </div>

        {/* Thẻ tổng quan */}
        <section className="xn-card xn-hero">
          <div className="xn-hero-date">
            <div className="xn-weekday">{(zh ? WEEK_ZH : WEEK_VI)[a.solar.week]}</div>
            <div className="xn-day">{a.solar.day}</div>
            <div className="xn-month">{L(`tháng ${a.solar.month} năm ${a.solar.year}`, `${a.solar.year}年${a.solar.month}月`)}</div>
          </div>
          <div className="xn-hero-info">
            <div className="xn-lunar">{lunarText}</div>
            <div className="xn-gz">
              {L('Ngày', '日')} <b>{gz(a.lunar.dayGanZhi)}</b> · {L('tháng', '月')} <b>{gz(a.lunar.monthGanZhi)}</b> · {L('năm', '年')} <b>{gz(a.lunar.yearGanZhi)}</b>
            </div>
            <div className="xn-badge" style={{
              color: hoangDao ? 'var(--lu)' : 'var(--ji)',
              borderColor: hoangDao ? 'var(--lu)' : 'var(--ji)',
            }}>
              {hoangDao ? '●' : '○'} {L(`Ngày ${tr('luck', a.tianShenType)}`, `${a.tianShenType}日`)} — {tr('shensha', a.tianShen)}
            </div>
            {a.jieQiToday && (
              <div className="xn-jieqi">
                {L('Giao tiết', '交节')} <b>{tr('jieqi', a.jieQiToday.name)}</b> {L('lúc', '于')} {a.jieQiToday.timeVn.slice(11)} {L('(giờ VN)', '（越南时间）')}
              </div>
            )}
          </div>
        </section>

        {/* Các chỉ số */}
        <section className="xn-facts">
          <Fact label={L('Trực', '建除')} value={tr('zhixing', a.zhiXing)} />
          <Fact
            label={L('Sao (Nhị thập bát tú)', '二十八宿')}
            value={`${tr('xiu', a.xiu)} · ${tr('luck', a.xiuLuck)}`}
            color={a.xiuLuck === '吉' ? 'var(--lu)' : 'var(--ji)'}
          />
          <Fact label={L('Nạp âm ngày', '纳音')} value={tr('nayin', a.naYin)} />
          <Fact
            label={L('Tuổi xung', '冲')}
            value={zh ? `冲${a.chong.shengXiao}（${a.chong.ganZhi}）煞${a.sha}` : `${gz(a.chong.ganZhi)} (tuổi ${tr('shengxiao', a.chong.shengXiao)}) · sát hướng ${tr('position', a.sha)}`}
          />
          <Fact
            label={L('Hướng xuất hành', '出行方位')}
            value={zh
              ? `喜神${a.positions.xi} · 财神${a.positions.cai} · 福神${a.positions.fu}`
              : `Hỷ thần ${tr('position', a.positions.xi)} · Tài thần ${tr('position', a.positions.cai)} · Phúc thần ${tr('position', a.positions.fu)}`}
          />
          <Fact
            label={L('Tiết khí', '节气')}
            value={`${tr('jieqi', a.prevJieQi.name)} → ${tr('jieqi', a.nextJieQi.name)} (${a.nextJieQi.timeVn.slice(8, 10)}/${a.nextJieQi.timeVn.slice(5, 7)})`}
          />
        </section>

        {/* Nên / kiêng */}
        <section className="xn-two">
          <div className="xn-card">
            <h2 className="xn-h2" style={{ color: 'var(--lu)' }}>{L('Nên làm', '宜')}</h2>
            <Chips items={a.yi.map(x => tr('yiji', x))} tone="good" />
          </div>
          <div className="xn-card">
            <h2 className="xn-h2" style={{ color: 'var(--ji)' }}>{L('Không nên', '忌')}</h2>
            <Chips items={a.ji.map(x => tr('yiji', x))} tone="bad" />
          </div>
        </section>

        {/* Giờ hoàng đạo */}
        <section className="xn-card">
          <h2 className="xn-h2">{L('Giờ trong ngày', '时辰吉凶')}</h2>
          <p className="xn-note">
            {L('Giờ hoàng đạo: ', '黄道吉时：')}
            {goodHours.map(h => `${term(h.zhi)} (${h.start}–${h.end})`).join(', ')}
          </p>
          <div className="xn-hours">
            {a.hours.map(h => {
              const good = h.type === '黄道';
              return (
                <div key={h.zhi} className="xn-hour" style={{
                  borderColor: good ? 'var(--lu)' : 'var(--bdr-med)',
                  background: good ? 'color-mix(in srgb, var(--lu) 9%, transparent)' : 'transparent',
                }}>
                  <div className="xn-hour-name" style={{ color: good ? 'var(--lu)' : 'var(--tx-3)' }}>{gz(h.ganZhi)}</div>
                  <div className="xn-hour-time">{h.start}–{h.end}</div>
                  <div className="xn-hour-type" style={{ color: good ? 'var(--lu)' : 'var(--tx-3)' }}>
                    {zh ? h.type : tr('luck', h.type)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Thần sát */}
        <section className="xn-two">
          <div className="xn-card">
            <h2 className="xn-h2">{L('Cát thần', '吉神宜趋')}</h2>
            <Chips items={a.jiShen.map(x => tr('shensha', x))} tone="soft" />
          </div>
          <div className="xn-card">
            <h2 className="xn-h2">{L('Hung sát', '凶煞宜忌')}</h2>
            <Chips items={a.xiongSha.map(x => tr('shensha', x))} tone="soft" />
          </div>
        </section>
        {zh && (
          <p className="xn-note" style={{ textAlign: 'center' }}>彭祖百忌：{a.pengZu.join(' · ')}</p>
        )}

        {/* Lịch tháng */}
        <section className="xn-card">
          <div className="xn-cal-head">
            <button type="button" className="xn-btn" onClick={() => monthStep(-1)} aria-label={L('Tháng trước', '上个月')}>‹</button>
            <h2 className="xn-h2" style={{ margin: 0 }}>{L(`Tháng ${view.m}/${view.y}`, `${view.y}年${view.m}月`)}</h2>
            <button type="button" className="xn-btn" onClick={() => monthStep(1)} aria-label={L('Tháng sau', '下个月')}>›</button>
            <div style={{ flex: 1 }} />
            <label className="xn-filter">
              <span>{L('Tìm ngày tốt cho', '择日事项')}</span>
              <select value={activity} onChange={e => setActivity(e.target.value)}>
                <option value="">{L('— Mọi việc (theo hoàng đạo) —', '— 不限（按黄道） —')}</option>
                {COMMON_ACTIVITIES.map(x => <option key={x} value={x}>{tr('yiji', x)}</option>)}
              </select>
            </label>
          </div>
          <div className="xn-cal">
            {(zh ? WEEK_HEAD_ZH : WEEK_HEAD_VI).map(w => <div key={w} className="xn-cal-wd">{w}</div>)}
            {Array.from({ length: firstWeekday }, (_, i) => <div key={`e${i}`} />)}
            {month.map(d => {
              const active = view.y === sel.y && view.m === sel.m && d.day === sel.d;
              return (
                <button
                  key={d.day}
                  type="button"
                  className="xn-cal-day"
                  onClick={() => pick({ y: view.y, m: view.m, d: d.day })}
                  style={{
                    borderColor: active ? 'var(--ac)' : 'var(--bdr)',
                    background: active ? 'var(--ac-bg)' : 'transparent',
                  }}
                  aria-label={`${d.day}/${view.m}`}
                >
                  <span className="xn-cal-solar" style={{ color: RATING_COLOR[d.rating] }}>{d.day}</span>
                  <span className="xn-cal-lunar">
                    {d.lunarDay === 1 ? `${d.lunarDay}/${d.lunarMonth}${d.leap ? '*' : ''}` : d.lunarDay}
                  </span>
                  {d.jieQi && <span className="xn-cal-jq">{tr('jieqi', d.jieQi)}</span>}
                  <span className="xn-dot" style={{ background: RATING_COLOR[d.rating], opacity: d.rating === 'neutral' ? 0 : 1 }} />
                </button>
              );
            })}
          </div>
          <p className="xn-note">
            {activity
              ? L(`Xanh: ngày nên «${tr('yiji', activity)}» · Đỏ: ngày kiêng việc này · Xám: không nói tới.`, `绿：宜${activity} · 红：忌${activity} · 灰：未提及。`)
              : L('Xanh: ngày hoàng đạo · Đỏ: hắc đạo gặp sao xấu, hoặc ngày «mọi việc không nên» · Số nhỏ là ngày âm lịch.', '绿：黄道日 · 红：黑道且值凶宿，或诸事不宜 · 小字为农历日。')}
          </p>
        </section>

        <p className="xn-foot">
          {L(
            'Dữ liệu tra theo bảng hoàng lịch truyền thống (thư viện lunar-javascript). Ngày âm lịch tính theo lịch Trung Hoa, hiếm khi lệch một ngày đầu tháng so với lịch Việt; can chi, trực, sao, hoàng đạo không bị ảnh hưởng. Chỉ để tham khảo.',
            '数据依传统黄历表（lunar-javascript）。仅供参考。',
          )}
        </p>
      </main>
    </>
  );
}

const CSS = `
        .xn-h1 { font-size: 22px; font-weight: 600; letter-spacing: 0.04em; color: var(--tx-0); text-align: center; margin: 28px 16px 8px; }
        .xn-intro { font-size: 13px; color: var(--tx-3); line-height: 1.7; text-align: center; max-width: 640px; margin: 0 auto; padding: 0 16px; }
        .xn-wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 80px; display: flex; flex-direction: column; gap: 16px; }
        .xn-card { background: var(--bg-card); border: 1px solid var(--bdr-med); border-radius: 16px; padding: 20px; }
        .xn-picker { display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap; }
        .xn-btn { min-width: 36px; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--bdr-med);
          background: var(--bg-card); color: var(--tx-1); cursor: pointer; font-size: 15px; }
        .xn-btn:hover { border-color: var(--ac); color: var(--ac); }
        .xn-today { font-size: 13px; }
        .xn-date { height: 36px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--bdr-med);
          background: var(--bg-card); color: var(--tx-0); font-size: 14px; color-scheme: light dark; }
        .xn-hero { display: flex; gap: 24px; align-items: center; }
        .xn-hero-date { text-align: center; min-width: 120px; padding-right: 24px; border-right: 1px solid var(--bdr-med); }
        .xn-weekday { font-size: 13px; color: var(--tx-3); }
        .xn-day { font-size: 64px; line-height: 1; font-weight: 700; color: var(--ac); margin: 6px 0; }
        .xn-month { font-size: 13px; color: var(--tx-2); }
        .xn-hero-info { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .xn-lunar { font-size: 18px; font-weight: 600; color: var(--tx-0); }
        .xn-gz { font-size: 14px; color: var(--tx-2); }
        .xn-gz b { color: var(--tx-0); font-weight: 600; }
        .xn-badge { align-self: flex-start; font-size: 13px; font-weight: 600; padding: 4px 12px; border: 1px solid; border-radius: 999px; }
        .xn-jieqi { font-size: 13px; color: var(--ac); }
        .xn-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .xn-fact { background: var(--bg-card); border: 1px solid var(--bdr); border-radius: 12px; padding: 12px 14px; }
        .xn-fact-label { font-size: 11px; color: var(--tx-3); letter-spacing: 0.04em; margin-bottom: 4px; }
        .xn-fact-value { font-size: 14px; color: var(--tx-0); font-weight: 500; line-height: 1.5; }
        .xn-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .xn-h2 { font-size: 14px; font-weight: 600; letter-spacing: 0.06em; margin: 0 0 12px; color: var(--tx-1); }
        .xn-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .xn-chip { font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid; line-height: 1.4; }
        .xn-note { font-size: 12px; color: var(--tx-3); line-height: 1.7; margin: 10px 0 0; }
        .xn-hours { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 12px; }
        .xn-hour { border: 1px solid; border-radius: 10px; padding: 8px 6px; text-align: center; }
        .xn-hour-name { font-size: 13px; font-weight: 600; }
        .xn-hour-time { font-size: 11px; color: var(--tx-3); margin: 2px 0; }
        .xn-hour-type { font-size: 11px; }
        .xn-cal-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .xn-filter { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--tx-3); }
        .xn-filter select { height: 34px; border-radius: 10px; border: 1px solid var(--bdr-med); background: var(--bg-card);
          color: var(--tx-0); padding: 0 8px; font-size: 13px; max-width: 220px; }
        .xn-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .xn-cal-wd { text-align: center; font-size: 11px; color: var(--tx-3); padding-bottom: 4px; }
        .xn-cal-day { position: relative; min-height: 62px; border: 1px solid; border-radius: 10px; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 4px 2px; font: inherit; }
        .xn-cal-day:hover { border-color: var(--ac) !important; }
        .xn-cal-solar { font-size: 16px; font-weight: 600; }
        .xn-cal-lunar { font-size: 10px; color: var(--tx-3); }
        .xn-cal-jq { font-size: 9px; color: var(--ac); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .xn-dot { position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; border-radius: 50%; }
        .xn-foot { font-size: 11px; color: var(--tx-3); text-align: center; line-height: 1.7; max-width: 680px; margin: 8px auto 0; }
        @media (max-width: 720px) {
          .xn-facts { grid-template-columns: 1fr 1fr; }
          .xn-hours { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 560px) {
          .xn-hero { flex-direction: column; align-items: stretch; gap: 14px; }
          .xn-hero-date { border-right: none; border-bottom: 1px solid var(--bdr-med); padding: 0 0 12px; }
          .xn-two { grid-template-columns: 1fr; }
          .xn-facts { grid-template-columns: 1fr; }
          .xn-hours { grid-template-columns: repeat(3, 1fr); }
          .xn-cal { gap: 3px; }
          .xn-cal-day { min-height: 52px; }
          .xn-cal-jq { display: none; }
          .xn-filter { width: 100%; }
          .xn-filter select { flex: 1; max-width: none; }
        }
`;

function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="xn-fact">
      <div className="xn-fact-label">{label}</div>
      <div className="xn-fact-value" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function Chips({ items, tone }: { items: string[]; tone: 'good' | 'bad' | 'soft' }) {
  const color = tone === 'good' ? 'var(--lu)' : tone === 'bad' ? 'var(--ji)' : 'var(--tx-2)';
  const shown = items.filter(x => x && x !== '—');
  if (shown.length === 0) return <div className="xn-note" style={{ margin: 0 }}>—</div>;
  return (
    <div className="xn-chips">
      {shown.map(x => (
        <span key={x} className="xn-chip" style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}>{x}</span>
      ))}
    </div>
  );
}
