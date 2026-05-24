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

  if (isAdmin) return <AdminPage />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ViewModeProvider>
      <Root />
    </ViewModeProvider>
  </StrictMode>,
)
