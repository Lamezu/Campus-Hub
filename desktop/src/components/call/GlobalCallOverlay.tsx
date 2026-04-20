import { useLocation } from 'react-router-dom';
import { useCall } from '../../contexts/CallContext';
import CallScreen, { IncomingCallModal } from './CallScreen';
import GroupCallScreen, { IncomingGroupCallModal } from './GroupCallScreen';
import ConferenceScreen from './ConferenceScreen';
import { IncomingConferenceModal } from './ConferenceScreen';

import { useTranslation } from '@/contexts/LanguageContext';
import { Avatar } from '../common/Avatar';
import { Users } from 'lucide-react';

export default function GlobalCallOverlay() {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    incomingCall, activeCall, setActiveCall, setActiveCallId, acceptIncoming, rejectIncoming,
    incomingGroupCall, activeGroupCall, setActiveGroupCall, setActiveGroupCallId, dismissGroupIncoming, joinGroupIncoming,
    incomingConference, activeConference, setActiveConference, setActiveConferenceId, dismissConferenceIncoming, joinConferenceIncoming,
    awaitingConference, setAwaitingConference,
  } = useCall();

  if (location.pathname === '/login' || location.pathname === '/register') return null;

  return (
    <>
      {incomingCall && !activeCall && !activeGroupCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={acceptIncoming}
          onReject={rejectIncoming}
        />
      )}
      {incomingGroupCall && !activeCall && !activeGroupCall && !incomingCall && (
        <IncomingGroupCallModal
          call={incomingGroupCall}
          onJoin={joinGroupIncoming}
          onDismiss={dismissGroupIncoming}
        />
      )}
      {incomingConference && !activeCall && !activeGroupCall && !activeConference && !incomingCall && !incomingGroupCall && (
        <IncomingConferenceModal
          call={incomingConference}
          onJoin={joinConferenceIncoming}
          onDismiss={dismissConferenceIncoming}
        />
      )}
      {activeCall && (
        <CallScreen
          callId={activeCall.callId}
          isCaller={activeCall.isCaller}
          callType={activeCall.type}
          otherUserName={activeCall.otherUserName}
          otherUserPhoto={activeCall.otherUserPhoto}
          onClose={() => {
            setActiveCall(null);
            setActiveCallId(null);
          }}
        />
      )}
      {activeGroupCall && (
        <GroupCallScreen
          callId={activeGroupCall.callId}
          isInitiator={activeGroupCall.isInitiator}
          callType={activeGroupCall.type}
          groupName={activeGroupCall.groupName}
          groupPhoto={activeGroupCall.groupPhoto}
          myUid={activeGroupCall.myUid}
          myName={activeGroupCall.myName}
          myPhoto={activeGroupCall.myPhoto}
          onClose={() => {
            setActiveGroupCall(null);
            setActiveGroupCallId(null);
          }}
        />
      )}
      {activeConference && (
        <ConferenceScreen
          callId={activeConference.callId}
          isInitiator={activeConference.isInitiator}
          callType={activeConference.type}
          groupName={activeConference.groupName}
          groupPhoto={activeConference.groupPhoto}
          myUid={activeConference.myUid}
          myName={activeConference.myName}
          myPhoto={activeConference.myPhoto}
          onClose={() => {
            setActiveConference(null);
            setActiveConferenceId(null);
          }}
        />
      )}
      {awaitingConference && !activeConference && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#1e1e2e', borderRadius: 16, padding: '32px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            minWidth: 300, boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
          }}>
            <Avatar
              src={awaitingConference.groupPhoto}
              name={awaitingConference.groupName}
              size={64}
              fallbackIcon={Users}
            />
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, textAlign: 'center' }}>
              {awaitingConference.groupName}
            </div>
            <div style={{ color: '#a0a0b0', fontSize: 14, textAlign: 'center' }}>
              {t('contact_info.waiting_host')}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#7c3aed',
                  animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`
                }} />
              ))}
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
            <button
              onClick={() => setAwaitingConference(null)}
              style={{
                marginTop: 8, background: '#3a3a4a', color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 24px', cursor: 'pointer', fontSize: 14
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
