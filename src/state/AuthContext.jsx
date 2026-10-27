import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, getSessionToken, setSessionToken, resetSession } from '../lib/apiClient.js';
import { renderGoogleButton, unmountGoogleButton } from '../lib/googleAuth.js';
import { flushSyncQueue, pendingCount } from '../lib/syncQueue.js';
import { syncDown } from '../lib/cacheSync.js';
import { getSetting, setSetting, getTeacher, createTeacher } from '../db/repositories.js';
import { GOOGLE_CLIENT_ID, API_URL, isBackendConfigured } from '../lib/env.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'session_token';
const REFRESH_KEY = 'refresh_token';

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
  const syncInFlight = useRef(null);
  const refreshInFlight = useRef(null);
  const authChannel = useRef(null);

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

  /** Persists a login/refresh result and informs other open tabs. */
  const storeSession = useCallback(async (data) => {
    setSessionToken(data.session_token);
    await setSetting(TOKEN_KEY, data.session_token);
    if (data.refresh_token !== undefined) {
      await setSetting(REFRESH_KEY, data.refresh_token || null);
    }
    if (mounted.current) setUser(data.user);
    authChannel.current?.postMessage({
      type: 'signed-in',
      token: data.session_token,
      refreshToken: data.refresh_token,
      user: data.user,
    });
  }, []);

  /**
   * Silently exchanges the stored refresh token for a new session. Returns
   * true on success and false when the refresh token is no longer valid.
   * Network failures are thrown so callers can retry later instead of
   * signing the user out.
   */
  const refreshSession = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const run = (async () => {
      const refreshToken = await getSetting(REFRESH_KEY);
      if (!refreshToken) return false;
      try {
        const data = await api.refreshSession(refreshToken);
        if (!data?.session_token) return false;
        await storeSession(data);
        return true;
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.code === 'UNAUTHENTICATED' || error.code === 'UNAUTHORIZED')
        ) {
          return false;
        }
        throw error;
      }
    })();

    const promise = run.finally(() => {
      if (refreshInFlight.current === promise) refreshInFlight.current = null;
    });
    refreshInFlight.current = promise;
    return promise;
  }, [storeSession]);

  /**
   * Drops an expired session so the user is prompted to sign in again. The
   * queued attendance stays on the device and syncs after re-authentication.
   * `expiredToken` guards against signing out a newer session that was
   * established in another tab while this request was in flight.
   */
  const expireSession = useCallback(async (error, expiredToken) => {
    if (!expiredToken || getSessionToken() !== expiredToken) return false;
    resetSession();
    if ((await getSetting(TOKEN_KEY)) === expiredToken) {
      await setSetting(TOKEN_KEY, null);
    }
    await setSetting(REFRESH_KEY, null);
    if (mounted.current) {
      setUser(null);
      setAuthError(error?.message || 'Your session has expired. Please sign in again.');
    }
    authChannel.current?.postMessage({ type: 'signed-out' });
    return true;
  }, []);

  const syncNow = useCallback(() => {
    const sessionToken = getSessionToken();
    if (syncInFlight.current) {
      if (syncInFlight.current.sessionToken === sessionToken) return syncInFlight.current.promise;
      return syncInFlight.current.promise.catch(() => {}).then(() => syncNow());
    }

    const sync = (async () => {
      const flushOnce = async () => {
        const token = getSessionToken();
        const result = await flushSyncQueue();
        if (mounted.current) setSyncState({ pending: result.remaining, lastResult: result });
        await refreshPending();
        return { result, token };
      };

      let { result, token } = await flushOnce();
      let authError = result.errors?.find((error) => error.code === 'UNAUTHENTICATED');

      if (authError) {
        let refreshed = false;
        try {
          refreshed = await refreshSession();
        } catch (error) {
          // Could not reach the backend to refresh; keep the session and the
          // queued rows so they retry automatically later.
          console.error('Could not refresh the session.', error);
          return result;
        }
        if (!refreshed) {
          await expireSession(new ApiError(authError.code, authError.message), token);
          return result;
        }
        ({ result, token } = await flushOnce());
        authError = result.errors?.find((error) => error.code === 'UNAUTHENTICATED');
        if (authError) {
          await expireSession(new ApiError(authError.code, authError.message), token);
          return result;
        }
      }

      if (result.synced > 0) {
        syncDown().catch((error) => console.error('Could not refresh local data after syncing.', error));
      }
      return result;
    })();

    const promise = sync.finally(() => {
      if (syncInFlight.current?.promise === promise) syncInFlight.current = null;
    });
    syncInFlight.current = { sessionToken, promise };
    return promise;
  }, [expireSession, refreshPending, refreshSession]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel('attendance-auth');
    authChannel.current = channel;
    channel.onmessage = ({ data }) => {
      if (data?.type === 'signed-in' && data.token && data.user) {
        setSessionToken(data.token);
        if (mounted.current) setUser(data.user);
        setSetting(TOKEN_KEY, data.token).catch((error) => {
          console.error('Could not persist the session from another tab.', error);
        });
        if (data.refreshToken !== undefined) {
          setSetting(REFRESH_KEY, data.refreshToken || null).catch((error) => {
            console.error('Could not persist the refresh token from another tab.', error);
          });
        }
        syncNow().catch((error) => console.error('Automatic sync failed.', error));
      } else if (data?.type === 'signed-out') {
        resetSession();
        if (mounted.current) setUser(null);
        setSetting(TOKEN_KEY, null).catch((error) => {
          console.error('Could not clear the saved session after signing out.', error);
        });
        setSetting(REFRESH_KEY, null).catch((error) => {
          console.error('Could not clear the saved refresh token after signing out.', error);
        });
      }
    };
    return () => {
      authChannel.current = null;
      channel.close();
    };
  }, [syncNow]);

  /** Restores a stored session and validates it against the backend. */
  const bootstrap = useCallback(async () => {
    if (!isBackendConfigured()) {
      // Local-only mode: use/create a local teacher profile
      try {
        let localTeacher = await getTeacher();
        if (!localTeacher) {
          localTeacher = await createTeacher({ name: 'Professor', email: '' });
        }
        if (mounted.current) {
          setUser({
            teacher_id: localTeacher.id,
            name: localTeacher.name,
            email: localTeacher.email,
            role: 'teacher',
            active: true,
          });
        }
      } catch (e) {
        // ignore
      }
      setReady(true);
      return;
    }
    let bootstrapToken = null;
    let storedRefresh = null;
    try {
      bootstrapToken = await getSetting(TOKEN_KEY);
      storedRefresh = await getSetting(REFRESH_KEY);
      if (!bootstrapToken && !storedRefresh) {
        setReady(true);
        return;
      }

      if (bootstrapToken) {
        setSessionToken(bootstrapToken);
        try {
          const data = await api.getCurrentUser();
          if (!mounted.current) return;
          setUser(data.user);
          // Drain queued writes as soon as a stored session is restored.
          syncNow().catch((error) => console.error('Automatic sync failed.', error));
          // Populate the Dexie cache from the backend (best-effort).
          syncDown().catch((error) => console.error('Could not refresh local data.', error));
          return;
        } catch (error) {
          const sessionExpired =
            error instanceof ApiError &&
            error.code === 'UNAUTHENTICATED' &&
            getSessionToken() === bootstrapToken;
          if (!sessionExpired) throw error;
          // Fall through and renew the session with the refresh token.
        }
      }

      // Renew silently; the user should stay signed in across session expiry.
      const refreshed = await refreshSession();
      if (!refreshed) {
        resetSession();
        if ((await getSetting(TOKEN_KEY)) === bootstrapToken) {
          await setSetting(TOKEN_KEY, null);
        }
        if ((await getSetting(REFRESH_KEY)) === storedRefresh) {
          await setSetting(REFRESH_KEY, null);
        }
        if (mounted.current) setUser(null);
        return;
      }
      if (!mounted.current) return;
      syncNow().catch((error) => console.error('Automatic sync failed.', error));
      syncDown().catch((error) => console.error('Could not refresh local data.', error));
    } catch (error) {
      console.error('Could not validate the saved session.', error);
    } finally {
      if (mounted.current) setReady(true);
    }
  }, [refreshSession, syncNow]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Retry pending writes on reconnect, when the app is reopened, and after
  // temporary server failures while the browser remains online.
  useEffect(() => {
    const trySync = () => {
      if (user && navigator.onLine && document.visibilityState === 'visible') {
        syncNow().catch((error) => console.error('Automatic sync failed.', error));
      }
    };
    const goOnline = () => trySync();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') trySync();
    };
    window.addEventListener('online', goOnline);
    document.addEventListener('visibilitychange', onVisibilityChange);
    refreshPending()
      .then((count) => {
        if (count > 0) trySync();
      })
      .catch((error) => console.error('Could not read the sync queue.', error));
    const interval = window.setInterval(() => {
      if (syncState.pending > 0) trySync();
    }, 30_000);
    return () => {
      window.removeEventListener('online', goOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [user, syncNow, refreshPending, syncState.pending]);

  const completeSignIn = useCallback(async (idToken) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const data = await api.login(idToken);
      await storeSession(data);
      // Attendance marked while signed out is still queued; drain it now,
      // then pull the roster so the UI matches the backend.
      syncNow().catch((error) => console.error('Automatic sync failed.', error));
      syncDown().catch((error) => console.error('Could not refresh local data.', error));
      return data.user;
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.');
      throw error;
    } finally {
      if (mounted.current) setSigningIn(false);
    }
  }, [storeSession, syncNow]);

  const signInWithGoogle = useCallback(async () => {
    const { requestGoogleIdToken } = await import('../lib/googleAuth.js');
    const idToken = await requestGoogleIdToken();
    return completeSignIn(idToken);
  }, [completeSignIn]);

  const signOut = useCallback(async () => {
    resetSession();
    await setSetting(TOKEN_KEY, null);
    await setSetting(REFRESH_KEY, null);
    if (mounted.current) setUser(null);
    authChannel.current?.postMessage({ type: 'signed-out' });
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
