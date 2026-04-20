import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './config/firebase';
import Login from './pages/auth/Login';
import Home from './pages/main/Home';
import Explore from './pages/main/Explore';
import Messages from './pages/main/Messages';
import Profile from './pages/main/Profile';
import Chat from './pages/chat/Chat';
import Register from './pages/auth/Register';
import ThemeSettings from './pages/settings/ThemeSettings';
import EditProfile from './pages/settings/EditProfile';
import AccountDetails from './pages/settings/AccountDetails';
import Settings from './pages/settings/Settings';
import PostDetail from './pages/posts/PostDetail';
import EditPost from './pages/posts/EditPost';
import Campus from './pages/main/Campus';
import AnnouncementDetail from './pages/campus/AnnouncementDetail';
import DirectChat from './pages/chat/DirectChat';
import { CallProvider, useCall } from './contexts/CallContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { MessageSoundProvider } from './contexts/MessageSoundContext';
import { AccountsProvider } from './contexts/AccountsContext';
import Accounts from './pages/settings/Accounts';
import AddAccount from './pages/settings/AddAccount';
import DeleteAccount from './pages/settings/DeleteAccount';
import Support from './pages/main/Support';
import Events from './pages/main/Events';
import ArchivedChats from './pages/main/ArchivedChats';
import GroupChat from './pages/chat/GroupChat';
import Friends from './pages/main/Friends';
import SavedItems from './pages/main/SavedItems';
import AdminUsers from './pages/admin/AdminUsers';
import CallScreen, { IncomingCallModal } from './components/call/CallScreen';
import GroupCallScreen, { IncomingGroupCallModal } from './components/call/GroupCallScreen';
import ConferenceScreen, { IncomingConferenceModal } from './components/call/ConferenceScreen';
import { useTranslation } from './hooks/useTranslation';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function AuthExpiryGuard() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const ts = localStorage.getItem('loginTimestamp');
      if (!ts) {
        localStorage.setItem('loginTimestamp', Date.now().toString());
        return;
      }
      if (Date.now() - parseInt(ts) > ONE_MONTH_MS) {
        localStorage.removeItem('loginTimestamp');
        signOut(auth);
      }
    });
    return unsub;
  }, []);
  return null;
}

function GlobalCallOverlay() {
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
            {awaitingConference.groupPhoto
              ? <img src={awaitingConference.groupPhoto} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff' }}>
                {awaitingConference.groupName.charAt(0).toUpperCase()}
              </div>
            }
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, textAlign: 'center' }}>
              {awaitingConference.groupName}
            </div>
            <div style={{ color: '#a0a0b0', fontSize: 14, textAlign: 'center' }}>
              Esperando que el host te admita…
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
              Cancelar
            </button>
          </div>
        </div>
      )}
      {activeConference && (
        <ConferenceScreen
          callId={activeConference.callId}
          isInitiator={activeConference.isInitiator}
          canApprove={activeConference.isInitiator || activeConference.myRole === 'teacher' || activeConference.myRole === 'admin'}
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
    </>
  );
}

function App() {
  const { t } = useTranslation();

  return (
    <AccountsProvider>
      <LanguageProvider>
        <NotificationsProvider t={t}>
          <CallProvider>
            <BrowserRouter>
              <AuthExpiryGuard />
              <MessageSoundProvider>
                <GlobalCallOverlay />
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/campus" element={<Campus />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/messages/archived" element={<ArchivedChats />} />
                  <Route path="/messages/group/:groupId" element={<GroupChat />} />
                  <Route path="/messages/:conversationId" element={<DirectChat />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/" element={<Navigate to="/login" />} />
                  <Route path="/chat/:id" element={<Chat />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/theme" element={<ThemeSettings />} />
                  <Route path="/edit-profile" element={<EditProfile />} />
                  <Route path="/account-details" element={<AccountDetails />} />
                  <Route path="/post/:id" element={<PostDetail />} />
                  <Route path="/post/:id/edit" element={<EditPost />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/campus/announcement/:id" element={<AnnouncementDetail />} />
                  <Route path="/saved-items" element={<SavedItems />} />
                  <Route path="/settings/accounts" element={<Accounts />} />
                  <Route path="/settings/add-account" element={<AddAccount />} />
                  <Route path="/settings/delete-account" element={<DeleteAccount />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/chat/3" element={<Navigate to="/events" replace />} />
                  <Route path="/chat/4" element={<Navigate to="/support" replace />} />
                </Routes>
              </MessageSoundProvider>
            </BrowserRouter>
          </CallProvider>
        </NotificationsProvider>
      </LanguageProvider>
    </AccountsProvider>
  );
}

export default App;
