import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function Settings() {
  const [userData, setUserData] = useState<any>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUserData();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      alert('Error al cerrar sesión');
    }
    setShowLogoutConfirm(false);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'student': return 'Student';
      case 'teacher': return 'Teacher';
      case 'admin': return 'Administrator';
      default: return role;
    }
  };

  return (
    <div className="chat-loading-container">
      <div className="chat-header">
        <button
          className="chat-back-button"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <h1 className="chat-header-title">Settings</h1>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        <div className="settings-section">
          <h2 className="settings-section-title">Profile</h2>
          
          <div className="settings-info-row">
            <span className="settings-label">Name</span>
            <span className="settings-value">
              {userData?.displayName || currentUser?.displayName || 'User'}
            </span>
          </div>

          <div className="settings-info-row">
            <span className="settings-label">Email</span>
            <span className="settings-value">{currentUser?.email}</span>
          </div>

          <div className="settings-info-row">
            <span className="settings-label">Role</span>
            <span className="settings-value">
              {getRoleDisplay(userData?.role || 'student')}
            </span>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">Account</h2>
          
          {!showLogoutConfirm ? (
            <button 
              className="settings-button settings-logout-button"
              onClick={() => setShowLogoutConfirm(true)}
            >
              Cerrar Sesión
            </button>
          ) : (
            <div className="settings-confirm-container">
              <p className="settings-confirm-text">¿Seguro que quieres cerrar sesión?</p>
              <div className="settings-confirm-buttons">
                <button 
                  className="settings-confirm-cancel"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancelar
                </button>
                <button 
                  className="settings-confirm-logout"
                  onClick={handleLogout}
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">Coming Soon</h2>
          <p className="settings-coming-soon">
            • Theme Settings<br />
            • Timezone<br />
            • Saved Messages<br />
            • Delete Account
          </p>
        </div>
      </div>
    </div>
  );
}