/**
 * Google Identity Services wrapper.
 *
 * Loads the GIS script once, initialises the client id from env, and returns
 * the raw ID token. Everything else — audience, expiry, email verification,
 * teacher lookup — is enforced by the Apps Script backend.
 */
import { GOOGLE_CLIENT_ID } from './env.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;

function loadScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in requires a browser.'));
  }
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.accounts.id), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Google Sign-In.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.accounts.id);
    script.onerror = () => reject(new Error('Could not load Google Sign-In.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

let credentialCallback = null;

/**
 * Renders the official Google button into `element` and resolves the Promise
 * with the ID token when the user finishes. Called per mount, so call
 * `unmountGoogleButton` on cleanup.
 */
export async function renderGoogleButton(element, { onSuccess, onError }) {
  const idClient = await loadScript();
  if (!GOOGLE_CLIENT_ID) {
    onError?.(new Error('VITE_GOOGLE_CLIENT_ID is not set.'));
    return () => {};
  }

  credentialCallback = (response) => {
    onSuccess?.(response.credential);
  };

  idClient.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => credentialCallback?.(response),
  });

  idClient.renderButton(element, {
    theme: 'outline',
    size: 'large',
    type: 'standard',
    text: 'signin_with',
    width: 280,
    shape: 'rectangular',
    locale: 'en',
  });

  return () => {
    credentialCallback = null;
  };
}

/** One-shot popup flow for button-less sign-in. */
export async function requestGoogleIdToken() {
  const idClient = await loadScript();
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set.');

  return new Promise((resolve, reject) => {
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    document.body.appendChild(holder);
    const cleanup = () => {
      holder.remove();
      credentialCallback = null;
    };
    credentialCallback = (response) => {
      cleanup();
      resolve(response.credential);
    };
    idClient.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => credentialCallback?.(response),
    });
    idClient.renderButton(holder, { theme: 'outline', size: 'large', width: 280 });
    // Auto-select is unreliable outside an explicit click; the rendered
    // button needs a human, so reject after 60s of silence.
    setTimeout(() => {
      if (credentialCallback) {
        cleanup();
        reject(new Error('Sign-in was not completed.'));
      }
    }, 60000);
  });
}

export function unmountGoogleButton(element) {
  if (element) element.innerHTML = '';
  credentialCallback = null;
}
