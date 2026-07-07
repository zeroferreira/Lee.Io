import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../firebase/config';

const AuthContext = createContext();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "741889878750-da4cbkfe3q9gjh2figu71gbt4e9vap5e.apps.googleusercontent.com";

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Initialize from localStorage if available
  const [accessToken, setAccessToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('googleAccessToken') || null;
    }
    return null;
  });

  // Sign in with Google
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    
    // Check if running in WebView/App environment
    const isWebView = typeof window !== 'undefined' && 
      (window.location.hostname === 'appassets.androidplatform.net' || 
       window.location.protocol === 'file:');

    if (isWebView) {
      const clientId = GOOGLE_CLIENT_ID;
      const redirectUri = "https://leeio-f1ab6.firebaseapp.com/__/auth/handler";
      const scopes = [
        "openid",
        "profile",
        "email",
        "https://www.googleapis.com/auth/drive.readonly"
      ].join(" ");
      
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token+id_token&scope=${encodeURIComponent(scopes)}&nonce=${Math.random().toString(36).substring(2)}`;
      
      window.location.href = oauthUrl;
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        localStorage.setItem('googleAccessToken', credential.accessToken);
      }
      return result;
    } catch (error) {
      throw error;
    }
  };

  // Sign out
  const logout = () => {
    setAccessToken(null);
    localStorage.removeItem('googleAccessToken');
    return firebaseSignOut(auth);
  };

  useEffect(() => {
    const handleUrlTokens = async () => {
      if (typeof window === 'undefined') return;
      
      const urlParams = new URLSearchParams(window.location.search);
      const urlAccessToken = urlParams.get('access_token');
      const urlIdToken = urlParams.get('id_token');
      
      if (urlAccessToken || urlIdToken) {
        try {
          setLoading(true);
          const { signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(urlIdToken, urlAccessToken);
          await signInWithCredential(auth, credential);
          
          if (urlAccessToken) {
            setAccessToken(urlAccessToken);
            localStorage.setItem('googleAccessToken', urlAccessToken);
          }
          
          // Clear query parameters from URL history
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch (error) {
          console.error("Error signing in with URL tokens:", error);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Fallback to standard Firebase Auth redirect result
      try {
        const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
        const result = await getRedirectResult(auth);
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken);
            localStorage.setItem('googleAccessToken', credential.accessToken);
          }
        }
      } catch (error) {
        console.error("Error getting redirect result:", error);
      }
    };

    handleUrlTokens();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loginWithGoogle,
    logout,
    loading,
    accessToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
