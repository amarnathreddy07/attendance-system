import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, setSessionToken, resetSession } from '../lib/apiClient.js';
import { renderGoogleButton, unmountGoogleButton } from '../lib/googleAuth.js';
import { flushSyncQueue, pendingCount } from '../lib/syncQueue.js';
import { syncDown } from '../lib/cacheSync.js';
import { getSetting, setSetting } from '../db/repositories.js';
import { GOOGLE_CLIENT_ID, API_URL, isBackendConfigured } from '../lib/env.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'session_token';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Legacy shape the existing pages expect (id/name/email/role). */
function toTeacher(user) {
  if (!user) return null;
  return {
    id: user.teacher_id,
    teacher_id: user.teacher_id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [syncState, setSyncState] = useState({ pending: 0, lastResult: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshPending = useCallback(async () => {
    const count = await pendingCount();
    if (mounted.current) setSyncState((prev) => ({ ...prev, pending: count }));
    return count;
  }, []);

  const syncNow = useCallback(async () => {
    const result = await flushSyncQueue();
    if (mounted.current) setSyncState({ pending: result.remaining, lastResult: result });
    await refreshPending();
    if (result.synced > 0) {
      syncDown().catch(() => {});
    }
    return result;
  }, [refreshPending]);

  /** Restores a stored session and validates it against the backend. */
  const bootstrap = useCallback(async () => {
    if (!isBackendConfigured()) {
      setReady(true);
      return;
    }
    try {
      const token = await getSetting(TOKEN_KEY);
      if (!token) {
        setReady(true);
        return;
      }
      setSessionToken(token);
      const data = await api.getCurrentUser();
      if (!mounted.current) return;
      setUser(data.user);
      // Populate the Dexie cache from the backend (best-effort).
      syncDown().catch(() => {});
    } catch (error) {
      resetSession();
      await setSetting(TOKEN_KEY, null);
      if (mounted.current) setUser(null);
    } finally {
      if (mounted.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Flush the queue whenever the tab comes back online.
  useEffect(() => {
    const goOnline = () => {
      syncNow();
    };
    window.addEventListener('online', goOnline);
    refreshPending();
    return () => window.removeEventListener('online', goOnline);
  }, [syncNow, refreshPending]);

  const completeSignIn = useCallback(async (idToken) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const data = await api.login(idToken);
      setSessionToken(data.session_token);
      await setSetting(TOKEN_KEY, data.session_token);
      setUser(data.user);
      // Attendance marked while signed out is still queued; drain it now,
      // then pull the roster so the UI matches the backend.
      syncNow();
      syncDown().catch(() => {});
      return data.user;
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.');
      throw error;
    } finally {
      if (mounted.current) setSigningIn(false);
    }
  }, [syncNow]);

  const signInWithGoogle = useCallback(async () => {
    const { requestGoogleIdToken } = await import('../lib/googleAuth.js');
    const idToken = await requestGoogleIdToken();
    return completeSignIn(idToken);
  }, [completeSignIn]);

  const signOut = useCallback(async () => {
    resetSession();
    await setSetting(TOKEN_KEY, null);
    if (mounted.current) setUser(null);
  }, []);

  /** Renders the Google button into `element`; returns a cleanup function. */
  const bindGoogleButton = useCallback(
    (element, { onSuccess, onError } = {}) => {
      if (!element) return () => {};
      if (!isBackendConfigured()) {
        onError?.(new Error('Backend is not configured (missing VITE_GOOGLE_CLIENT_ID or VITE_API_URL).'));
        return () => {};
      }
      let unmounted = false;
      renderGoogleButton(element, {
        onSuccess: async (idToken) => {
          if (unmounted) return;
          try {
            const signedIn = await completeSignIn(idToken);
            onSuccess?.(signedIn);
          } catch (error) {
            onError?.(error);
          }
        },
        onError,
      }).catch((error) => onError?.(error));
      return () => {
        unmounted = true;
        unmountGoogleButton(element);
      };
    },
    [completeSignIn]
  );

  const value = useMemo(
    () => ({
      user,
      teacher: toTeacher(user),
      isAdmin: user?.role === 'admin',
      ready,
      signingIn,
      authError,
      signInWithGoogle,
      signOut,
      completeSignIn,
      bindGoogleButton,
      syncNow,
      pendingSync: syncState.pending,
      lastSyncResult: syncState.lastResult,
      refreshPending,
      backendConfigured: isBackendConfigured(),
      googleClientId: GOOGLE_CLIENT_ID,
      apiUrl: API_URL,
    }),
    [
      user,
      ready,
      signingIn,
      authError,
      signInWithGoogle,
      signOut,
      completeSignIn,
      bindGoogleButton,
      syncNow,
      syncState,
      refreshPending,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
