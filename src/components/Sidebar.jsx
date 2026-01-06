import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, User, BookOpen, PenTool, Info, ArrowLeft, LogIn, LogOut, Github } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ isOpen, onClose, theme, toggleTheme, annotations = {}, currentFileName, onOpenProfile, onAnnotationClick }) => {
  const [view, setView] = useState('menu'); // 'menu' | 'annotations'
  const { currentUser, loginWithGoogle, logout } = useAuth();

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Error logging in", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  const menuItems = [
    { icon: <User size={20} />, label: currentUser ? `Hola, ${currentUser.displayName}` : 'Mi perfil', action: onOpenProfile },
    { icon: <BookOpen size={20} />, label: 'Mis Lecturas', action: () => setView('readings') },
    { icon: <PenTool size={20} />, label: 'Mis anotaciones', action: () => setView('annotations') },
    { icon: <Github size={20} />, label: 'Código en GitHub', action: () => window.open('https://github.com/zeroferreira/Lee.Io', '_blank') },
    { icon: <Info size={20} />, label: 'Instrucciones', action: () => {} },
  ];


  const currentAnnotations = currentFileName ? (annotations[currentFileName] || []) : [];
  const readingHistory = Object.keys(annotations);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween' }}
            className="fixed right-0 top-0 h-full w-80 bg-background border-l border-foreground/10 z-50 shadow-xl p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              {view !== 'menu' ? (
                <button onClick={() => setView('menu')} className="p-2 hover:bg-foreground/5 rounded-full">
                  <ArrowLeft size={24} />
                </button>
              ) : (
                 <div /> // Spacer
              )}
              <button onClick={onClose} className="p-2 hover:bg-foreground/5 rounded-full">
                <X size={24} />
              </button>
            </div>

            {view === 'menu' ? (
              <>
                <nav className="flex-1 space-y-4">
                  {menuItems.map((item, index) => (
                    <button
                      key={index}
                      onClick={item.action}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-foreground/5 rounded-lg transition-colors text-left"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-foreground/10 space-y-2">
                  {!currentUser ? (
                    <button
                      onClick={onOpenProfile}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-foreground/5 rounded-lg transition-colors text-left text-blue-500"
                    >
                      <LogIn size={20} />
                      <span>Iniciar Sesión</span>
                    </button>
                  ) : (
                    <button
                      onClick={onOpenProfile}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-foreground/5 rounded-lg transition-colors text-left text-foreground"
                    >
                      <User size={20} />
                      <span>Cuenta</span>
                    </button>
                  )}

                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-foreground/5 rounded-lg transition-colors text-left"
                  >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    <span>{theme === 'light' ? 'Modo Noche' : 'Modo Día'}</span>
                  </button>
                </div>
              </>
            ) : view === 'readings' ? (
              <div className="flex-1 overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">Mis Lecturas</h3>
                {readingHistory.length === 0 ? (
                  <p className="text-sm opacity-50">No hay lecturas guardadas.</p>
                ) : (
                  <div className="space-y-4">
                    {readingHistory.map((fileName, index) => (
                      <div key={index} className="p-3 bg-foreground/5 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <BookOpen size={16} className="opacity-70" />
                          <p className="font-medium text-sm truncate">{fileName}</p>
                        </div>
                        <p className="text-xs opacity-50">
                          {annotations[fileName]?.length || 0} anotaciones
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">Anotaciones</h3>
                {!currentFileName ? (
                    <p className="text-sm opacity-50">Abre un PDF para ver sus anotaciones.</p>
                ) : currentAnnotations.length === 0 ? (
                    <p className="text-sm opacity-50">No hay anotaciones para este documento.</p>
                ) : (
                    <div className="space-y-4">
                        {currentAnnotations.map(note => (
                            <div 
                              key={note.id} 
                              onClick={() => onAnnotationClick && onAnnotationClick(note.page)}
                              className="p-3 bg-foreground/5 rounded-lg text-sm cursor-pointer hover:bg-foreground/10 transition-colors"
                            >
                                <div className="flex justify-between mb-2 opacity-70 text-xs">
                                    <span>Página {note.page}</span>
                                    <span>{new Date(note.date).toLocaleDateString()}</span>
                                </div>
                                <p>{note.text}</p>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
