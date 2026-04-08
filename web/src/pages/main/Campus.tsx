import { useState } from 'react';
import { Pin, CalendarDays, Users, GraduationCap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useCurrentUser } from '../../hooks/campus/useCurrentUser';
import { useWindowSize } from '../../hooks/useWindowSize';
import Layout from '../../components/Layout';
import { AnnouncementsTab } from '../../components/campus/AnnouncementsTab';
import { CalendarTab } from '../../components/campus/CalendarTab';
import { GroupsTab } from '../../components/campus/GroupsTab';
import { auth } from '../../config/firebase';

const SUBTABS = ['Tablón', 'Calendario', 'Grupos'] as const;
type Subtab = typeof SUBTABS[number];

const TAB_ICONS = {
  'Tablón': Pin,
  'Calendario': CalendarDays,
  'Grupos': Users,
};

export default function CampusScreen() {
  const { colors } = useTheme();
  const { can, subrole, department, isAdmin, eventTypes } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<Subtab>('Tablón');
  const [slideDir, setSlideDir] = useState<'right' | 'left' | null>(null);

  const handleTabChange = (tab: Subtab) => {
    if (tab === activeTab) return;
    const oldIdx = SUBTABS.indexOf(activeTab);
    const newIdx = SUBTABS.indexOf(tab);
    setSlideDir(newIdx > oldIdx ? 'right' : 'left');
    setActiveTab(tab);
  };
  const currentUser = auth.currentUser;
  const isDesktop = useWindowSize();

  return (
    <Layout title="Campus">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {isDesktop ? (
          <div style={{
            padding: '24px 32px 0',
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.background,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                backgroundColor: colors.primary + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GraduationCap size={26} color={colors.primary} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: colors.text }}>Campus</div>
                <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 1 }}>Tablón de anuncios, calendario y grupos de estudio</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {SUBTABS.map(tab => {
                const Icon = TAB_ICONS[tab];
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '10px 20px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderBottom: `3px solid ${active ? colors.primary : 'transparent'}`,
                      marginBottom: -1,
                      color: active ? colors.primary : colors.textSecondary,
                      fontSize: 14, fontWeight: active ? 700 : 500,
                      transition: 'color 0.15s',
                    }}
                  >
                    <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            borderBottom: `1px solid ${colors.border}33`,
            backgroundColor: colors.background,
          }}>
            {SUBTABS.map(tab => {
              const Icon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    paddingTop: 12, background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 12 }}>
                    <Icon size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} strokeWidth={activeTab === tab ? 2.5 : 2} />
                    <span style={{ fontSize: 14, fontWeight: activeTab === tab ? 700 : 600, color: activeTab === tab ? colors.primary : colors.textSecondary }}>
                      {tab}
                    </span>
                  </div>
                  {activeTab === tab && (
                    <div style={{ height: 3, width: '60%', borderRadius: 1.5, backgroundColor: colors.primary, marginTop: -1.5 }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className={activeTab === 'Tablón' && slideDir ? `animate-tab-slide-${slideDir}` : ''} style={{ display: activeTab === 'Tablón' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <AnnouncementsTab canCreateAnnouncement={can('createAnnouncement')} />
          </div>
          <div className={activeTab === 'Calendario' && slideDir ? `animate-tab-slide-${slideDir}` : ''} style={{ display: activeTab === 'Calendario' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <CalendarTab eventTypes={eventTypes} department={department} subrole={subrole} currentUserId={currentUser?.uid ?? ''} />
          </div>
          <div className={activeTab === 'Grupos' && slideDir ? `animate-tab-slide-${slideDir}` : ''} style={{ display: activeTab === 'Grupos' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <GroupsTab canCreate={can('createStudyGroup')} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
