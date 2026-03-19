import { useState } from 'react';
import { Pin, CalendarDays, Users } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useCurrentUser } from '../../hooks/campus/useCurrentUser';
import Layout from '../../components/Layout';
import { AnnouncementsTab } from '../../components/campus/AnnouncementsTab';
import { CalendarTab } from '../../components/campus/CalendarTab';
import { GroupsTab } from '../../components/campus/GroupsTab';
import { auth } from '../../config/firebase';

const SUBTABS = ['Tablón', 'Calendario', 'Grupos'] as const;
type Subtab = typeof SUBTABS[number];

export default function CampusScreen() {
  const { colors } = useTheme();
  const { can, subrole, department, isAdmin, eventTypes } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<Subtab>('Tablón');
  const currentUser = auth.currentUser;

  return (
    <Layout title="Campus">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${colors.border}33`,
          backgroundColor: colors.background,
        }}>
          {SUBTABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                paddingTop: 12, background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 12 }}>
                {tab === 'Tablón' && <Pin size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} strokeWidth={activeTab === tab ? 2.5 : 2} />}
                {tab === 'Calendario' && <CalendarDays size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} strokeWidth={activeTab === tab ? 2.5 : 2} />}
                {tab === 'Grupos' && <Users size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} strokeWidth={activeTab === tab ? 2.5 : 2} />}
                <span style={{ fontSize: 14, fontWeight: activeTab === tab ? 700 : 600, color: activeTab === tab ? colors.primary : colors.textSecondary }}>
                  {tab}
                </span>
              </div>
              {activeTab === tab && (
                <div style={{ height: 3, width: '60%', borderRadius: 1.5, backgroundColor: colors.primary, marginTop: -1.5 }} />
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: activeTab === 'Tablón' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <AnnouncementsTab canCreateAnnouncement={can('createAnnouncement')} />
          </div>
          <div style={{ display: activeTab === 'Calendario' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <CalendarTab
              eventTypes={eventTypes}
              department={department}
              subrole={subrole}
              currentUserId={currentUser?.uid ?? ''}
            />
          </div>
          <div style={{ display: activeTab === 'Grupos' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <GroupsTab canCreate={can('createStudyGroup')} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
