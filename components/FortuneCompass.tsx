'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/components/LocaleProvider';
import {
  ELEMENT_VI, MOUNTAINS, RELATION_TEXT, STEMS, STEMS_VI, TRIGRAMS,
  dayStemIndex, mountainAt, relation, type Element, type Mountain,
} from '@/lib/compass/data';

/**
 * La bàn vận mệnh — đĩa la bàn bát quái kéo/vuốt để quay, có quán tính.
 *
 * Hình khối: địa bàn vuông dày (một khối dẹt dựng bằng CSS 3D) đỡ thiên bàn tròn; chỉ đỏ thập tự
 * và kim cố định ở trên. Cả khối nghiêng theo chuột cho cảm giác không gian.
 * Vòng quay chạy bằng requestAnimationFrame và gán transform trực tiếp (không re-render React mỗi khung).
 */

const VB = 250; // viewBox -250..250
const R = { rim: 246, tickIn: 232, sonIn: 192, guaIn: 140, nameIn: 104, wxIn: 70 };
const FRICTION_PER_MS = 0.9985;
const STOP_SPEED = 0.006; // độ / ms
const MAX_SPEED = 2.6;
const BASE_TILT = 24;

const WX_COLOR: Record<Element, string> = {
  木: '#5fae6e', 火: '#e0644f', 土: '#c9a052', 金: '#e9dfc0', 水: '#5a93d6',
};
const CARDINAL = new Set(['子', '卯', '午', '酉']);

function polar(r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function arcPath(r1: number, r2: number, from: number, to: number): string {
  const [x1, y1] = polar(r2, from);
  const [x2, y2] = polar(r2, to);
  const [x3, y3] = polar(r1, to);
  const [x4, y4] = polar(r1, from);
  const large = to - from > 180 ? 1 : 0;
  return `M${x1},${y1} A${r2},${r2} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 ${large} 0 ${x4},${y4} Z`;
}

/** Mặt đĩa — vẽ một lần */
function DiscFace({ zh }: { zh: boolean }) {
  return (
    <svg viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`} className="fc-svg" aria-hidden="true">
      <defs>
        <radialGradient id="fc-disc-bg" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#1b2440" />
          <stop offset="70%" stopColor="#0c1226" />
          <stop offset="100%" stopColor="#060914" />
        </radialGradient>
        <linearGradient id="fc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dc94" />
          <stop offset="50%" stopColor="#c99a3c" />
          <stop offset="100%" stopColor="#f0d080" />
        </linearGradient>
      </defs>

      <circle r={R.rim} fill="url(#fc-disc-bg)" stroke="url(#fc-gold)" strokeWidth="3" />

      {/* Vạch độ */}
      {Array.from({ length: 72 }, (_, i) => {
        const deg = i * 5;
        const long = deg % 15 === 0;
        const [x1, y1] = polar(R.rim - 3, deg);
        const [x2, y2] = polar(long ? R.tickIn - 2 : R.tickIn + 5, deg);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d4a843" strokeOpacity={long ? 0.85 : 0.4} strokeWidth={long ? 1.4 : 0.8} />;
      })}

      {/* 24 sơn */}
      <circle r={R.tickIn} fill="none" stroke="#d4a843" strokeOpacity="0.55" strokeWidth="1" />
      {MOUNTAINS.map(m => {
        const [x1, y1] = polar(R.sonIn, m.angle + 7.5);
        const [x2, y2] = polar(R.tickIn, m.angle + 7.5);
        return (
          <g key={m.han}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d4a843" strokeOpacity="0.35" strokeWidth="0.8" />
            <g transform={`rotate(${m.angle})`}>
              <text y={-(R.sonIn + 24)} textAnchor="middle" className="fc-son" fill={CARDINAL.has(m.han) ? '#ef6a55' : '#f0d79a'}>{m.han}</text>
              {!zh && <text y={-(R.sonIn + 7)} textAnchor="middle" className="fc-son-vi">{m.vi}</text>}
            </g>
          </g>
        );
      })}

      {/* Bát quái */}
      <circle r={R.sonIn} fill="none" stroke="url(#fc-gold)" strokeWidth="1.6" />
      {TRIGRAMS.map((t, i) => {
        const deg = i * 45;
        const [x1, y1] = polar(R.nameIn, deg + 22.5);
        const [x2, y2] = polar(R.sonIn, deg + 22.5);
        return (
          <g key={t.han}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d4a843" strokeOpacity="0.4" strokeWidth="1" />
            <g transform={`rotate(${deg}) translate(0 ${-(R.guaIn + 26)})`}>
              {t.lines.map((yang, k) => {
                // hào dưới cùng gần tâm nhất (y lớn hơn)
                const y = 12 - k * 11;
                return yang
                  ? <rect key={k} x={-17} y={y - 2.6} width={34} height={5.2} rx={1.2} fill="url(#fc-gold)" />
                  : (
                    <g key={k}>
                      <rect x={-17} y={y - 2.6} width={14} height={5.2} rx={1.2} fill="url(#fc-gold)" />
                      <rect x={3} y={y - 2.6} width={14} height={5.2} rx={1.2} fill="url(#fc-gold)" />
                    </g>
                  );
              })}
            </g>
            <g transform={`rotate(${deg})`}>
              <text y={-(R.nameIn + 17)} textAnchor="middle" className="fc-gua">{t.han}</text>
              <text y={-(R.nameIn + 4)} textAnchor="middle" className="fc-gua-vi">{zh ? t.nature.zh : t.vi}</text>
            </g>
          </g>
        );
      })}

      {/* Ngũ hành */}
      <circle r={R.guaIn} fill="none" stroke="#d4a843" strokeOpacity="0.5" strokeWidth="1" />
      <circle r={R.nameIn} fill="none" stroke="url(#fc-gold)" strokeWidth="1.2" />
      {TRIGRAMS.map((t, i) => (
        <g key={t.han}>
          <path d={arcPath(R.wxIn, R.nameIn, i * 45 - 22.5 + 1, i * 45 + 22.5 - 1)} fill={WX_COLOR[t.element]} fillOpacity="0.13" />
          <g transform={`rotate(${i * 45})`}>
            <text y={-(R.wxIn + 11)} textAnchor="middle" className="fc-wx" fill={WX_COLOR[t.element]}>{t.element}</text>
          </g>
        </g>
      ))}
      <circle r={R.wxIn} fill="#070b18" stroke="#d4a843" strokeOpacity="0.6" strokeWidth="1" />
    </svg>
  );
}

/** Thái cực ở tâm */
function Taiji() {
  return (
    <svg viewBox="-50 -50 100 100" className="fc-taiji" aria-hidden="true">
      <circle r="48" fill="#0b0f1d" stroke="#d4a843" strokeWidth="1.5" />
      <path d="M0,-44 A44,44 0 0 1 0,44 A22,22 0 0 1 0,0 A22,22 0 0 0 0,-44 Z" fill="#e9d29a" />
      <circle cy="-22" r="6.5" fill="#0b0f1d" />
      <circle cy="22" r="6.5" fill="#e9d29a" />
    </svg>
  );
}

function todayVn(): { y: number; m: number; d: number } {
  const now = new Date(Date.now() + 7 * 3600_000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

export default function FortuneCompass() {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const L = (vi: string, z: string) => (zh ? z : vi);

  const tiltRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const rot = useRef(0);
  const vel = useRef(0);
  const raf = useRef<number | null>(null);
  const tilt = useRef({ rx: BASE_TILT, ry: 0 });
  const drag = useRef<{ id: number; last: number; t: number; moved: number; samples: { d: number; dt: number }[] } | null>(null);
  const liveIdx = useRef(0);

  const [live, setLive] = useState<Mountain>(MOUNTAINS[0]);
  const [result, setResult] = useState<Mountain | null>(null);
  const [spins, setSpins] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dayStem, setDayStem] = useState<number | null>(null);

  useEffect(() => {
    const t = todayVn();
    setDayStem(dayStemIndex(t.y, t.m, t.d));
  }, []);

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const paint = useCallback(() => {
    if (rotorRef.current) rotorRef.current.style.transform = `rotate(${rot.current}deg)`;
    const m = mountainAt(rot.current);
    const idx = MOUNTAINS.indexOf(m);
    if (idx !== liveIdx.current) { liveIdx.current = idx; setLive(m); }
  }, []);

  const paintTilt = () => {
    if (tiltRef.current) tiltRef.current.style.transform = `rotateX(${tilt.current.rx}deg) rotateY(${tilt.current.ry}deg)`;
  };

  const stopLoop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  /** Dừng hẳn: nắn về giữa sơn gần nhất rồi công bố kết quả */
  const settle = useCallback(() => {
    stopLoop();
    const from = rot.current;
    const to = Math.round(from / 15) * 15;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 260);
      const e = 1 - Math.pow(1 - k, 3);
      rot.current = from + (to - from) * e;
      paint();
      if (k < 1) raf.current = requestAnimationFrame(step);
      else {
        raf.current = null;
        setBusy(false);
        setResult(mountainAt(rot.current));
        setSpins(s => s + 1);
      }
    };
    raf.current = requestAnimationFrame(step);
  }, [paint]);

  const coast = useCallback(() => {
    stopLoop();
    setBusy(true);
    setResult(null);
    let last = performance.now();
    const k = -Math.log(FRICTION_PER_MS); // hệ số tắt dần mỗi ms
    const step = (t: number) => {
      // Tích phân đúng của v·e^(−kt): khung hình thưa (máy yếu, tab nền) vẫn quay đúng quãng đường và thời gian
      const dt = Math.min(1000, Math.max(0, t - last));
      last = t;
      const decay = Math.exp(-k * dt);
      rot.current += vel.current * (1 - decay) / k;
      vel.current *= decay;
      paint();
      if (Math.abs(vel.current) < STOP_SPEED) settle();
      else raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [paint, settle]);

  const spin = useCallback(() => {
    if (reduceMotion) {
      rot.current += (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720);
      rot.current = Math.round(rot.current / 15) * 15;
      paint();
      setResult(mountainAt(rot.current));
      setSpins(s => s + 1);
      return;
    }
    vel.current = (Math.random() < 0.5 ? -1 : 1) * (1.1 + Math.random() * 1.2);
    coast();
  }, [coast, paint, reduceMotion]);

  useEffect(() => () => stopLoop(), []);

  // ── Kéo để quay ──
  const angleAt = (e: React.PointerEvent): number => {
    const rect = discRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Đĩa nghiêng nên hình chiếu là elip: kéo giãn trục dọc để góc theo tay khớp với đĩa
    const dy = (e.clientY - cy) / Math.max(0.5, Math.cos(tilt.current.rx * Math.PI / 180));
    return Math.atan2(dy, e.clientX - cx) * 180 / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    stopLoop();
    setBusy(true);
    discRef.current?.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, last: angleAt(e), t: performance.now(), moved: 0, samples: [] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const a = angleAt(e);
    let delta = a - d.last;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.samples.push({ d: delta, dt });
    if (d.samples.length > 6) d.samples.shift();
    d.last = a;
    d.t = now;
    d.moved += Math.abs(delta);
    rot.current += delta;
    paint();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    // Tay dừng lại trước khi nhả (>120 ms) thì không còn đà
    const idle = performance.now() - d.t > 120;
    const sum = d.samples.reduce((s, x) => ({ d: s.d + x.d, dt: s.dt + x.dt }), { d: 0, dt: 0 });
    const v = idle || sum.dt === 0 ? 0 : Math.max(-MAX_SPEED, Math.min(MAX_SPEED, sum.d / sum.dt));
    if (d.moved < 6) { setBusy(false); return; } // chỉ chạm nhẹ, không tính là quay
    if (Math.abs(v) > 0.08 && !reduceMotion) { vel.current = v; coast(); }
    else settle();
  };

  // ── Nghiêng theo chuột ──
  const onStageMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tilt.current = { rx: BASE_TILT - y * 12, ry: x * 14 };
    paintTilt();
  };
  const onStageLeave = () => {
    tilt.current = { rx: BASE_TILT, ry: 0 };
    paintTilt();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stopLoop();
      rot.current = Math.round(rot.current / 15) * 15 + (e.key === 'ArrowRight' ? 15 : -15);
      paint();
      setResult(mountainAt(rot.current));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      spin();
    }
  };

  const gua = result ? TRIGRAMS[result.trigram] : null;
  const dayEl: Element | null = dayStem === null ? null : (['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'] as Element[])[dayStem];
  const rel = gua && dayEl ? RELATION_TEXT[relation(gua.element, dayEl)] : null;
  const liveGua = TRIGRAMS[live.trigram];

  return (
    <div className="fc-root">
      <div className="fc-head">
        <div className="fc-tag">FORTUNE · COMPASS</div>
        <h2 className="fc-title">{L('La bàn vận mệnh', '命运罗盘')}</h2>
        <p className="fc-sub">
          {L(
            'Tĩnh tâm, nghĩ về điều bạn đang băn khoăn, rồi dùng chuột kéo (hoặc vuốt) để xoay thiên bàn. Khi la bàn dừng, sơn dưới chỉ đỏ sẽ cho bạn một quẻ và lời nhắn hôm nay.',
            '静心默想所问之事，用鼠标拖动（或手指滑动）转动天盘。罗盘停下时，红线所指之山即为今日一卦与寄语。',
          )}
        </p>
      </div>

      <div className="fc-body">
        <div className="fc-stage" onPointerMove={onStageMove} onPointerLeave={onStageLeave}>
          <div className="fc-glow" />
          <div className="fc-tilt" ref={tiltRef} style={{ transform: `rotateX(${BASE_TILT}deg) rotateY(0deg)` }}>
            {/* Địa bàn vuông — khối dẹt */}
            <div className="fc-base-top">
              <span className="fc-corner fc-c1" /><span className="fc-corner fc-c2" />
              <span className="fc-corner fc-c3" /><span className="fc-corner fc-c4" />
              <span className="fc-dir fc-n">{L('B', '北')}</span>
              <span className="fc-dir fc-s">{L('N', '南')}</span>
              <span className="fc-dir fc-e">{L('Đ', '东')}</span>
              <span className="fc-dir fc-w">{L('T', '西')}</span>
            </div>
            <div className="fc-side fc-side-front" />
            <div className="fc-side fc-side-back" />
            <div className="fc-side fc-side-left" />
            <div className="fc-side fc-side-right" />

            {/* Thiên bàn */}
            <div
              className="fc-disc"
              ref={discRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKey}
              tabIndex={0}
              role="slider"
              aria-label={L('Thiên bàn la bàn — kéo để xoay, phím mũi tên để chuyển sơn, Enter để quay', '罗盘天盘——拖动旋转，方向键换山，回车随机转动')}
              aria-valuetext={zh ? `${live.han}山 · ${liveGua.han}卦` : `Sơn ${live.vi} · quái ${liveGua.vi}`}
            >
              <div className="fc-rotor" ref={rotorRef}>
                <DiscFace zh={zh} />
              </div>
              <div className="fc-center"><Taiji /></div>
            </div>

            {/* Chỉ đỏ thập tự + cửa sổ kim */}
            <svg viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`} className="fc-cross" aria-hidden="true">
              <path d={arcPath(R.sonIn, R.rim, -7.5, 7.5)} fill="#ffd77a" fillOpacity="0.16" stroke="#ffd77a" strokeOpacity="0.8" strokeWidth="1.2" />
              <line x1="0" y1={-VB - 4} x2="0" y2={VB + 4} stroke="#ff4b3a" strokeWidth="1.3" strokeOpacity="0.85" />
              <line x1={-VB - 4} y1="0" x2={VB + 4} y2="0" stroke="#ff4b3a" strokeWidth="1.3" strokeOpacity="0.6" />
              <path d={`M0,${-VB + 2} l-9,-16 h18 z`} fill="#ff4b3a" />
            </svg>
          </div>
          <div className="fc-floor" />
        </div>

        <div className="fc-panel">
          <div className="fc-live" aria-live="off">
            <span className="fc-live-label">{L('Kim đang chỉ', '红线所指')}</span>
            <span className="fc-live-val">
              {live.han} {zh ? '山' : `· sơn ${live.vi}`} — {liveGua.symbol} {zh ? liveGua.han : liveGua.vi}
            </span>
          </div>

          <div className="fc-actions">
            <button type="button" className="fc-btn" onClick={spin} disabled={busy}>
              {busy ? L('La bàn đang quay…', '罗盘转动中…') : spins ? L('Quay lại', '再转一次') : L('Quay la bàn', '转动罗盘')}
            </button>
            <span className="fc-hint">{L('hoặc kéo trực tiếp trên đĩa', '或直接拖动盘面')}</span>
          </div>

          <div aria-live="polite">
            <AnimatePresence mode="wait">
              {result && gua ? (
                <motion.div
                  key={`${result.han}-${spins}`}
                  className="fc-card"
                  initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="fc-card-top">
                    <div className="fc-big">{gua.symbol}</div>
                    <div>
                      <div className="fc-card-title">
                        {zh ? `${gua.han}卦 · ${result.han}山` : `Quái ${gua.vi} (${gua.han}) · sơn ${result.vi} (${result.han})`}
                      </div>
                      <div className="fc-card-sub">
                        {zh ? `${gua.nature.zh} · ${gua.element} · ${gua.direction.zh}` : `${gua.nature.vi} · hành ${ELEMENT_VI[gua.element]} · hướng ${gua.direction.vi}`}
                      </div>
                    </div>
                  </div>
                  <p className="fc-msg">{zh ? result.message.zh : result.message.vi}</p>
                  {rel && dayStem !== null && dayEl && (
                    <p className={`fc-rel fc-rel-${rel.tone}`}>
                      {zh
                        ? `今日 ${STEMS[dayStem]}日（${dayEl}）：${rel.zh}`
                        : `Hôm nay ngày ${STEMS_VI[dayStem]} (hành ${ELEMENT_VI[dayEl]}): ${rel.vi}`}
                    </p>
                  )}
                  <dl className="fc-dl">
                    <dt>{L('Tính chất', '卦德')}</dt><dd>{zh ? gua.quality.zh : gua.quality.vi}</dd>
                    <dt>{L('Màu hợp', '幸运色')}</dt><dd>{zh ? gua.colors.zh : gua.colors.vi}</dd>
                    <dt>{L('Số Lạc Thư', '洛书数')}</dt><dd>{gua.number}</dd>
                    <dt>{L('Tượng người', '人伦')}</dt><dd>{zh ? gua.family.zh : gua.family.vi}</dd>
                  </dl>
                  <div className="fc-links">
                    <a href="/kinh-dich.html">{L('Gieo quẻ Kinh Dịch', '易经起卦')} ›</a>
                    <a href="/xem-ngay">{L('Xem ngày hôm nay', '今日黄历')} ›</a>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" className="fc-card fc-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="fc-idle-sym">☯</div>
                  <p>{busy ? L('Thiên bàn đang chuyển… chờ la bàn dừng hẳn.', '天盘转动中……待罗盘停稳。') : L('Chưa có quẻ. Hãy xoay la bàn.', '尚未得卦，请转动罗盘。')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="fc-note">{L('Mang tính chiêm nghiệm, giải trí — không thay cho lá số hay quyết định của bạn.', '仅供参悟娱乐，不代替命盘与你自己的判断。')}</p>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.fc-root {
  --fc-size: min(440px, 84vw);
  position: relative; overflow: hidden; border-radius: 28px;
  padding: 56px 20px 48px; color: #e9e2cf;
  background:
    radial-gradient(ellipse 70% 55% at 30% 45%, rgba(88,64,160,0.28), transparent 70%),
    radial-gradient(ellipse 60% 50% at 80% 70%, rgba(212,168,67,0.12), transparent 70%),
    linear-gradient(160deg, #070a16 0%, #0c1022 55%, #05070f 100%);
  border: 1px solid rgba(212,168,67,0.25);
  box-shadow: 0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04);
}
.fc-root::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
  background-image: radial-gradient(1px 1px at 12% 20%, #fff8 50%, transparent 51%), radial-gradient(1px 1px at 72% 12%, #fff6 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 88% 46%, #ffd77a99 50%, transparent 51%), radial-gradient(1px 1px at 40% 86%, #fff5 50%, transparent 51%),
    radial-gradient(1px 1px at 58% 34%, #fff4 50%, transparent 51%), radial-gradient(1.5px 1.5px at 22% 64%, #c9b6ff88 50%, transparent 51%);
}
.fc-head { position: relative; text-align: center; max-width: 620px; margin: 0 auto 28px; }
.fc-tag { font-size: 10px; letter-spacing: 0.6em; color: #c9a052; opacity: 0.8; margin-bottom: 12px; }
.fc-title { font-size: clamp(28px, 4.4vw, 44px); font-weight: 700; letter-spacing: 0.08em; margin: 0 0 12px;
  background: linear-gradient(120deg, #fff1c4, #d4a843 45%, #f7e2a0 70%, #b8862a); -webkit-background-clip: text; background-clip: text; color: transparent;
  text-shadow: 0 0 40px rgba(212,168,67,0.25); }
.fc-sub { font-size: 14px; line-height: 1.8; color: rgba(233,226,207,0.72); margin: 0; }
.fc-body { position: relative; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 40px; align-items: center; max-width: 1040px; margin: 0 auto; }
.fc-stage { position: relative; width: var(--fc-size); height: calc(var(--fc-size) * 1.02); margin: 0 auto; perspective: 1100px; display: flex; align-items: center; justify-content: center; }
.fc-glow { position: absolute; width: 90%; height: 90%; border-radius: 50%;
  background: radial-gradient(circle, rgba(212,168,67,0.22), rgba(120,90,200,0.12) 45%, transparent 70%); filter: blur(20px);
  animation: fc-breathe 6s ease-in-out infinite; }
@keyframes fc-breathe { 0%,100% { opacity: .65; transform: scale(.96) } 50% { opacity: 1; transform: scale(1.03) } }
.fc-floor { position: absolute; bottom: 2%; width: 78%; height: 12%; border-radius: 50%; background: rgba(0,0,0,0.6); filter: blur(18px); transform: translateZ(-60px); }
.fc-tilt { position: relative; width: calc(var(--fc-size) * 0.94); height: calc(var(--fc-size) * 0.94); transform-style: preserve-3d; transition: transform .35s cubic-bezier(.22,1,.36,1); }
.fc-base-top { position: absolute; inset: 0; border-radius: 22px; transform: translateZ(0);
  background:
    linear-gradient(145deg, rgba(255,255,255,0.07), transparent 40%),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 6px),
    linear-gradient(160deg, #3a2414 0%, #24160c 50%, #160d07 100%);
  border: 1.5px solid rgba(212,168,67,0.55);
  box-shadow: inset 0 0 0 6px rgba(0,0,0,0.25), inset 0 0 0 7px rgba(212,168,67,0.25), 0 0 40px rgba(212,168,67,0.12); }
.fc-corner { position: absolute; width: 26px; height: 26px; border: 2px solid #d4a843; opacity: .85; }
.fc-c1 { top: 12px; left: 12px; border-right: 0; border-bottom: 0; border-top-left-radius: 8px; }
.fc-c2 { top: 12px; right: 12px; border-left: 0; border-bottom: 0; border-top-right-radius: 8px; }
.fc-c3 { bottom: 12px; left: 12px; border-right: 0; border-top: 0; border-bottom-left-radius: 8px; }
.fc-c4 { bottom: 12px; right: 12px; border-left: 0; border-top: 0; border-bottom-right-radius: 8px; }
.fc-dir { position: absolute; font-size: 11px; font-weight: 700; color: #ffcf6a; letter-spacing: .05em; }
.fc-n { top: 4px; left: 50%; transform: translateX(-50%); opacity: 0; }
.fc-s { bottom: 5px; left: 50%; transform: translateX(-50%); }
.fc-e { right: 6px; top: 50%; transform: translateY(-50%); }
.fc-w { left: 6px; top: 50%; transform: translateY(-50%); }
.fc-side { position: absolute; background: linear-gradient(180deg, #2a190d, #0f0904); border: 1px solid rgba(212,168,67,0.35); }
.fc-side-front { left: 10px; right: 10px; top: 100%; height: 26px; transform-origin: top; transform: rotateX(-90deg); border-radius: 0 0 10px 10px; }
.fc-side-back { left: 10px; right: 10px; bottom: 100%; height: 26px; transform-origin: bottom; transform: rotateX(90deg); }
.fc-side-left { top: 10px; bottom: 10px; right: 100%; width: 26px; transform-origin: right; transform: rotateY(-90deg); background: linear-gradient(90deg, #0f0904, #2a190d); }
.fc-side-right { top: 10px; bottom: 10px; left: 100%; width: 26px; transform-origin: left; transform: rotateY(90deg); background: linear-gradient(90deg, #2a190d, #0f0904); }
.fc-disc { position: absolute; inset: 4%; border-radius: 50%; transform: translateZ(8px); cursor: grab; touch-action: none; outline: none;
  box-shadow: 0 0 0 2px rgba(212,168,67,0.5), 0 0 30px rgba(212,168,67,0.25), 0 10px 30px rgba(0,0,0,0.6); }
.fc-disc:active { cursor: grabbing; }
.fc-disc:focus-visible { box-shadow: 0 0 0 3px #ffd77a, 0 0 40px rgba(255,215,122,0.5); }
.fc-rotor { position: absolute; inset: 0; will-change: transform; }
.fc-svg { width: 100%; height: 100%; display: block; user-select: none; }
.fc-son { font-family: "STSong","Songti SC","Noto Serif SC",serif; font-size: 20px; font-weight: 700; }
.fc-son-vi { font-size: 8.5px; fill: rgba(240,215,154,0.7); letter-spacing: .02em; }
.fc-gua { font-family: "STSong","Songti SC","Noto Serif SC",serif; font-size: 18px; font-weight: 700; fill: #fff1c4; }
.fc-gua-vi { font-size: 9px; fill: rgba(255,241,196,0.75); }
.fc-wx { font-family: "STSong","Songti SC","Noto Serif SC",serif; font-size: 14px; font-weight: 700; }
.fc-center { position: absolute; left: 50%; top: 50%; width: 27%; height: 27%; transform: translate(-50%, -50%); pointer-events: none;
  filter: drop-shadow(0 0 14px rgba(212,168,67,0.45)); }
.fc-taiji { width: 100%; height: 100%; animation: fc-turn 24s linear infinite; }
@keyframes fc-turn { to { transform: rotate(-360deg); } }
.fc-cross { position: absolute; inset: 4%; width: 92%; height: 92%; transform: translateZ(16px); pointer-events: none; overflow: visible;
  filter: drop-shadow(0 0 6px rgba(255,75,58,0.5)); }
.fc-panel { position: relative; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.fc-live { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-radius: 12px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(212,168,67,0.2); }
.fc-live-label { font-size: 11px; letter-spacing: .1em; color: rgba(233,226,207,0.55); }
.fc-live-val { font-size: 15px; font-weight: 600; color: #f6dc94; }
.fc-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.fc-btn { position: relative; padding: 13px 34px; border-radius: 999px; border: 1px solid rgba(255,215,122,0.6); cursor: pointer;
  font-size: 14px; font-weight: 700; letter-spacing: .12em; color: #1a1206;
  background: linear-gradient(135deg, #f7dd8c, #d4a843 55%, #b07a1c); box-shadow: 0 8px 30px rgba(212,168,67,0.35), inset 0 1px 0 rgba(255,255,255,0.5);
  transition: transform .15s ease, box-shadow .2s ease; }
.fc-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 36px rgba(212,168,67,0.5); }
.fc-btn:disabled { opacity: .6; cursor: wait; }
.fc-hint { font-size: 12px; color: rgba(233,226,207,0.5); }
.fc-card { padding: 22px; border-radius: 18px; background: linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02));
  border: 1px solid rgba(212,168,67,0.3); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 20px 50px rgba(0,0,0,0.35); }
.fc-card-top { display: flex; gap: 16px; align-items: center; margin-bottom: 14px; }
.fc-big { font-size: 54px; line-height: 1; color: #f6dc94; text-shadow: 0 0 24px rgba(246,220,148,0.55); }
.fc-card-title { font-size: 17px; font-weight: 700; color: #fff1c4; }
.fc-card-sub { font-size: 12.5px; color: rgba(233,226,207,0.65); margin-top: 3px; }
.fc-msg { font-size: 15px; line-height: 1.85; color: #f1ead6; margin: 0 0 12px; }
.fc-rel { font-size: 13px; line-height: 1.7; margin: 0 0 14px; padding: 9px 12px; border-radius: 10px; border-left: 3px solid; }
.fc-rel-good { color: #9fe0b0; border-color: #5fae6e; background: rgba(95,174,110,0.1); }
.fc-rel-ok { color: #f0d79a; border-color: #d4a843; background: rgba(212,168,67,0.08); }
.fc-rel-care { color: #f3a99c; border-color: #e0644f; background: rgba(224,100,79,0.09); }
.fc-dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0 0 14px; font-size: 13px; }
.fc-dl dt { color: rgba(233,226,207,0.5); }
.fc-dl dd { margin: 0; color: #eadfc4; }
.fc-links { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; }
.fc-links a { color: #d4a843; text-decoration: none; border-bottom: 1px dashed rgba(212,168,67,0.5); }
.fc-links a:hover { color: #ffd77a; }
.fc-idle { text-align: center; color: rgba(233,226,207,0.6); font-size: 14px;
  /* giữ chỗ bằng thẻ kết quả để la bàn bên cạnh không bị đẩy lên xuống khi quẻ hiện ra */
  min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.fc-idle-sym { font-size: 42px; color: rgba(212,168,67,0.5); margin-bottom: 6px; animation: fc-turn 18s linear infinite; display: inline-block; }
.fc-idle p { margin: 0; }
.fc-note { font-size: 11px; color: rgba(233,226,207,0.4); margin: 0; }
@media (max-width: 900px) {
  .fc-body { grid-template-columns: 1fr; gap: 28px; }
  .fc-root { padding: 44px 14px 36px; border-radius: 22px; }
  .fc-idle { min-height: 140px; }
}
@media (prefers-reduced-motion: reduce) {
  .fc-glow, .fc-taiji, .fc-idle-sym { animation: none; }
  .fc-tilt { transition: none; }
}
`;
