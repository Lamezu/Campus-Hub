import React, { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';

import LoginScreen from '@/pages/auth/LoginScreen';
import RegisterScreen from '@/pages/auth/RegisterScreen';
import TabsLayout from '@/pages/tabs/TabsLayout';
import ChatScreen from '@/pages/chat/ChatScreen';
import PostScreen from '@/pages/post/PostScreen';
import SettingsScreen from '@/pages/SettingsScreen';
import EditProfileScreen from '@/pages/EditProfileScreen';
import AccountDetailsScreen from '@/pages/AccountDetailsScreen';
import EditPostScreen from '@/pages/EditPostScreen';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setLoading(false);
      if (!user) {
        navigate('/auth/login', { replace: true });
      }
    });
    return unsubscribe;
  }, [navigate]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #007AFF',
          borderRadius: '50%', animation: 'spin 1.8s linear infinite',
        }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#999' }}>Cargando CampusHub...</span>
      </div>
    );
  }
  return isAuthenticated ? <>{children}</> : null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginScreen />} />
      <Route path="/auth/register" element={<RegisterScreen />} />
      <Route path="/tabs/*" element={<AuthGuard><TabsLayout /></AuthGuard>} />
      <Route path="/chat/:id" element={<AuthGuard><ChatScreen /></AuthGuard>} />
      <Route path="/post/:id" element={<AuthGuard><PostScreen /></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard><SettingsScreen /></AuthGuard>} />
      <Route path="/edit-profile" element={<AuthGuard><EditProfileScreen /></AuthGuard>} />
      <Route path="/account-details" element={<AuthGuard><AccountDetailsScreen /></AuthGuard>} />
      <Route path="/edit-post/:id" element={<AuthGuard><EditPostScreen /></AuthGuard>} />
      <Route path="/" element={<Navigate to="/tabs/home" replace />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={['/auth/login']}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>
  );
}
