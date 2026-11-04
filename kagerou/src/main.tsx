import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/index.css';
import { isNative } from './platform/native';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ネイティブではアプリ本体に同梱されるので Service Worker は不要
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && !isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* オフライン非対応でも本体は動く */ });
  });
}
