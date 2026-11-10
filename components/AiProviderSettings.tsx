'use client';

/**
 * Nút «Cài đặt API» + hộp thoại cho người xem tự nhập API key của họ.
 * Lưu trong localStorage (lib/ai/user-provider-client.ts), dùng chung cho
 * giải đoán lá số, chat và hợp bàn.
 */
import { useEffect, useState } from 'react';
import { useI18n } from './LocaleProvider';
import {
  USER_PROVIDER_PRESETS, loadUserProvider, onUserProviderChange, saveUserProvider,
  type UserProviderConfig, type UserProviderKind,
} from '@/lib/ai/user-provider-client';

const EMPTY: UserProviderConfig = { kind: 'anthropic', baseUrl: '', apiKey: '', model: '' };

export default function AiProviderSettings({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<UserProviderConfig | null>(null);
  const [draft, setDraft] = useState<UserProviderConfig>(EMPTY);
  const [preset, setPreset] = useState('custom');
  const [showKey, setShowKey] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const sync = () => setActive(loadUserProvider());
    sync();
    return onUserProviderChange(sync);
  }, []);

  const openDialog = () => {
    const current = loadUserProvider();
    setDraft(current ?? EMPTY);
    setPreset(current ? 'custom' : 'shopaikey');
    if (!current) applyPreset('shopaikey', EMPTY);
    setShowKey(false);
    setNote('');
    setOpen(true);
  };

  const applyPreset = (id: string, base: UserProviderConfig = draft) => {
    setPreset(id);
    const p = USER_PROVIDER_PRESETS.find(x => x.id === id);
    if (p && id !== 'custom') setDraft({ ...base, ...p.config });
  };

  const valid = draft.baseUrl.trim().startsWith('https://') && draft.apiKey.trim().length >= 8 && draft.model.trim().length > 0;

  const save = () => {
    const ok = saveUserProvider({
      kind: draft.kind,
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
    });
    setNote(ok ? t('aiSettings.saved') : t('aiSettings.storageBlocked'));
    if (ok) setOpen(false);
  };

  const clear = () => {
    saveUserProvider(null);
    setDraft(EMPTY);
    setOpen(false);
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12,
    background: 'var(--t-card, var(--bg-card))', color: 'var(--t-text, var(--tx-1))',
    border: '1px solid var(--t-border, var(--bdr))', outline: 'none',
  };
  const label: React.CSSProperties = { fontSize: 11, color: 'var(--t-faint, var(--tx-3))', marginBottom: 4, display: 'block' };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-lg transition-all"
        style={{
          padding: compact ? '4px 8px' : '6px 12px',
          fontSize: compact ? 10 : 12,
          border: `1px solid ${active ? 'rgba(16,185,129,0.45)' : 'var(--t-border, var(--bdr))'}`,
          color: active ? '#10b981' : 'var(--t-faint, var(--tx-3))',
          background: 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        ⚙ {active ? t('aiSettings.buttonActive') : t('aiSettings.button')}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('aiSettings.title')}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div style={{
            width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', borderRadius: 14, padding: 20,
            // --bg-page là màu nền đặc của cả hai giao diện sáng/tối (app/globals.css)
            background: 'var(--bg-page, #020810)', border: '1px solid var(--t-border, var(--bdr))',
            boxShadow: 'var(--sh-lg)',
            color: 'var(--t-text, var(--tx-1))', display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-gold, var(--ac))' }}>{t('aiSettings.title')}</div>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--t-faint, var(--tx-3))', margin: 0 }}>{t('aiSettings.intro')}</p>

            <div>
              <label style={label} htmlFor="aip-preset">{t('aiSettings.preset')}</label>
              <select id="aip-preset" value={preset} onChange={e => applyPreset(e.target.value)} style={field}>
                {USER_PROVIDER_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>

            <div>
              <label style={label} htmlFor="aip-kind">{t('aiSettings.kind')}</label>
              <select id="aip-kind" value={draft.kind}
                onChange={e => { setPreset('custom'); setDraft({ ...draft, kind: e.target.value as UserProviderKind }); }}
                style={field}>
                <option value="openai">OpenAI-compatible (/chat/completions)</option>
                <option value="anthropic">Anthropic (/v1/messages)</option>
              </select>
            </div>

            <div>
              <label style={label} htmlFor="aip-base">Base URL</label>
              <input id="aip-base" value={draft.baseUrl} placeholder="https://…" autoComplete="off" spellCheck={false}
                onChange={e => { setPreset('custom'); setDraft({ ...draft, baseUrl: e.target.value }); }} style={field} />
            </div>

            <div>
              <label style={label} htmlFor="aip-key">API key</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input id="aip-key" type={showKey ? 'text' : 'password'} value={draft.apiKey} autoComplete="off" spellCheck={false}
                  onChange={e => setDraft({ ...draft, apiKey: e.target.value })} style={field} />
                <button type="button" onClick={() => setShowKey(s => !s)}
                  style={{ ...field, width: 'auto', cursor: 'pointer' }}>{showKey ? t('aiSettings.hide') : t('aiSettings.show')}</button>
              </div>
            </div>

            <div>
              <label style={label} htmlFor="aip-model">Model</label>
              <input id="aip-model" value={draft.model} autoComplete="off" spellCheck={false}
                onChange={e => setDraft({ ...draft, model: e.target.value })} style={field} />
            </div>

            <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--t-faint, var(--tx-3))', margin: 0 }}>{t('aiSettings.privacy')}</p>
            {note && <p style={{ fontSize: 11, color: '#f59e0b', margin: 0 }}>{note}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {active && (
                <button type="button" onClick={clear} style={{ ...field, width: 'auto', cursor: 'pointer', color: '#ef4444' }}>
                  {t('aiSettings.clear')}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} style={{ ...field, width: 'auto', cursor: 'pointer' }}>
                {t('aiSettings.cancel')}
              </button>
              <button type="button" onClick={save} disabled={!valid}
                style={{ ...field, width: 'auto', cursor: valid ? 'pointer' : 'not-allowed', opacity: valid ? 1 : 0.5,
                  color: 'var(--t-gold, var(--ac))', borderColor: 'var(--t-gold, var(--ac))' }}>
                {t('aiSettings.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
