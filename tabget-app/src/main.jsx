import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminPage from './AdminPage.jsx'
import { ViewModeProvider } from './ViewModeContext.jsx'

function Root() {
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
