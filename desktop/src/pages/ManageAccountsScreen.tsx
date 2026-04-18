import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Check, Trash2, User as UserIcon, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccounts, type StoredAccount } from '@/contexts/AccountsContext';
import { useAlert } from '@/contexts/AlertContext';
import { useTranslation } from '@/contexts/LanguageContext';

export default function ManageAccountsScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { accounts, activeUid, switching, switchAccount, removeAccount } = useAccounts();
  const { showAlert } = useAlert();
  const { t } = useTranslation();

  const handleSwitch = async (account: StoredAccount) => {
    if (account.uid === activeUid || switching) return;
    try {
      await switchAccount(account);
      navigate('/tabs/home');
    } catch (err: any) {
      const message =
        err.message === 'no_credentials'
          ? t('manage_accounts.switch_error_no_credentials')
          : err.message === 'invalid_credentials'
          ? t('manage_accounts.switch_error_invalid')
          : t('manage_accounts.switch_error_generic');
      showAlert({ title: t('manage_accounts.switch_error_title'), message, type: 'error' });
    }
  };

  const handleRemove = (account: StoredAccount) => {
    if (account.uid === activeUid) return;
    if (window.confirm(t('manage_accounts.remove_confirm'))) {
      removeAccount(account.uid);
    }
  };

  return (
    <div style={{
      height: '100vh',
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'column',
      color: colors.text,
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        padding: '20px 40px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        backgroundColor: colors.card
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: colors.text, cursor: 'pointer',
            padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t('manage_accounts.title')}</h1>
      </div>

      <div style={{ flex: 1, padding: '40px', overflowY: 'auto', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {accounts.map(account => {
            const isActive = account.uid === activeUid;
            return (
              <div
                key={account.uid}
                onClick={() => handleSwitch(account)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 20, padding: '20px',
                  borderRadius: 20,
                  backgroundColor: isActive ? colors.primary + '10' : colors.card,
                  border: `2px solid ${isActive ? colors.primary : colors.border}`,
                  cursor: isActive ? 'default' : 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.05)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <div style={{
                  width: 60, height: 60, borderRadius: 20,
                  backgroundColor: colors.backgroundSecondary, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {account.photoURL ? (
                    <img src={account.photoURL} alt={account.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <UserIcon size={32} color={colors.textSecondary} />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{account.displayName}</div>
                  <div style={{ fontSize: 14, color: colors.textSecondary }}>{account.email}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isActive ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      color: colors.primary, fontWeight: 700, fontSize: 14,
                      padding: '8px 16px', backgroundColor: colors.primary + '20', borderRadius: 12
                    }}>
                      <Check size={18} />
                      {t('manage_accounts.active')}
                    </div>
                  ) : (
                    <>
                      {switching ? (
                        <Loader2 className="animate-spin" size={24} color={colors.primary} />
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); handleRemove(account); }}
                          style={{
                            background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer',
                            padding: 10, borderRadius: 12, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF3B3015'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={() => navigate('/add-account')}
            style={{
              marginTop: 10, padding: '24px', borderRadius: 20,
              backgroundColor: 'transparent', border: `2px dashed ${colors.border}`,
              color: colors.primary, fontSize: 16, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = colors.primary + '05';
              e.currentTarget.style.borderColor = colors.primary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <Plus size={24} />
            {t('manage_accounts.add_account')}
          </button>
        </div>
      </div>
    </div>
  );
}
