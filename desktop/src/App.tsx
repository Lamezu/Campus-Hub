import React, { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserProvider } from '@/contexts/UserContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { AccountsProvider } from '@/contexts/AccountsContext';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';

import LoginScreen from '@/pages/auth/LoginScreen';
import RegisterScreen from '@/pages/auth/RegisterScreen';
import TabsLayout from '@/pages/tabs/TabsLayout';
import ChatScreen from '@/pages/chat/ChatScreen';
import PostScreen from '@/pages/post/PostScreen';
import SettingsScreen from '@/pages/SettingsScreen';
import EditProfileScreen from '@/pages/EditProfileScreen';
import EditPostScreen from '@/pages/EditPostScreen';
import DMChatScreen from '@/pages/dm/DMChatScreen';
import GroupChatScreen from '@/pages/dm/GroupChatScreen';
import CallScreen from '@/pages/dm/CallScreen';
import FriendsScreen from '@/pages/FriendsScreen';
import NotificationsScreen from '@/pages/NotificationsScreen';
import SavedItemsScreen from '@/pages/SavedItemsScreen';
import ForwardScreen from '@/pages/ForwardScreen';
import ManageAccountsScreen from '@/pages/ManageAccountsScreen';
import AddAccountScreen from '@/pages/AddAccountScreen';
import DeleteAccountScreen from '@/pages/DeleteAccountScreen';

import { LanguageProvider, useTranslation } from '@/contexts/LanguageContext';
import { CallProvider } from '@/contexts/CallContext';
import GlobalCallOverlay from '@/components/call/GlobalCallOverlay';

function AuthGuard({ children, isAuthenticated }: { children: React.ReactNode, isAuthenticated: boolean }) {
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginScreen />} />
      <Route path="/auth/register" element={<RegisterScreen />} />
      <Route path="/tabs/*" element={<AuthGuard isAuthenticated={isAuthenticated}><TabsLayout /></AuthGuard>} />
      <Route path="/chat/:id" element={<AuthGuard isAuthenticated={isAuthenticated}><ChatScreen /></AuthGuard>} />
      <Route path="/post/:id" element={<AuthGuard isAuthenticated={isAuthenticated}><PostScreen /></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard isAuthenticated={isAuthenticated}><SettingsScreen /></AuthGuard>} />
      <Route path="/edit-profile" element={<AuthGuard isAuthenticated={isAuthenticated}><EditProfileScreen /></AuthGuard>} />
      <Route path="/edit-post/:id" element={<AuthGuard isAuthenticated={isAuthenticated}><EditPostScreen /></AuthGuard>} />
      <Route path="/manage-accounts" element={<AuthGuard isAuthenticated={isAuthenticated}><ManageAccountsScreen /></AuthGuard>} />
      <Route path="/add-account" element={<AuthGuard isAuthenticated={isAuthenticated}><AddAccountScreen /></AuthGuard>} />
      <Route path="/delete-account" element={<AuthGuard isAuthenticated={isAuthenticated}><DeleteAccountScreen /></AuthGuard>} />
      <Route path="/dm/:userId" element={<AuthGuard isAuthenticated={isAuthenticated}><DMChatScreen /></AuthGuard>} />
      <Route path="/dm/group/:groupId" element={<AuthGuard isAuthenticated={isAuthenticated}><GroupChatScreen /></AuthGuard>} />
      <Route path="/friends" element={<AuthGuard isAuthenticated={isAuthenticated}><FriendsScreen /></AuthGuard>} />
      <Route path="/notifications" element={<AuthGuard isAuthenticated={isAuthenticated}><NotificationsScreen /></AuthGuard>} />
      <Route path="/saved-items" element={<AuthGuard isAuthenticated={isAuthenticated}><SavedItemsScreen /></AuthGuard>} />
      <Route path="/forward" element={<AuthGuard isAuthenticated={isAuthenticated}><ForwardScreen /></AuthGuard>} />
      <Route path="/" element={<Navigate to="/tabs/home" replace />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setIsInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (isInitializing) {
    return (
      <div style={{
        backgroundColor: '#1E1F22', height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 24, fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '4px solid rgba(88,101,242,0.1)', borderTop: '4px solid #5865f2',
            animation: 'spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite'
          }} />
          <div style={{
            position: 'absolute', inset: 12, borderRadius: '50%',
            border: '4px solid rgba(35,165,90,0.1)', borderTop: '4px solid #23a55a',
            animation: 'spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse'
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '0.5px' }}>CampusHub</span>
          <span style={{ color: '#b9bbbe', fontSize: 13, fontWeight: 500 }}>Sincronizando...</span>
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <UserProvider>
        <LanguageProvider>
          <AlertProvider>
            <CallProvider>
              <AccountsProvider>
                <MemoryRouter 
                  initialEntries={[isAuthenticated ? '/tabs/home' : '/auth/login']} 
                  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
                >
                  <AppRoutes isAuthenticated={isAuthenticated} />
                  <GlobalCallOverlay />
                </MemoryRouter>
              </AccountsProvider>
            </CallProvider>
          </AlertProvider>
        </LanguageProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
