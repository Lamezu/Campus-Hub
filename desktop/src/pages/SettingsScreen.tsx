import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, type AppTheme } from '@/constants/styles';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import {
  LogOut, Check, Palette, User, Settings as SettingsIcon,
  ChevronLeft, Bell, Volume2, Globe, Users, Trash2
} from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';
import { playTone } from '@/utils/toneGenerator';
import { useTranslation } from '@/contexts/LanguageContext';

const PRESET_COLORS = [
  '#007AFF', '#FF2D55', '#5856D6', '#AF52DE',
  '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
  '#FF3B30', '#8E8E93', '#E91E63', '#9C27B0',
  '#3F51B5', '#00BCD4', '#009688', '#4CAF50',
  '#FFEB3B', '#FF9800', '#FF5722', '#795548'
];

const SOUND_KEYS = ['silent', 'default', 'classic', 'soft', 'melody', 'bell', 'pulse'] as const;

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();
  const { theme, colors, setTheme, setCustomPrimary, customPrimary, chatSettings, setChatSettings } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'error' | 'confirm';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '' });

  const showAlert = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'error' | 'confirm' = 'info',
    onConfirm?: () => void
  ) => {
    setAlertConfig({ isOpen: true, title, message, type, onConfirm });
  };

  const handleLogout = () => {
    showAlert(
      t('settings.logout_confirm_title'),
      t('settings.logout_confirm_desc'),
      'confirm',
      async () => {
        try {
          await signOut(auth);
          navigate('/auth/login');
        } catch {
          showAlert(t('common.error'), t('settings.logout_error'), 'error');
        }
      }
    );
  };

  const ThemeOption = ({ id, label, current }: { id: AppTheme; label: string; current: boolean }) => (
    <button
      onClick={() => setTheme(id)}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        border: `1px solid ${current ? colors.primary : colors.border}`,
        backgroundColor: current ? `${colors.primary}15` : colors.card,
        marginBottom: spacing.sm,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <ThemedText style={{ fontWeight: '600', color: current ? colors.primary : colors.text }}>
        {label}
      </ThemedText>
      {current && <Check size={18} color={colors.primary} />}
    </button>
  );

  const MUTE_OPTIONS = [
    { key: 'none', value: 0, label: t('settings.mute_options.none') },
    { key: 'always', value: 8640000000000000, label: t('settings.mute_options.always') },
    { key: '8h', value: 28800000, label: t('settings.mute_options.8h') },
    { key: '1w', value: 604800000, label: t('settings.mute_options.1w') },
  ];

  return (
    <ThemedView style={{ flex: 1, height: '100%', overflowY: 'auto', backgroundColor: colors.background }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: spacing.xl }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.text, display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: '50%', transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ChevronLeft size={28} />
          </button>
          <SettingsIcon size={32} color={colors.primary} />
          <ThemedText style={{ fontSize: 32, fontWeight: 'bold' }}>{t('settings.title')}</ThemedText>
        </div>

        <section style={{ marginBottom: spacing.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Globe size={20} color={colors.primary} />
            <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>{t('settings.language')}</ThemedText>
          </div>
          <div style={{ display: 'flex', gap: spacing.md }}>
            <button
              onClick={() => setLanguage('es')}
              style={{
                flex: 1, padding: spacing.md, borderRadius: 12,
                border: `1px solid ${language === 'es' ? colors.primary : colors.border}`,
                backgroundColor: language === 'es' ? `${colors.primary}15` : colors.card,
                color: language === 'es' ? colors.primary : colors.text,
                fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>ES</span> Español {language === 'es' && <Check size={16} />}
            </button>
            <button
              onClick={() => setLanguage('en')}
              style={{
                flex: 1, padding: spacing.md, borderRadius: 12,
                border: `1px solid ${language === 'en' ? colors.primary : colors.border}`,
                backgroundColor: language === 'en' ? `${colors.primary}15` : colors.card,
                color: language === 'en' ? colors.primary : colors.text,
                fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>EN</span> English {language === 'en' && <Check size={16} />}
            </button>
          </div>
        </section>

        <section style={{ marginBottom: spacing.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Palette size={20} color={colors.primary} />
            <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>{t('settings.theme_appearance')}</ThemedText>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: spacing.md }}>
            <ThemeOption id="light" label={t('theme.light')} current={theme === 'light'} />
            <ThemeOption id="dark" label={t('theme.dark')} current={theme === 'dark'} />
            <ThemeOption id="high-contrast" label={t('theme.high_contrast')} current={theme === 'high-contrast'} />
            <ThemeOption id="pastel" label={t('theme.pastel')} current={theme === 'pastel'} />
          </div>

          <div style={{ marginTop: spacing.lg }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', display: 'block', marginBottom: spacing.sm }}>
              {t('settings.accent_color')}
            </ThemedText>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setCustomPrimary(color)}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    border: customPrimary === color ? `3px solid ${colors.text}` : 'none',
                    backgroundColor: color, cursor: 'pointer', transition: 'transform 0.1s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>
          </div>
        </section>

        <section style={{ marginBottom: spacing.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Bell size={20} color={colors.primary} />
            <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>{t('settings.notifications')}</ThemedText>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '600', opacity: 0.7, display: 'block', marginBottom: spacing.md }}>
              {t('settings.mute_desc')}
            </ThemedText>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.sm }}>
              {MUTE_OPTIONS.map(opt => {
                const isActive = opt.value === 0
                  ? (!chatSettings.muteUntil || chatSettings.muteUntil <= Date.now())
                  : (chatSettings.muteUntil && Math.abs(chatSettings.muteUntil - (Date.now() + opt.value)) < 60000);

                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      const until = opt.value === 0 ? 0 : Date.now() + opt.value;
                      setChatSettings({ muteUntil: until });
                      if (opt.value !== 0) {
                        showAlert(t('settings.notif_muted_title'), t('settings.notif_muted_desc', { time: opt.label }));
                      } else {
                        showAlert(t('settings.notif_unmuted_title'), t('settings.notif_unmuted_desc'));
                      }
                    }}
                    style={{
                      padding: '12px 8px', borderRadius: 10,
                      border: `2px solid ${isActive ? colors.primary : colors.border}`,
                      backgroundColor: isActive ? `${colors.primary}15` : colors.card,
                      color: isActive ? colors.primary : colors.text,
                      fontSize: 13, fontWeight: '700', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.backgroundColor = colors.card)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Volume2 size={18} color={colors.primary} />
            <ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>{t('settings.sounds')}</ThemedText>
          </div>
          <ThemedText style={{ fontSize: 13, opacity: 0.6, display: 'block', marginBottom: spacing.md }}>
            {t('settings.global_alert_tone')}
          </ThemedText>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: spacing.sm }}>
            {SOUND_KEYS.map(sound => (
              <button
                key={sound}
                onClick={() => {
                  setChatSettings({ notificationSound: sound });
                  playTone(sound);
                }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', borderRadius: 12,
                  border: `1px solid ${chatSettings.notificationSound === sound ? colors.primary : colors.border}`,
                  backgroundColor: chatSettings.notificationSound === sound ? `${colors.primary}15` : colors.card,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: chatSettings.notificationSound === sound ? colors.primary : colors.text }}>
                  {t(`settings.alert_tones.${sound}`)}
                </ThemedText>
                {chatSettings.notificationSound === sound && <Check size={14} color={colors.primary} />}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: spacing.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <User size={20} color={colors.primary} />
              <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>{t('settings.account')}</ThemedText>
            </div>
            <button 
              onClick={() => navigate('/edit-profile')}
              style={{
                background: `${colors.primary}15`, border: 'none', borderRadius: 8,
                padding: '6px 12px', color: colors.primary, fontWeight: '700',
                fontSize: 12, cursor: 'pointer'
              }}
            >
              {t('common.edit')}
            </button>
          </div>
          <div style={{ backgroundColor: colors.card, borderRadius: 12, padding: spacing.lg, border: `1px solid ${colors.border}`, marginBottom: spacing.md }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <ThemedText style={{ opacity: 0.6 }}>{t('settings.username')}</ThemedText>
              <ThemedText style={{ fontWeight: '600' }}>{userData?.displayName || currentUser?.displayName || t('common.error')}</ThemedText>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <ThemedText style={{ opacity: 0.6 }}>{t('settings.email')}</ThemedText>
              <ThemedText style={{ fontWeight: '600' }}>{userData?.email || currentUser?.email}</ThemedText>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            <button
              onClick={() => navigate('/manage-accounts')}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${colors.border}`,
                color: colors.text, backgroundColor: colors.card, fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.card}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Users size={18} color={colors.primary} />
                {t('settings.manage_accounts')}
              </span>
            </button>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${colors.border}`,
                color: colors.text, backgroundColor: colors.card, fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.card}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <LogOut size={18} color="#FF9500" />
                {t('settings.logout')}
              </span>
            </button>
            <button
              onClick={() => navigate('/delete-account')}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${colors.border}`,
                color: '#FF3B30', backgroundColor: colors.card, fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF3B3010'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.card}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Trash2 size={18} color="#FF3B30" />
                {t('settings.delete_account')}
              </span>
            </button>
          </div>

        </section>

      </div>
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        showCancelButton={alertConfig.type === 'confirm'}
        confirmText={alertConfig.type === 'confirm' ? t('settings.logout') : t('settings.understood')}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </ThemedView>
  );
}
