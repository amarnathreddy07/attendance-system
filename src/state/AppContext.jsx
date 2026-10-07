import { createContext, useCallback, useContext, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [toasts, setToasts] = useState([]);

  // Teacher/session now comes from the backend session (AuthContext).
  const auth = useAuth();

  const pushToast = useCallback(({ type = 'success', title, message }) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = {
    teacher: auth.teacher,
    isAdmin: auth.isAdmin,
    online,
    setOnline,
    pushToast,
    toasts,
    syncNow: auth.syncNow,
    pendingSync: auth.pendingSync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
