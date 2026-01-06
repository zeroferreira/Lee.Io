import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Cloud, Smartphone, User, Shield, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ProfileScreen = ({ isOpen, onClose, annotations = {} }) => {
  const { currentUser, loginWithGoogle, logout } = useAuth();
  const [error, setError] = React.useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Calculate stats
  const totalBooks = Object.keys(annotations).length;
  const totalNotes = Object.values(annotations).reduce((acc, notes) => acc + notes.length, 0);

  // Format member since date
  const memberSince = currentUser?.metadata?.creationTime 
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : '';

  const handleLogin = async () => {
    try {
      setError(null);
      await loginWithGoogle();
      // Don't close immediately so they can see success state
    } catch (error) {
      console.error("Login error full object:", error);
      let errorMessage = "No se pudo iniciar sesión.";
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "El inicio de sesión fue cancelado.";
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = "Error de configuración: Este dominio (localhost) no está autorizado en Firebase Console.";
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = "Error: El inicio de sesión con Google no está habilitado en Firebase Console.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Se abrió otra ventana de inicio de sesión.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setError(errorMessage);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-background overflow-y-auto"
        >
          <div className="min-h-full flex flex-col items-center justify-center p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-8 right-8 p-3 rounded-full hover:bg-foreground/5 transition-colors z-10"
            >
              <X size={32} />
            </button>

            <div className="max-w-md w-full text-center space-y-12 my-8">
              {error && (
              <div className="p-4 bg-red-50 text-red-500 rounded-lg text-sm">
                {error}
              </div>
            )}
            {currentUser ? (
            // Logged In View
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col items-center gap-4">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName} 
                    className="w-24 h-24 rounded-full border-2 border-foreground/10"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-foreground/5 flex items-center justify-center">
                    <User size={40} />
                  </div>
                )}
                <h2 className="text-3xl font-light">{currentUser.displayName || 'Usuario'}</h2>
                <p className="text-foreground/60">{currentUser.email}</p>
                {memberSince && (
                  <p className="text-xs text-foreground/40 mt-1">Miembro desde {memberSince}</p>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-foreground/5 p-4 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl font-light">{totalBooks}</span>
                  <span className="text-xs text-foreground/50 uppercase tracking-wider">Lecturas</span>
                </div>
                <div className="bg-foreground/5 p-4 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl font-light">{totalNotes}</span>
                  <span className="text-xs text-foreground/50 uppercase tracking-wider">Notas</span>
                </div>
              </div>

              <div className="bg-foreground/5 rounded-2xl p-6 space-y-4 text-left">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 rounded-full text-green-600">
                    <Cloud size={24} />
                  </div>
                  <div>
                    <h3 className="font-medium">Sincronización Activa</h3>
                    <p className="text-sm text-foreground/60">Tus notas están seguras en la nube.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-4 rounded-full border border-red-200 text-red-500 font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={20} />
                Cerrar Sesión
              </button>
            </motion.div>
          ) : (
            // Logged Out View (Login Page)
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-10"
            >
              <div className="space-y-4">
                <h2 className="text-4xl font-light">Bienvenido a Leé.Io</h2>
                <p className="text-xl text-foreground/60 font-light">
                  Tu espacio de lectura minimalista, ahora en todas partes.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 py-8">
                <div className="flex flex-col items-center gap-3 p-4">
                  <Cloud size={40} className="stroke-1" />
                  <h3 className="text-lg font-medium">Sincronización Cloud</h3>
                  <p className="text-sm text-foreground/60 max-w-xs">
                    Tus anotaciones se guardan automáticamente y están disponibles en todos tus dispositivos.
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogin}
                className="w-full bg-foreground text-background py-4 rounded-full text-xl font-medium hover:opacity-90 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 shadow-xl"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar con Google
              </button>

              <div className="pt-6 border-t border-foreground/10">
                <button 
                  onClick={() => setShowPrivacy(!showPrivacy)}
                  className="flex items-center justify-center gap-2 text-sm text-foreground/50 hover:text-foreground/80 transition-colors w-full"
                >
                  <Shield size={16} />
                  <span>¿Es seguro iniciar sesión?</span>
                  {showPrivacy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                <AnimatePresence>
                  {showPrivacy && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 text-left space-y-3 text-sm text-foreground/70 bg-foreground/5 p-4 rounded-xl mt-3">
                        <div className="flex gap-3">
                          <Check size={18} className="text-green-500 shrink-0" />
                          <p><span className="font-medium text-foreground">Sin contraseñas:</span> Nunca vemos ni guardamos tu contraseña.</p>
                        </div>
                        <div className="flex gap-3">
                          <Check size={18} className="text-green-500 shrink-0" />
                          <p><span className="font-medium text-foreground">Seguridad Google:</span> Protección de nivel bancario contra ataques.</p>
                        </div>
                        <div className="flex gap-3">
                          <Check size={18} className="text-green-500 shrink-0" />
                          <p><span className="font-medium text-foreground">Control total:</span> Puedes revocar el acceso cuando quieras.</p>
                        </div>
                        <p className="text-xs text-center pt-2 opacity-50">
                          Solo usamos tu nombre y correo para guardar tus notas.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
