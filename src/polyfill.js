// Polyfill sessionStorage with localStorage for WebView to survive redirects
if (typeof window !== 'undefined') {
  const isWebView = window.location.hostname === 'appassets.androidplatform.net' || 
                    window.location.protocol === 'file:';
                    
  if (isWebView) {
    try {
      const mockSessionStorage = {
        getItem: (key) => localStorage.getItem('session_' + key),
        setItem: (key, value) => localStorage.setItem('session_' + key, value),
        removeItem: (key) => localStorage.removeItem('session_' + key),
        clear: () => {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('session_')) {
              localStorage.removeItem(key);
            }
          });
        },
        key: (index) => {
          const sessionKeys = Object.keys(localStorage).filter(k => k.startsWith('session_'));
          return sessionKeys[index] ? sessionKeys[index].replace('session_', '') : null;
        },
        get length() {
          return Object.keys(localStorage).filter(k => k.startsWith('session_')).length;
        }
      };

      Object.defineProperty(window, 'sessionStorage', {
        value: mockSessionStorage,
        configurable: true,
        enumerable: true,
        writable: true
      });
      console.log('sessionStorage successfully polyfilled with localStorage for WebView');
    } catch (e) {
      console.error('Failed to polyfill sessionStorage:', e);
    }
  }
}
