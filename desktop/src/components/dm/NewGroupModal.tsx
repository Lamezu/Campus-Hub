import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Camera, Users, Check, Loader2, UserCheck, UserPlus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { subscribeToFriends } from '@/services/friendsService';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { createGroupConversation } from '@/services/groupDMService';
import { ThemedText } from '../themed-text';
import { spacing } from '@/constants/styles';
import type { User, UserRole } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { Avatar } from '../common/Avatar';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
  onMembersAdded?: (members: { id: string; name: string; photo: string | null }[]) => void;
  mode?: 'create' | 'invite';
  existingMemberIds?: string[];
}

type TabType = 'friends' | 'all';

export function NewGroupModal({ 
  isOpen, onClose, onGroupCreated, onMembersAdded, 
  mode = 'create', existingMemberIds = [] 
}: NewGroupModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [friends, setFriends] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser || !isOpen) return;
    const unsubscribe = subscribeToFriends(currentUser.uid, (data) => {
      setFriends(data);
    });
    return unsubscribe;
  }, [currentUser, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as User))
        .filter(u => u.uid !== currentUser?.uid);
      setAllUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      setLoading(false);
    });
    return unsubscribe;
  }, [isOpen, currentUser]);

  const filteredUsers = useMemo(() => {
    const source = activeTab === 'friends' ? friends : allUsers;
    const searchTerm = search.toLowerCase().trim();
    
    return source.filter(u => {
      if (existingMemberIds.includes(u.uid)) return false;
      const matchesSearch = !searchTerm || 
        u.displayName?.toLowerCase().includes(searchTerm) || 
        u.email?.toLowerCase().includes(searchTerm);
      const matchesRole = selectedRole === 'all' || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [activeTab, friends, allUsers, search, selectedRole, existingMemberIds]);

  const toggleUser = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadChannelPhoto(file, `group_photo_${Date.now()}`);
      setGroupPhoto(url);
    } catch (error) {
      console.error('Error uploading group photo:', error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreate = async () => {
    if (!currentUser || selectedUserIds.size === 0 || creating) return;
    setCreating(true);
    try {
      const selectedUsersData = allUsers.filter(u => selectedUserIds.has(u.uid));
      const members = selectedUsersData.map(u => ({ id: u.uid, name: u.displayName, photo: u.photoURL || null }));

      if (mode === 'invite') {
        onMembersAdded?.(members);
        onClose();
        return;
      }

      const allMembers = [
        { id: currentUser.uid, name: currentUser.displayName || t('common.unknown_user', { defaultValue: 'Usuario' }), photo: currentUser.photoURL },
        ...members
      ];
      
      const groupId = await createGroupConversation(allMembers, groupName || t('messages.modals.new_group.title'), groupPhoto, currentUser.uid);
      onGroupCreated?.(groupId);
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000,
      backdropFilter: 'blur(10px)', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 550, backgroundColor: colors.background,
        borderRadius: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh',
        border: `1px solid ${colors.border}`
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <ThemedText style={{ fontSize: 20, fontWeight: '800', display: 'block' }}>
              {mode === 'create' ? t('messages.modals.new_group.title') : t('messages.modals.new_group.invite_title')}
            </ThemedText>
            <ThemedText style={{ fontSize: 13, opacity: 0.6 }}>
              {mode === 'create' ? t('messages.modals.new_group.subtitle') : t('messages.modals.new_group.invite_subtitle')}
            </ThemedText>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: colors.backgroundSecondary, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Group Info Section */}
          {mode === 'create' && (
            <div style={{ padding: '24px 28px', display: 'flex', gap: 20, borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary + '40' }}>
                <div style={{ width: 80, height: 80, borderRadius: 24, position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  <Avatar 
                    src={groupPhoto} 
                    name={groupName} 
                    size={80} 
                    style={{ borderRadius: 24, border: `2px dashed ${colors.border}` }}
                    fallbackIcon={Camera}
                  />
                  {uploadingPhoto && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 2, borderRadius: 24 }}>
                      <Loader2 size={24} className="animate-spin" color="#fff" />
                    </div>
                  )}
                </div>
              <div style={{ flex: 1 }}>
                <input 
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder={t('messages.modals.new_group.name_placeholder')}
                  style={{
                    width: '100%', padding: '12px 0', fontSize: 18, fontWeight: '700',
                    background: 'none', border: 'none', borderBottom: `2px solid ${colors.border}`,
                    outline: 'none', color: colors.text, marginBottom: 8
                  }}
                />
                <ThemedText style={{ fontSize: 12, opacity: 0.5 }}>{t('messages.modals.new_group.name_hint')}</ThemedText>
              </div>
            </div>
          )}

          {/* Members Selection Section */}
          <div style={{ padding: '20px 28px 0' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setActiveTab('friends')}
                style={{
                  flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: activeTab === 'friends' ? `${colors.primary}15` : 'transparent',
                  color: activeTab === 'friends' ? colors.primary : colors.textSecondary,
                  fontWeight: '700', transition: 'all 0.2s'
                }}
              >
                <UserCheck size={18} />
                <span style={{ fontSize: 13 }}>{t('messages.modals.new_group.tabs.friends')}</span>
              </button>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: activeTab === 'all' ? `${colors.primary}15` : 'transparent',
                  color: activeTab === 'all' ? colors.primary : colors.textSecondary,
                  fontWeight: '700', transition: 'all 0.2s'
                }}
              >
                <Users size={18} />
                <span style={{ fontSize: 13 }}>{t('messages.modals.new_group.tabs.all')}</span>
              </button>
            </div>

            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', 
              backgroundColor: colors.backgroundSecondary, borderRadius: 12, border: `1px solid ${colors.border}`,
              marginBottom: 12
            }}>
              <Search size={18} color={colors.textSecondary} />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('messages.modals.new_group.search_placeholder')}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 14 }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px' }}>
            {loading ? (
               <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                 <Loader2 size={30} className="animate-spin" color={colors.primary} />
               </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                <ThemedText style={{ fontSize: 14 }}>{t('messages.modals.new_group.empty_results')}</ThemedText>
              </div>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedUserIds.has(user.uid);
                return (
                  <div 
                    key={user.uid}
                    onClick={() => toggleUser(user.uid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px',
                      borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                      backgroundColor: isSelected ? `${colors.primary}08` : 'transparent'
                    }}
                  >
                    <Avatar 
                      src={user.photoURL} 
                      name={user.displayName} 
                      size={44} 
                      style={{ borderRadius: 16 }} 
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 15, display: 'block' }}>{user.displayName}</ThemedText>
                      <ThemedText style={{ fontSize: 12, opacity: 0.6, textTransform: 'capitalize' }}>
                        {user.role === 'teacher' ? t('common.roles.teacher') : user.role === 'admin' ? t('common.roles.admin') : t('common.roles.student')}
                      </ThemedText>
                    </div>
                    <div style={{ 
                      width: 24, height: 24, borderRadius: 8, 
                      border: `2px solid ${isSelected ? colors.primary : colors.border}`,
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {isSelected && <Check size={16} color="#fff" strokeWidth={3} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 28px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.backgroundSecondary + '20' }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>
            {selectedUserIds.size === 0 ? t('messages.modals.new_group.footer.no_selection') : t('messages.modals.new_group.footer.selection_count', { count: selectedUserIds.size })}
          </ThemedText>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textSecondary, fontWeight: '700' }}
            >
              {t('messages.modals.new_group.footer.cancel')}
            </button>
            <button 
              onClick={handleCreate}
              disabled={selectedUserIds.size === 0 || creating}
              style={{ 
                padding: '10px 24px', borderRadius: 12, border: 'none', 
                backgroundColor: colors.primary, color: '#fff', cursor: 'pointer', 
                fontWeight: '700', display: 'flex', alignItems: 'center', gap: 8,
                opacity: (selectedUserIds.size === 0 || creating) ? 0.5 : 1
              }}
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : (mode === 'invite' ? <UserPlus size={18} /> : <Users size={18} />)}
              <span>{mode === 'invite' ? t('messages.modals.new_group.footer.add') : t('messages.modals.new_group.footer.create')}</span>
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
