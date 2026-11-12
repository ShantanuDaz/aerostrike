import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AppErrorBoundary } from './features/ui/AppErrorBoundary';
import { initPwaLifecycle } from './features/pwa';

initPwaLifecycle((roomCode) => {
  try {
    const nextUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;
    window.history.replaceState(window.history.state, '', nextUrl);
    window.dispatchEvent(new CustomEvent('aerostrike:launch-room', { detail: roomCode }));
  } catch {
    // ignore restricted History API environments
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
