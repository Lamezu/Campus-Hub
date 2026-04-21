import { useState, useEffect } from 'react';
import { Monitor, X, RefreshCw, Layers, Layout } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string | null;
}

interface ScreenShareModalProps {
  onClose: () => void;
  onSelect: (sourceId: string) => void;
}

export function ScreenShareModal({ onClose, onSelect }: ScreenShareModalProps) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [tab, setTab] = useState<'apps' | 'screens'>('apps');
  const [loading, setLoading] = useState(true);

  const fetchSources = async () => {
    setLoading(true);
    if (!(window as any).electronAPI?.getScreenSources) {
      console.warn('electronAPI.getScreenSources not found');
      setLoading(false);
      return;
    }
    try {
      const results = await (window as any).electronAPI.getScreenSources();
      setSources(results);
    } catch (err) {
      console.error('Error fetching screen sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  let filteredSources = sources.filter(s => {
    const id = s.id.toLowerCase();
    if (tab === 'apps') {
      return id.includes('window') || (!id.includes('screen') && !id.includes('monitor'));
    } else {
      return id.includes('screen') || id.includes('monitor');
    }
  });

  if (filteredSources.length === 0 && sources.length > 0) {
    filteredSources = sources;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: '#313338', width: '100%', maxWidth: 800, borderRadius: 12,
        display: 'flex', flexDirection: 'column', height: '80vh', border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.8)'
      }}>
        <div style={{ padding: '24px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Monitor size={20} color="#5865f2" />
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>{t('call.sharing.title')}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b5bac1', cursor: 'pointer', padding: 4 }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setTab('apps')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                backgroundColor: tab === 'apps' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === 'apps' ? '#fff' : '#b5bac1',
                transition: 'all 0.2s'
              }}
            >
              <Layout size={18} />
              {t('call.sharing.apps')}
            </button>
            <button
              onClick={() => setTab('screens')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                backgroundColor: tab === 'screens' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === 'screens' ? '#fff' : '#b5bac1',
                transition: 'all 0.2s'
              }}
            >
              <Monitor size={18} />
              {t('call.sharing.fullscreen')}
            </button>
          </div>
          <button
            onClick={fetchSources}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#b5bac1', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('call.sharing.refresh')}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#b5bac1' }}>
              <RefreshCw size={32} className="animate-spin" />
              {t('call.sharing.loading')}
            </div>
          ) : filteredSources.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#b5bac1' }}>
              <Layers size={32} opacity={0.5} />
              {t('call.sharing.no_sources')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {filteredSources.map(source => (
                <div
                  key={source.id}
                  onClick={() => onSelect(source.id)}
                  className="source-card"
                  style={{
                    cursor: 'pointer', borderRadius: 8, overflow: 'hidden', backgroundColor: '#2b2d31',
                    border: '2px solid transparent', transition: 'all 0.2s', position: 'relative',
                    display: 'flex', flexDirection: 'column'
                  }}
                >
                  <div style={{ aspectRatio: '16/9', backgroundColor: '#1e1f22', position: 'relative', overflow: 'hidden' }}>
                    <img src={source.thumbnail} alt={source.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <div className="share-overlay" style={{
                      position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.2s'
                    }}>
                      <div style={{ backgroundColor: '#fff', color: '#313338', padding: '8px 16px', borderRadius: 4, fontWeight: 700, fontSize: 13 }}>
                        Compartir
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {source.appIcon && <img src={source.appIcon} alt="" style={{ width: 16, height: 16 }} />}
                    <span style={{ fontSize: 13, color: '#dbdee1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {source.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`
          .source-card:hover { border-color: #5865f2 !important; transform: translateY(-2px); }
          .source-card:hover .share-overlay { opacity: 1 !important; }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #1e1f22; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #1a1b1e; }
        `}</style>
      </div>
    </div>
  );
}
