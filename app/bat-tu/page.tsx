'use client';
import { useMemo, useRef, useState } from 'react';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import SubpageHeader from '@/components/SubpageHeader';
import AiContent, { readDeltaStream } from '@/components/AiContent';
import AiProviderSettings from '@/components/AiProviderSettings';
import { useI18n } from '@/components/LocaleProvider';
import { withUserProvider } from '@/lib/ai/user-provider-client';
import type { BirthInfo } from '@/lib/ziwei/types';
import {
  WX_GAN, WX_ZHI, buildBazi, currentDaYunIndex, yearGanZhi,
  type BaziChart, type BaziInput, type PillarKey,
} from '@/lib/bazi/chart';
import { viAlmanac } from '@/lib/almanac/terms-vi';

/**
 * Bát tự (Tứ trụ). Tứ trụ, thập thần, đại vận tính ngay trong trình duyệt;
 * chỉ phần luận giải gọi /api/bazi (server dựng lại tứ trụ từ ngày giờ sinh).
 */

const WX_COLOR: Record<string, string> = {
  木: '#3a8a4f', 火: '#c2412d', 土: '#a87a2a', 金: '#8f8a6e', 水: '#2f6db0',
};
const ELEMENTS = ['木', '火', '土', '金', '水'] as const;

const PILLAR_LABEL: Record<PillarKey, { vi: string; zh: string }> = {
  year: { vi: 'Năm', zh: '年柱' },
  month: { vi: 'Tháng', zh: '月柱' },
  day: { vi: 'Ngày', zh: '日柱' },
  time: { vi: 'Giờ', zh: '时柱' },
};

function nowYearVn(): number {
  return new Date(Date.now() + 7 * 3600_000).getUTCFullYear();
}

export default function BatTuPage() {
  const { locale, term, ganzhi } = useI18n();
  const zh = locale === 'zh';
  const L = (vi: string, z: string) => (zh ? z : vi);
  const ss = (name: string) => viAlmanac('shishen', name, locale);
  const wx = (name: string) => viAlmanac('wuxing', name, locale);
  const gz = (s: string) => (s.length === 2 ? ganzhi(s[0], s[1]) : s);

  const formRef = useRef<BirthFormState | null>(null);
  const [chart, setChart] = useState<BaziChart | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const aiRef = useRef<HTMLDivElement>(null);

  const year = nowYearVn();
  const curIdx = chart ? currentDaYunIndex(chart, year) : -1;
  const thisYearGz = useMemo(() => yearGanZhi(year), [year]);

  const onSubmit = (info: BirthInfo) => {
    setError(null);
    setAnalysis('');
    setAiError(null);
    const input: BaziInput = {
      year: info.year,
      month: info.month,
      day: info.day,
      hour: formRef.current?.unknownTime ? null : info.hour,
      gender: info.gender,
    };
    try {
      setChart(buildBazi(input));
    } catch {
      setError(L('Không lập được lá số cho ngày này (hỗ trợ năm 1901–2099).', '无法排盘（支持 1901–2099 年）。'));
    }
  };

  const runAi = async () => {
    if (!chart) return;
    setAnalyzing(true);
    setAnalysis('');
    setAiError(null);
    try {
      const res = await fetch('/api/bazi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withUserProvider({
          birth: chart.input,
          question: question.trim() || undefined,
          locale,
        })),
      });
      if (!res.ok) throw new Error(String(res.status));
      setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      await readDeltaStream(res, setAnalysis);
    } catch (e) {
      setAiError(L(`Luận giải thất bại (${(e as Error).message}), vui lòng thử lại.`, `解读失败（${(e as Error).message}），请稍后重试。`));
    } finally {
      setAnalyzing(false);
    }
  };

  const maxWeighted = chart ? Math.max(...ELEMENTS.map(e => chart.wuxingWeighted[e]), 1) : 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <SubpageHeader title={L('Bát tự · Tứ trụ', '四柱八字')} hint={L('Thập thần · Ngũ hành · Đại vận', '十神 · 五行 · 大运')} />

      <main className="bt-wrap">
        <div style={{ textAlign: 'center' }}>
          <h1 className="bt-h1">{L('Lá số Bát tự (Tứ trụ)', '四柱八字排盘')}</h1>
          <p className="bt-sub">
            {L(
              'Nhập ngày giờ sinh như khi lập lá số Tử Vi. Giờ sinh được hiệu chỉnh theo giờ mặt trời thật của nơi sinh; không rõ giờ thì chỉ lập ba trụ.',
              '输入出生时间（与紫微排盘相同，按出生地真太阳时校正）；时辰不详则只排三柱。',
            )}
          </p>
        </div>

        {/* BirthForm tự có khung thẻ riêng — không bọc thêm .bt-card để khỏi hai lớp viền trên điện thoại */}
        <section className="bt-form">
          <BirthForm onSubmit={onSubmit} onFormSave={f => { formRef.current = f; }} />
          {error && <p className="bt-error">{error}</p>}
        </section>

        {chart && (
          <>
            {/* Tứ trụ */}
            <section className="bt-card">
              <h2 className="bt-h2">{L('Tứ trụ', '四柱')} · {chart.input.gender === 'male' ? L('Nam (càn tạo)', '乾造') : L('Nữ (khôn tạo)', '坤造')}</h2>
              <div className="bt-table" style={{ gridTemplateColumns: `minmax(64px, auto) repeat(${chart.pillars.length}, 1fr)` }}>
                <div className="bt-rowhead" />
                {chart.pillars.map(p => <div key={p.key} className="bt-colhead">{PILLAR_LABEL[p.key][locale]}</div>)}

                <div className="bt-rowhead">{L('Thập thần', '十神')}</div>
                {chart.pillars.map(p => (
                  <div key={p.key} className="bt-cell bt-ss" style={p.key === 'day' ? { color: 'var(--ac)' } : undefined}>{ss(p.ganShiShen)}</div>
                ))}

                <div className="bt-rowhead">{L('Thiên can', '天干')}</div>
                {chart.pillars.map(p => (
                  <div key={p.key} className="bt-cell bt-char" style={{ color: WX_COLOR[WX_GAN[p.gan]] }}>
                    <span className="bt-han">{p.gan}</span>
                    <span className="bt-vi">{zh ? WX_GAN[p.gan] : `${term(p.gan)} · ${wx(WX_GAN[p.gan])}`}</span>
                  </div>
                ))}

                <div className="bt-rowhead">{L('Địa chi', '地支')}</div>
                {chart.pillars.map(p => (
                  <div key={p.key} className="bt-cell bt-char" style={{ color: WX_COLOR[WX_ZHI[p.zhi]] }}>
                    <span className="bt-han">{p.zhi}</span>
                    <span className="bt-vi">{zh ? WX_ZHI[p.zhi] : `${term(p.zhi)} · ${wx(WX_ZHI[p.zhi])}`}</span>
                  </div>
                ))}

                <div className="bt-rowhead">{L('Tàng can', '藏干')}</div>
                {chart.pillars.map(p => (
                  <div key={p.key} className="bt-cell bt-hidden">
                    {p.hidden.map(h => (
                      <div key={h.gan}>
                        <span style={{ color: WX_COLOR[WX_GAN[h.gan]], fontWeight: 600 }}>{zh ? h.gan : term(h.gan)}</span>
                        <span className="bt-muted"> {ss(h.shiShen)}</span>
                      </div>
                    ))}
                  </div>
                ))}

                <div className="bt-rowhead">{L('Nạp âm', '纳音')}</div>
                {chart.pillars.map(p => <div key={p.key} className="bt-cell bt-small">{viAlmanac('nayin', p.naYin, locale)}</div>)}

                <div className="bt-rowhead">{L('Trường sinh', '星运')}</div>
                {chart.pillars.map(p => <div key={p.key} className="bt-cell bt-small">{viAlmanac('changsheng', p.diShi, locale)}</div>)}
              </div>
              {chart.input.hour === null && (
                <p className="bt-note">{L('Không rõ giờ sinh nên thiếu trụ giờ — các nhận định về con cái, hậu vận sẽ kém chắc chắn.', '时辰不详，缺时柱，子女与晚运的判断会不够确定。')}</p>
              )}
            </section>

            {/* Nhật chủ + ngũ hành */}
            <section className="bt-two">
              <div className="bt-card">
                <h2 className="bt-h2">{L('Nhật chủ', '日主')}</h2>
                <div className="bt-dm" style={{ color: WX_COLOR[chart.dayMaster.wuxing] }}>
                  <span className="bt-han" style={{ fontSize: 40 }}>{chart.dayMaster.gan}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>
                    {zh
                      ? `${chart.dayMaster.yang ? '阳' : '阴'}${chart.dayMaster.wuxing}`
                      : `${term(chart.dayMaster.gan)} — ${chart.dayMaster.yang ? 'Dương' : 'Âm'} ${wx(chart.dayMaster.wuxing)}`}
                  </span>
                </div>
                <dl className="bt-dl">
                  <dt>{L('Không vong (trụ ngày)', '日空')}</dt><dd>{zh ? chart.xunKong : chart.xunKong.split('').map(c => term(c)).join(', ')}</dd>
                  <dt>{L('Thai nguyên', '胎元')}</dt><dd>{gz(chart.taiYuan)}</dd>
                  <dt>{L('Mệnh cung', '命宫')}</dt><dd>{gz(chart.mingGong)}</dd>
                  <dt>{L('Khởi vận', '起运')}</dt>
                  <dd>
                    {zh
                      ? `出生后 ${chart.yunStart.years} 年 ${chart.yunStart.months} 个月 ${chart.yunStart.days} 天（${chart.yunStart.solarDate}），${chart.yunStart.forward ? '顺' : '逆'}行`
                      : `sau khi sinh ${chart.yunStart.years} năm ${chart.yunStart.months} tháng ${chart.yunStart.days} ngày (${chart.yunStart.solarDate.split('-').reverse().join('/')}), đi ${chart.yunStart.forward ? 'thuận' : 'nghịch'}`}
                  </dd>
                </dl>
              </div>
              <div className="bt-card">
                <h2 className="bt-h2">{L('Ngũ hành', '五行')}</h2>
                <div className="bt-bars">
                  {ELEMENTS.map(e => (
                    <div key={e} className="bt-bar-row">
                      <span className="bt-bar-label" style={{ color: WX_COLOR[e] }}>{zh ? e : wx(e)}</span>
                      <div className="bt-bar-track">
                        <div className="bt-bar" style={{ width: `${(chart.wuxingWeighted[e] / maxWeighted) * 100}%`, background: WX_COLOR[e] }} />
                      </div>
                      <span className="bt-bar-num">{chart.wuxingCount[e]} <span className="bt-muted">/ {chart.wuxingWeighted[e]}</span></span>
                    </div>
                  ))}
                </div>
                <p className="bt-note">
                  {L(
                    'Số đầu: số chữ can chi lộ thuộc hành đó. Số sau: có tính tàng can (bản khí 1, trung/dư khí 0,5). Đây chỉ là đếm thô — vượng suy thật còn tuỳ lệnh tháng và gốc rễ.',
                    '前：天干地支本字个数；后：含藏干（本气 1，中余气 0.5）。仅为粗略统计，旺衰还要看月令与通根。',
                  )}
                </p>
              </div>
            </section>

            {/* Đại vận */}
            <section className="bt-card">
              <h2 className="bt-h2">
                {L('Đại vận', '大运')}
                <span className="bt-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                  {L(`Năm ${year}: ${gz(thisYearGz)}`, `${year} 流年 ${thisYearGz}`)}
                </span>
              </h2>
              <div className="bt-yun">
                {chart.daYun.map((d, i) => (
                  <div key={d.ganZhi + d.startYear} className="bt-yun-item" style={i === curIdx ? { borderColor: 'var(--ac)', background: 'var(--ac-bg)' } : undefined}>
                    <div className="bt-small bt-muted">{d.startAge}–{d.endAge} {L('tuổi', '岁')}</div>
                    <div className="bt-yun-gz">
                      <span style={{ color: WX_COLOR[WX_GAN[d.ganZhi[0]]] }}>{d.ganZhi[0]}</span>
                      <span style={{ color: WX_COLOR[WX_ZHI[d.ganZhi[1]]] }}>{d.ganZhi[1]}</span>
                    </div>
                    {!zh && <div className="bt-small">{gz(d.ganZhi)}</div>}
                    <div className="bt-small bt-muted">{ss(d.ganShiShen)} / {ss(d.zhiShiShen)}</div>
                    <div className="bt-small">{d.startYear}–{d.endYear}</div>
                    {i === curIdx && <div className="bt-small" style={{ color: 'var(--ac)', fontWeight: 600 }}>{L('Hiện tại', '当前')}</div>}
                  </div>
                ))}
              </div>
              <p className="bt-note">{L('Tuổi tính theo tuổi mụ (âm).', '年龄为虚岁。')}</p>
            </section>

            {/* AI */}
            <section className="bt-card" ref={aiRef}>
              <div className="bt-ai-head">
                <h2 className="bt-h2" style={{ margin: 0 }}>{L('Luận giải AI', 'AI 解读')}</h2>
                <div style={{ flex: 1 }} />
                <AiProviderSettings compact />
              </div>
              <div className="bt-ask">
                <input
                  className="bt-input"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder={L('Câu hỏi riêng (không bắt buộc), ví dụ: năm sau có nên đổi việc?', '可选：你想问的具体问题，例如明年适合换工作吗？')}
                  maxLength={500}
                />
                <button type="button" className="bt-go" onClick={runAi} disabled={analyzing}>
                  {analyzing ? L('Đang luận…', '解读中…') : analysis ? L('Luận lại', '重新解读') : L('Luận giải Bát tự', '开始解读')}
                </button>
              </div>
              {aiError && <p className="bt-error">{aiError}</p>}
              {(analysis || analyzing) && (
                <div className="bt-ai-body">
                  <AiContent text={analysis} streaming={analyzing} />
                </div>
              )}
              {!analysis && !analyzing && (
                <p className="bt-note">
                  {L(
                    'AI luận theo phương pháp Tử Bình thông dụng, dựa trên tứ trụ và đại vận ở trên. Phần này không có trích dẫn — kho lời Nghê sư của trang chỉ dành cho Tử Vi.',
                    'AI 按子平法通行看法分析上面的四柱与大运。本站倪师原话库只覆盖紫微斗数，故此处不附出处。',
                  )}
                </p>
              )}
            </section>
          </>
        )}
      </main>

      <style>{`
        .bt-wrap { max-width: 980px; margin: 0 auto; padding: 28px 16px 80px; display: flex; flex-direction: column; gap: 16px; }
        .bt-h1 { font-size: 22px; font-weight: 600; letter-spacing: 0.08em; color: var(--tx-0); margin: 0 0 8px; }
        .bt-sub { font-size: 13px; color: var(--tx-3); line-height: 1.7; max-width: 620px; margin: 0 auto; }
        .bt-card { background: var(--bg-card); border: 1px solid var(--bdr-med); border-radius: 16px; padding: 20px; }
        .bt-form { max-width: 640px; width: 100%; margin: 0 auto; }
        .bt-h2 { font-size: 14px; font-weight: 600; letter-spacing: 0.06em; margin: 0 0 14px; color: var(--tx-1); }
        .bt-error { color: var(--ji); font-size: 13px; margin: 10px 0 0; }
        .bt-note { font-size: 12px; color: var(--tx-3); line-height: 1.7; margin: 12px 0 0; }
        .bt-muted { color: var(--tx-3); }
        .bt-small { font-size: 12px; color: var(--tx-2); }
        .bt-table { display: grid; gap: 1px; background: var(--bdr); border: 1px solid var(--bdr); border-radius: 12px; overflow: hidden; }
        .bt-table > div { background: var(--bg-0); padding: 8px 6px; }
        .bt-colhead { text-align: center; font-size: 12px; font-weight: 600; color: var(--tx-2); }
        .bt-rowhead { font-size: 11px; color: var(--tx-3); display: flex; align-items: center; }
        .bt-cell { text-align: center; }
        .bt-ss { font-size: 13px; font-weight: 600; color: var(--tx-1); }
        .bt-char { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .bt-han { font-family: "STSong", "Songti SC", "Noto Serif SC", serif; font-size: 30px; line-height: 1.1; font-weight: 600; }
        .bt-vi { font-size: 11px; font-weight: 500; }
        .bt-hidden { font-size: 12px; line-height: 1.7; }
        .bt-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .bt-dm { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        .bt-dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: 13px; }
        .bt-dl dt { color: var(--tx-3); }
        .bt-dl dd { margin: 0; color: var(--tx-1); }
        .bt-bars { display: flex; flex-direction: column; gap: 10px; }
        .bt-bar-row { display: grid; grid-template-columns: 52px 1fr 64px; align-items: center; gap: 10px; }
        .bt-bar-label { font-size: 13px; font-weight: 600; }
        .bt-bar-track { height: 10px; background: var(--bg-2); border-radius: 999px; overflow: hidden; }
        .bt-bar { height: 100%; border-radius: 999px; transition: width .4s ease; }
        .bt-bar-num { font-size: 13px; text-align: right; color: var(--tx-1); }
        .bt-yun { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
        .bt-yun-item { border: 1px solid var(--bdr-med); border-radius: 12px; padding: 10px 6px; text-align: center; display: flex; flex-direction: column; gap: 3px; }
        .bt-yun-gz { font-family: "STSong", "Songti SC", "Noto Serif SC", serif; font-size: 22px; font-weight: 600; }
        .bt-ai-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .bt-ask { display: flex; gap: 8px; flex-wrap: wrap; }
        .bt-input { flex: 1; min-width: 220px; height: 40px; border-radius: 10px; border: 1px solid var(--bdr-med);
          background: var(--bg-0); color: var(--tx-0); padding: 0 12px; font-size: 14px; }
        .bt-go { height: 40px; padding: 0 22px; border: none; border-radius: 999px; cursor: pointer; font-size: 14px; font-weight: 600;
          color: #fff8e8; background: linear-gradient(135deg, #9a6210, #c88020); letter-spacing: 0.04em; }
        .bt-go:disabled { opacity: 0.6; cursor: wait; }
        .bt-ai-body { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--bdr); }
        @media (max-width: 640px) {
          .bt-two { grid-template-columns: 1fr; }
          .bt-han { font-size: 24px; }
          .bt-table > div { padding: 6px 3px; }
          .bt-hidden { font-size: 11px; }
          .bt-go { width: 100%; }
        }
      `}</style>
    </div>
  );
}
