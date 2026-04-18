import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { playTone } from './utils/toneGenerator';

// Handle AudioContext unlocking on first user interaction
const unlockAudio = () => {
  playTone('silent');
  window.removeEventListener('mousedown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
