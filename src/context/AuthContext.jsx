import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../firebase/config';

const AuthContext = createContext();

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
      const { signInWithRedirect } = await import('firebase/auth');
      await signInWithRedirect(auth, provider);
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
    const handleRedirectResult = async () => {
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

    handleRedirectResult();

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
