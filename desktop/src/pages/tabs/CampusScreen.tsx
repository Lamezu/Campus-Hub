import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { AnnouncementsTab } from '@/components/campus/AnnouncementsTab';
import { CalendarTab } from '@/components/campus/CalendarTab';
import { GroupsTab } from '@/components/campus/GroupsTab';
import { NotificationBell } from '@/components/NotificationBell';
import { useTranslation } from '@/contexts/LanguageContext';

type TabId = 'tablon' | 'calendario' | 'grupos';

export default function CampusScreen() {
  const { colors } = useTheme();
  const location = useLocation();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>((location.state as any)?.tab || 'tablon');
  const [initialSelectedId, setInitialSelectedId] = useState<string | undefined>((location.state as any)?.selectedId);

  useEffect(() => {
    if ((location.state as any)?.tab) {
      setActiveTab((location.state as any).tab);
    }
    if ((location.state as any)?.selectedId) {
      setInitialSelectedId((location.state as any).selectedId);
    }
    
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const TABS = [
    { id: 'tablon' as const, label: t('campus.tabs.tablon') },
    { id: 'calendario' as const, label: t('campus.tabs.calendario') },
    { id: 'grupos' as const, label: t('campus.tabs.grupos') },
  ];

  return (
    <div style={{
      padding: '32px 40px 5px',
      maxWidth: 1400,
      margin: '0 auto',
      width: '100%',
      minHeight: '100vh',
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: colors.text }}>{t('campus.title')}</h1>
          <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 16 }}>{t('campus.description')}</p>
        </div>
        <NotificationBell section="campus" category="campus" size={28} />
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        padding: 4,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 14,
        width: 'fit-content',
        marginBottom: 32,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              backgroundColor: activeTab === tab.id ? colors.primary : 'transparent',
              color: activeTab === tab.id ? '#fff' : colors.textSecondary,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'tablon' && (
          <AnnouncementsTab 
            initialId={initialSelectedId} 
            onConsumeId={() => setInitialSelectedId(undefined)} 
          />
        )}
        {activeTab === 'calendario' && (
          <CalendarTab 
            initialId={initialSelectedId} 
            onConsumeId={() => setInitialSelectedId(undefined)} 
          />
        )}
        {activeTab === 'grupos' && <GroupsTab />}
      </div>
    </div>
  );
}
