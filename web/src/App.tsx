import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Home from './pages/main/Home';
import Explore from './pages/main/Explore';
import Create from './pages/main/Create';
import Messages from './pages/main/Messages';
import Profile from './pages/main/Profile';
import Chat from './pages/chat/Chat';
import Register from './pages/auth/Register';
import Settings from './pages/settings/Settings';
import ThemeSettings from './pages/settings/ThemeSettings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/create" element={<Create />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/theme" element={<ThemeSettings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;