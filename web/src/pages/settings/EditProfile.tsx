import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { uploadProfilePhoto } from '../../config/cloudinary';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useAccounts } from '../../contexts/AccountsContext';
import { Check, Users, UserMinus, LogOut, ChevronRight } from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';

export default function EditProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { colors } = useTheme();

  const currentUser = auth.currentUser;
  const { t, language, setLanguage } = useTranslation();
  const { accounts, activeUid } = useAccounts();

  const LANG_OPTIONS = [
    { id: 'es' as const, label: t('common.spanish'), countryCode: 'ES' },
    { id: 'en' as const, label: t('common.english'), countryCode: 'GB' },
  ];

  const handleLogout = async () => {
    if (!window.confirm(t('common.logout_confirm'))) return;
    try {
      await signOut(auth);
      navigate('/login');
    } catch {}
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setDisplayName(userData.displayName || '');
        setBio(userData.bio || '');
        setPhotoURL(userData.photoURL || null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      alert('Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!currentUser || saving) return;

    setSaving(true);
    try {
      let finalPhotoURL = photoURL;

      if (selectedFile) {
        finalPhotoURL = await uploadProfilePhoto(selectedFile, currentUser.uid);
      }

      await updateProfile(currentUser, {
        displayName: displayName,
        photoURL: finalPhotoURL
      });

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        displayName,
        bio,
        photoURL: finalPhotoURL,
        updatedAt: serverTimestamp()
      });

      alert('Perfil actualizado correctamente');
      navigate(-1);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="chat-loading-container">
        <div className="chat-header">
          <button className="chat-back-button" onClick={() => navigate(-1)}>←</button>
          <h1 className="chat-header-title">{t('profile.edit_profile')}</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-loading-container">
      <div className="chat-header">
        <button className="chat-back-button" onClick={() => navigate(-1)}>←</button>
        <h1 className="chat-header-title">{t('profile.edit_profile')}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="chat-back-button"
          style={{ color: colors.primary, fontSize: '16px', fontWeight: 'bold' }}
        >
          {saving ? '...' : t('common.save')}
        </button>
      </div>

      <div className="container" style={{ paddingTop: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '60px',
              backgroundColor: colors.backgroundSecondary,
              backgroundImage: previewUrl || photoURL ? `url(${previewUrl || photoURL})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: 'pointer',
              border: `2px solid ${colors.primary}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '12px'
            }}
          >
            {!previewUrl && !photoURL && (
              <span style={{ fontSize: '40px', color: colors.textSecondary }}>+</span>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'none',
              border: `1px solid ${colors.primary}`,
              color: colors.primary,
              padding: '8px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cambiar foto
          </button>
        </div>

        <div className="settings-section" style={{ borderBottom: 'none' }}>
          <div className="form-group">
            <label className="form-label">Nombre de usuario</label>
            <input
              type="text"
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('profile.bio_label')}</label>
            <textarea
              className="form-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('profile.describe_yourself')}
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="settings-section" style={{ 
          marginTop: '16px',
          padding: '16px',
          backgroundColor: colors.backgroundSecondary,
          borderRadius: '12px'
        }}>
          <h2 className="settings-section-title" style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: '8px'
          }}>
            {t('profile.account_privacy')}
          </h2>
          <p className="text-subtitle" style={{
            fontSize: '14px',
            color: colors.textSecondary,
            marginBottom: '16px',
            lineHeight: '1.4'
          }}>
            {t('profile.manage_account_desc')}
          </p>

          <div
            onClick={() => navigate('/account-details')}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 0',
              cursor: 'pointer',
              borderTop: `1px solid ${colors.border}`
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <div style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '4px',
              backgroundColor: colors.primary,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              fontSize: '14px'
            }}>
              ✓
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ color: colors.text, fontSize: '16px' }}>Datos de la cuenta</span>
            </div>
            <div style={{ fontSize: '20px', color: colors.textSecondary }}>›</div>
          </div>
        </div>
        </div>

        <div style={{ padding: '24px', textAlign: 'center' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: `1px solid ${colors.danger}`,
              color: colors.danger,
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              width: '100%',
              maxWidth: '300px'
            }}
          >
            Descartar Cambios
          </button>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">{t('common.language')}</h2>
          <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px', marginBottom: '14px' }}>
            {t('settings.language_subtitle')}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {LANG_OPTIONS.map(opt => {
              const isSelected = language === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setLanguage(opt.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '14px 12px', borderRadius: '14px', cursor: 'pointer',
                    border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                    backgroundColor: isSelected ? colors.primary + '14' : 'transparent',
                    color: isSelected ? colors.primary : colors.text,
                    fontWeight: isSelected ? '700' : '400', fontSize: 15,
                    transition: 'all 0.15s',
                  }}
                >
                  <ReactCountryFlag
                    countryCode={opt.countryCode}
                    svg
                    style={{ width: '1.5em', height: '1.5em', borderRadius: '2px', objectFit: 'cover' }}
                  />
                  <span>{opt.label}</span>
                  {isSelected && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="settings-section">
          {[
            {
              icon: <Users size={18} color={colors.primary} strokeWidth={1.8} />,
              label: t('settings.manage_accounts'),
              sublabel: t('settings.saved_accounts_count', { count: accounts.filter(a => a.uid === activeUid || !!a._pw).length }),
              onClick: () => navigate('/settings/accounts'),
              danger: false,
            },
            {
              icon: <UserMinus size={18} color="#FF3B30" strokeWidth={1.8} />,
              label: t('settings.delete_account'),
              sublabel: t('settings.delete_account_desc'),
              onClick: () => navigate('/settings/delete-account'),
              danger: true,
            },
          ].map((item) => (
            <div
              key={item.label}
              onClick={item.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 0',
                borderBottom: `1px solid ${colors.border}`,
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                backgroundColor: item.danger ? '#FF3B3015' : `${colors.primary}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: '600', color: item.danger ? '#FF3B30' : colors.text }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{item.sublabel}</div>
              </div>
              <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
            </div>
          ))}
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              backgroundColor: colors.danger, border: 'none',
              color: '#FFFFFF', fontSize: '15px', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
              marginTop: 8,
            }}
          >
            <LogOut size={18} color="#FFFFFF" />
            {t('common.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}