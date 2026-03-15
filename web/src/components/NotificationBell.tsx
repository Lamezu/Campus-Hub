import { useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { useTheme } from '../contexts/ThemeContext';

export default function NotificationBell() {
  const { pendingRequests, requestSenders, acceptRequest, rejectRequest } = useNotifications();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const count = pendingRequests.length;

  const handleAccept = async (req: any) => {
    setActionLoading(req.id);
    try { await acceptRequest(req); } catch {}
    setActionLoading(null);
  };

  const handleReject = async (req: any) => {
    setActionLoading(req.id);
    try { await rejectRequest(req); } catch {}
    setActionLoading(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          color: 'var(--text)'
        }}
        aria-label="Notificaciones"
      >
        <Bell size={22} />
        {count > 0 && (
          <span style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            backgroundColor: colors.primary,
            color: '#fff',
            borderRadius: '10px',
            minWidth: '16px',
            height: '16px',
            fontSize: '10px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '320px',
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            zIndex: 999,
            overflow: 'hidden',
            maxHeight: '400px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              fontWeight: '700',
              fontSize: '15px',
              color: 'var(--text)'
            }}>
              Notificaciones
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {pendingRequests.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '32px 16px',
                  gap: '8px'
                }}>
                  <Bell size={32} color="var(--text-secondary)" strokeWidth={1.5} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                    Sin notificaciones
                  </p>
                </div>
              ) : (
                pendingRequests.map(req => {
                  const sender = requestSenders[req.fromUserId];
                  const name = sender?.displayName || req.fromUserName;
                  const photo = sender?.photoURL || req.fromUserPhoto;
                  const loading = actionLoading === req.id;
                  return (
                    <div key={req.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                        flexShrink: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#fff'
                      }}>
                        {photo
                          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : name[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', fontWeight: '500', lineHeight: '18px' }}>
                          <strong>{name}</strong> te envió una solicitud de amistad
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleAccept(req)}
                          disabled={loading}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            backgroundColor: colors.primary,
                            border: 'none',
                            cursor: 'pointer',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: loading ? 0.6 : 1
                          }}
                        >
                          <Check size={15} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          disabled={loading}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--background-secondary)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: loading ? 0.6 : 1
                          }}
                        >
                          <X size={15} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
