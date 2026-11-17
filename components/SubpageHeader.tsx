'use client';
import Link from 'next/link';
import { useI18n } from '@/components/LocaleProvider';

/** Thanh tiêu đề dính đầu trang cho các trang công cụ (Xem ngày, Bát tự). */
export default function SubpageHeader({ title, hint }: { title: string; hint?: string }) {
  const { locale } = useI18n();
  return (
    <header className="subpage-header">
      <Link href="/" className="subpage-back">
        <span style={{ fontSize: 16 }}>‹</span>
        <span>{locale === 'zh' ? '首页' : 'Trang chủ'}</span>
      </Link>
      <div style={{ width: 1, height: 20, background: 'var(--bdr-med)' }} />
      <span style={{ fontSize: 12, color: 'var(--ac)', letterSpacing: '0.2em', whiteSpace: 'nowrap' }}>{title}</span>
      <div style={{ flex: 1 }} />
      {hint && <span className="subpage-hint">{hint}</span>}
      <style>{`
        .subpage-header {
          position: sticky; top: 0; z-index: 50; height: 52px;
          display: flex; align-items: center; gap: 14px; padding: 0 20px;
          background: color-mix(in srgb, var(--bg-0) 90%, transparent);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--bdr);
        }
        .subpage-back { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--tx-3); text-decoration: none; }
        .subpage-hint { font-size: 11px; color: var(--tx-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 560px) { .subpage-hint { display: none; } }
      `}</style>
    </header>
  );
}
