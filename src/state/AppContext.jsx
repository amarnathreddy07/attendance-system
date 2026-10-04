import { createContext, useCallback, useContext, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getTeacher } from '../db/repositories.js';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [toasts, setToasts] = useState([]);

  const teacher = useLiveQuery(() => getTeacher(), []);

  const pushToast = useCallback(({ type = 'success', title, message }) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = {
    teacher,
    online,
    setOnline,
    pushToast,
    toasts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
