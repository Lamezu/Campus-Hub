import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import DirectChat from './pages/chat/DirectChat';
import { CallProvider } from './contexts/CallContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import Friends from './pages/main/Friends';

function App() {
  return (
    <NotificationsProvider>
    <CallProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/campus" element={<Campus />} />
        <Route path="/messages" element={<Messages />} />
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
      </Routes>
    </BrowserRouter>
    </CallProvider>
    </NotificationsProvider>
  );
}

export default App;