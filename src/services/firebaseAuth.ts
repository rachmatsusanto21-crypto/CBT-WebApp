import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Primary Drive scope as configured via set_up_oauth
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache access token with localStorage persistence so reloads don't lose Drive connectivity
let cachedAccessToken: string | null = (() => {
  try {
    const stored = localStorage.getItem('cbt_gdrive_access_token');
    const ts = localStorage.getItem('cbt_gdrive_token_timestamp');
    if (stored && ts) {
      const ageHours = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60);
      if (ageHours < 4) {
        return stored;
      }
    }
  } catch {}
  return null;
})();
let currentUser: User | null = null;

// Subscribers for auth state changes
type AuthListener = (user: User | null, token: string | null) => void;
const listeners: Set<AuthListener> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener(currentUser, cachedAccessToken);
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
};

export const subscribeAuth = (listener: AuthListener) => {
  listeners.add(listener);
  // Call immediately with current state
  listener(currentUser, cachedAccessToken);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Initialize auth state listener. Call this on app load.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If user is logged in via Firebase session but access token was lost (e.g. reload),
        // we keep the user, cachedAccessToken remains null until user clicks Re-connect or signs in
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
    notifyListeners();
  });
};

declare global {
  interface Window {
    google?: any;
  }
}

export const getFirebaseSettingsUrl = (): string => {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
};

export const getCurrentDomain = (): string => {
  return typeof window !== 'undefined' ? window.location.hostname : '';
};

/**
 * Fallback to Google Identity Services (GSI) OAuth 2.0 token client
 * when Firebase throws auth/unauthorized-domain.
 */
export const requestGsiAccessToken = (): Promise<{ accessToken: string } | null> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window context tidak ditemukan.'));
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      return reject(new Error('OAuth Client ID tidak ditemukan di konfigurasi firebase-applet-config.json.'));
    }

    const launchClient = () => {
      if (!window.google?.accounts?.oauth2) {
        return reject(new Error('Google Identity Services library belum termuat.'));
      }

      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: (response: any) => {
            if (response.error) {
              if (response.error === 'access_denied') {
                resolve(null);
                return;
              }
              reject(new Error(`GSI OAuth: ${response.error_description || response.error}`));
              return;
            }
            if (response.access_token) {
              cachedAccessToken = response.access_token;
              try {
                localStorage.setItem('cbt_gdrive_access_token', response.access_token);
                localStorage.setItem('cbt_gdrive_token_timestamp', Date.now().toString());
              } catch {}
              notifyListeners();
              resolve({ accessToken: response.access_token });
            } else {
              reject(new Error('Tidak ada token akses yang dikembalikan oleh Google OAuth.'));
            }
          },
          error_callback: (nonOAuthError: any) => {
            reject(new Error(nonOAuthError?.message || 'Gagal membuka otentikasi Google Identity Services.'));
          },
        });

        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    };

    if (window.google?.accounts?.oauth2) {
      launchClient();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => launchClient();
      script.onerror = () => reject(new Error('Gagal memuat pustaka Google Identity Services.'));
      document.head.appendChild(script);
    }
  });
};

/**
 * Must be called from a button click or user interaction
 */
export const googleSignIn = async (): Promise<{ user: User | any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal memperoleh token akses Google Drive dari Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    currentUser = result.user;
    try {
      localStorage.setItem('cbt_gdrive_access_token', credential.accessToken);
      localStorage.setItem('cbt_gdrive_token_timestamp', Date.now().toString());
    } catch {}
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/user-cancelled'
    ) {
      // Benign user action: user closed or dismissed the popup window
      console.info('Google sign-in popup was closed by user.');
      return null;
    }

    if (errorCode === 'auth/popup-blocked') {
      console.warn('Google sign-in popup was blocked by browser.');
      throw new Error(
        'Jendela popup diblokir oleh browser. Silakan izinkan popup pada peramban Anda untuk menghubungkan Google Drive.'
      );
    }

    // Specific handling for unauthorized-domain error
    if (errorCode === 'auth/unauthorized-domain') {
      console.warn('Firebase unauthorized domain detected. Trying Google Identity Services (GSI) fallback...');
      try {
        const gsiResult = await requestGsiAccessToken();
        if (gsiResult) {
          const fallbackUser = {
            uid: 'gdrive-authenticated-user',
            displayName: 'Akun Google Terhubung',
            email: 'rachmatsusanto21@guru.sd.belajar.id',
          };
          currentUser = fallbackUser as any;
          return { user: fallbackUser, accessToken: gsiResult.accessToken };
        }
        return null;
      } catch (gsiErr: any) {
        console.warn('GSI fallback was also rejected or unavailable:', gsiErr);
        const domain = getCurrentDomain();
        const customError: any = new Error(
          `Domain "${domain}" belum diizinkan oleh Firebase Authentication. Daftarkan domain ini di Firebase Console (Authentication > Settings > Authorized Domains).`
        );
        customError.code = 'auth/unauthorized-domain';
        customError.domain = domain;
        customError.settingsUrl = getFirebaseSettingsUrl();
        throw customError;
      }
    }

    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const setManualAccessToken = (token: string, email?: string) => {
  cachedAccessToken = token.trim();
  currentUser = {
    uid: 'manual-token-user',
    displayName: 'Akun Google (Token Akses)',
    email: email || 'rachmatsusanto21@guru.sd.belajar.id',
  } as any;
  try {
    localStorage.setItem('cbt_gdrive_access_token', token.trim());
    localStorage.setItem('cbt_gdrive_token_timestamp', Date.now().toString());
  } catch {}
  notifyListeners();
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessTokenInMemory = (token: string | null) => {
  cachedAccessToken = token;
  notifyListeners();
};

export const getCurrentUser = (): User | null => {
  return currentUser || auth.currentUser;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  currentUser = null;
  try {
    localStorage.removeItem('cbt_gdrive_access_token');
    localStorage.removeItem('cbt_gdrive_token_timestamp');
  } catch {}
  notifyListeners();
};
