import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminPage from './AdminPage.jsx'
import { ViewModeProvider } from './ViewModeContext.jsx'

function Root() {
  // /restart 경로 접근 시 tabget: 키 전체 초기화 후 메인으로 redirect
  if (/\/restart\/?$/.test(window.location.pathname)) {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('tabget:')) localStorage.removeItem(key);
    }
    const base = window.location.pathname.replace(/\/restart\/?$/, '') || '/';
    window.location.replace(base + '/');
    return null;
  }

  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const isAdmin = hash === '#admin';

  useEffect(() => {
    document.body.style.overflow = isAdmin ? 'auto' : 'hidden';
    return () => { document.body.style.overflow = 'hidden'; };
  }, [isAdmin]);

  if (isAdmin) {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100svh', background: '#09090b', color: '#a1a1aa', fontFamily: 'sans-serif', gap: '12px' }}>
          <span style={{ fontSize: '2rem' }}>🚧</span>
          <p style={{ fontSize: '1rem' }}>Admin 페이지는 데모 빌드에서 비활성화되어 있습니다.</p>
          <a href="#" style={{ color: '#6366f1', fontSize: '0.875rem' }}>← 메인으로</a>
        </div>
      );
    }
    return <AdminPage />;
  }
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ViewModeProvider>
      <Root />
    </ViewModeProvider>
  </StrictMode>,
)
