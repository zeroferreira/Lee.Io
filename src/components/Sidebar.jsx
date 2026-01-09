import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, User, BookOpen, PenTool, Info, ArrowLeft, LogIn, LogOut, Github, Cloud, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { localFileStorage } from '../utils/localFileStorage';

export const Sidebar = ({ isOpen, onClose, theme, toggleTheme, annotations = {}, currentFileName, onOpenProfile, onAnnotationClick, onCloudDocumentSelect }) => {
  const [view, setView] = useState('menu'); // 'menu' | 'annotations'
  const { currentUser, loginWithGoogle, logout } = useAuth();
  const [cloudDocuments, setCloudDocuments] = useState([]);
  const [localDocuments, setLocalDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (view === 'readings') {
       // Load Local Documents (IndexedDB)
       localFileStorage.getFiles().then(files => {
          setLocalDocuments(files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified)));
       });

       if (currentUser) {
          setLoadingDocs(true);
          const q = query(collection(db, `users/${currentUser.uid}/documents`), orderBy("createdAt", "desc"));
          
          const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCloudDocuments(docs);
            setLoadingDocs(false);
          }, (error) => {
            console.error("Error fetching documents:", error);
            setLoadingDocs(false);
          });

          return () => unsubscribe();
       }
    }
  }, [view, currentUser]);

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

  // Combine lists, preferring Cloud if duplicates exist (by name)
  const combinedDocuments = [...cloudDocuments];
  localDocuments.forEach(localDoc => {
    if (!combinedDocuments.find(cd => cd.name === localDoc.name)) {
      combinedDocuments.push(localDoc);
    }
  });

  // Sort combined list by date (newest first)
  // Cloud docs have createdAt (Timestamp), Local have lastModified (ISO string)
  combinedDocuments.sort((a, b) => {
    const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.lastModified || 0);
    const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.lastModified || 0);
    return dateB - dateA;
  });

  const menuItems = [
    { icon: <User size={20} />, label: currentUser ? `Hola, ${currentUser.displayName}` : 'Mi perfil', action: onOpenProfile },
    { icon: <BookOpen size={20} />, label: 'Mis Lecturas', action: () => setView('readings') },
    { icon: <PenTool size={20} />, label: 'Mis anotaciones', action: () => setView('annotations') },
    { icon: <Info size={20} />, label: 'Instrucciones', action: () => setView('instructions') },
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
                
                {loadingDocs ? (
                    <div className="flex justify-center p-4">
                      <span className="opacity-50">Cargando...</span>
                    </div>
                ) : combinedDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 opacity-50 space-y-2">
                        <BookOpen size={40} />
                        <p className="text-sm text-center">No hay documentos guardados.</p>
                        {!currentUser && <p className="text-xs text-center text-blue-500">Inicia sesión para sincronizar.</p>}
                    </div>
                ) : (
                    <div className="space-y-4">
                      {combinedDocuments.map((doc, index) => (
                        <div 
                          key={doc.id || index} 
                          className="p-3 bg-foreground/5 rounded-lg cursor-pointer hover:bg-foreground/10 transition-colors"
                          onClick={() => onCloudDocumentSelect && onCloudDocumentSelect(doc)}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            {doc.source === 'drive' ? (
                                <Cloud size={16} className="opacity-70 text-blue-500" />
                            ) : doc.source === 'local' || !doc.createdAt ? (
                                <HardDrive size={16} className="opacity-70 text-green-500" />
                            ) : (
                                <Cloud size={16} className="opacity-70" />
                            )}
                            <p className="font-medium text-sm truncate flex-1">{doc.name}</p>
                          </div>
                          <div className="flex justify-between items-center text-xs opacity-50">
                            <span>
                                {doc.createdAt?.seconds 
                                    ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() 
                                    : new Date(doc.lastModified || Date.now()).toLocaleDateString()}
                            </span>
                            <span>{doc.size ? (doc.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                )}
              </div>
            ) : view === 'instructions' ? (
              <div className="flex-1 overflow-y-auto space-y-6">
                <h3 className="text-xl font-bold mb-4">Instrucciones</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <BookOpen size={16} />
                      Cargar Documento
                    </h4>
                    <p className="text-sm opacity-70">
                      Arrastra un archivo PDF a la pantalla o haz clic en el botón "+" flotante para comenzar a leer.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <PenTool size={16} />
                      Herramientas
                    </h4>
                    <ul className="text-sm opacity-70 space-y-2 list-disc list-inside">
                      <li><span className="font-medium">Subrayar:</span> Selecciona el resaltador y arrastra sobre el texto o la página.</li>
                      <li><span className="font-medium">Notas:</span> Usa el icono de mensaje para agregar notas adhesivas (rectángulos o círculos).</li>
                      <li><span className="font-medium">Borrador:</span> Elimina anotaciones tocándolas con la herramienta activa.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <ArrowLeft size={16} />
                      Navegación
                    </h4>
                    <p className="text-sm opacity-70">
                      Usa las flechas, desliza en dispositivos táctiles o haz clic en tus anotaciones para saltar a páginas específicas.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <User size={16} />
                      Sincronización
                    </h4>
                    <p className="text-sm opacity-70">
                      Inicia sesión con Google para guardar tu progreso y acceder a tus documentos desde cualquier dispositivo.
                    </p>
                  </div>
                </div>
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
