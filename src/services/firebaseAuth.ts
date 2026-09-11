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
// Cache the access token strictly in memory (per security guidelines)
let cachedAccessToken: string | null = null;
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

/**
 * Must be called from a button click or user interaction
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal memperoleh token akses Google Drive dari Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    currentUser = result.user;
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
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
  notifyListeners();
};
