import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, User, BookOpen, PenTool, Info, ArrowLeft, LogIn, LogOut, Github, Cloud, HardDrive, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { localFileStorage } from '../utils/localFileStorage';
const normalizeFilename = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, "") // remove all whitespace
    .replace(/\(\d+\)/g, "") // remove parenthesized copy numbers
    .replace(/[^a-z0-9]/g, ""); // remove special characters
};

const findAnnotationsForFile = (annotationsMap, fileName) => {
  if (!fileName || !annotationsMap) return [];
  if (annotationsMap[fileName]) return annotationsMap[fileName];
  const normTarget = normalizeFilename(fileName);
  const matchedKey = Object.keys(annotationsMap).find(
    key => normalizeFilename(key) === normTarget
  );
  return matchedKey ? annotationsMap[matchedKey] : [];
};

export const Sidebar = ({ isOpen, onClose, theme, toggleTheme, annotations = {}, currentFileName, onOpenProfile, onAnnotationClick, onCloudDocumentSelect, onOpenDocumentFromDriveByName, documents = [], loadingDocs = false }) => {
  const [view, setView] = useState('menu'); // 'menu' | 'annotations'
  const { currentUser, loginWithGoogle, logout } = useAuth();
  const [selectedFileForAnns, setSelectedFileForAnns] = useState(null);

  useEffect(() => {
    if (currentFileName) {
      setSelectedFileForAnns(currentFileName);
    } else {
      setSelectedFileForAnns(null);
    }
  }, [currentFileName, view]);
  // Internal state removed as we now use props for documents
  // But we need to handle if props are not passed (backward compatibility or if sidebar used elsewhere)
  // For now, let's assume props are passed from App.jsx or default to empty.
  
  // We keep the prop names consistent with what useDocuments returns
  
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
    { icon: <Info size={20} />, label: 'Instrucciones', action: () => setView('instructions') },
  ];


  const currentAnnotations = findAnnotationsForFile(annotations, currentFileName);
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
                    {theme === 'light' && (
                      <>
                        <Moon size={20} />
                        <span>Modo Noche</span>
                      </>
                    )}
                    {theme === 'dark' && (
                      <>
                        <Sparkles size={20} className="text-purple-400" />
                        <span>Modo Vision</span>
                      </>
                    )}
                    {theme === 'vision' && (
                      <>
                        <Sun size={20} />
                        <span>Modo Día</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : view === 'readings' ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                 <h3 className="text-sm font-semibold text-foreground/50 uppercase tracking-wider mb-4">
                   Mis Lecturas
                 </h3>
                 {loadingDocs ? (
                    <div className="flex justify-center p-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                    </div>
                 ) : documents.length === 0 ? (
                    <p className="text-sm opacity-60 italic text-center py-8">No hay documentos guardados</p>
                 ) : (
                   <div className="space-y-2">
                     {documents.map((doc, i) => (
                       <button
                         key={i}
                         onClick={() => onCloudDocumentSelect(doc)}
                         className="w-full flex items-center p-3 rounded-lg hover:bg-foreground/5 transition-colors text-left group"
                       >
                          <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center mr-3 text-xs font-bold shrink-0">
                             {doc.source === 'drive' ? <HardDrive size={14}/> : 'PDF'}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium truncate">{doc.name}</p>
                             <p className="text-xs opacity-50">
                                {doc.createdAt?.seconds 
                                  ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() 
                                  : new Date(doc.lastModified || Date.now()).toLocaleDateString()
                                }
                                {doc.size && ` • ${(doc.size / 1024 / 1024).toFixed(1)} MB`}
                             </p>
                          </div>
                       </button>
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
              <div className="flex-1 flex flex-col min-h-0">
                {selectedFileForAnns ? (
                  // Show annotations for a specific file
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-4">
                      <button 
                        onClick={() => setSelectedFileForAnns(null)} 
                        className="p-1 hover:bg-foreground/5 rounded-full shrink-0"
                        title="Ver todos los documentos"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <h3 className="font-semibold text-base truncate flex-1" title={selectedFileForAnns}>
                        {selectedFileForAnns.replace('.pdf', '')}
                      </h3>
                    </div>

                    {/* Check if this file is in our documents library to offer an "Open" button */}
                    {(() => {
                      const matchedDoc = documents.find(d => normalizeFilename(d.name) === normalizeFilename(selectedFileForAnns));
                      if (matchedDoc && selectedFileForAnns !== currentFileName) {
                        return (
                          <button
                            onClick={() => {
                              onCloudDocumentSelect(matchedDoc);
                              onClose();
                            }}
                            className="mb-4 w-full flex items-center justify-center gap-2 py-2 px-3 bg-foreground text-background rounded-xl text-xs font-medium hover:opacity-90 transition-all shadow-sm"
                          >
                            <BookOpen size={14} />
                            <span>Abrir este documento</span>
                          </button>
                        );
                      } else if (!matchedDoc && onOpenDocumentFromDriveByName && selectedFileForAnns !== currentFileName) {
                        return (
                          <button
                            onClick={() => {
                              onOpenDocumentFromDriveByName(selectedFileForAnns);
                              onClose();
                            }}
                            className="mb-4 w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-all shadow-sm"
                          >
                            <HardDrive size={14} />
                            <span>Descargar de Drive</span>
                          </button>
                        );
                      }
                      return null;
                    })()}

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {(() => {
                        const notes = findAnnotationsForFile(annotations, selectedFileForAnns);
                        if (notes.length === 0) {
                          return <p className="text-sm opacity-50 italic">No hay anotaciones para este documento.</p>;
                        }
                        return notes.map(note => (
                          <div 
                            key={note.id} 
                            onClick={() => {
                              // If this is the current file, jump to page
                              if (selectedFileForAnns === currentFileName && onAnnotationClick) {
                                onAnnotationClick(note.page);
                              }
                            }}
                            className={`p-3 bg-foreground/5 rounded-xl text-sm transition-all ${
                              selectedFileForAnns === currentFileName 
                                ? 'cursor-pointer hover:bg-foreground/10 hover:border-foreground/10 border border-transparent' 
                                : 'border border-foreground/5'
                            }`}
                          >
                            <div className="flex justify-between mb-1.5 opacity-60 text-[10px] font-medium">
                              <span>Página {note.page}</span>
                              <span>{new Date(note.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-foreground/90 leading-relaxed font-sans">{note.text}</p>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : (
                  // Show list of all annotated files
                  <div className="flex-1 flex flex-col min-h-0">
                    <h3 className="text-xl font-bold mb-4">Anotaciones</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {Object.keys(annotations).filter(key => annotations[key] && annotations[key].length > 0).length === 0 ? (
                        <div className="text-center py-12 px-4 space-y-2">
                          <p className="text-sm opacity-50 italic">No tienes anotaciones guardadas aún.</p>
                          <p className="text-xs opacity-40">Las anotaciones que realices en tus PDFs aparecerán aquí.</p>
                        </div>
                      ) : (
                        Object.entries(annotations)
                          .filter(([_, notes]) => notes && notes.length > 0)
                          .map(([fileName, notes]) => {
                            const isCurrent = fileName === currentFileName;
                            return (
                              <button
                                key={fileName}
                                onClick={() => setSelectedFileForAnns(fileName)}
                                className={`w-full p-4 rounded-2xl border text-left transition-all hover:scale-[1.01] flex flex-col gap-2 ${
                                  isCurrent 
                                    ? 'bg-foreground/5 border-foreground/20 shadow-sm' 
                                    : 'bg-background hover:bg-foreground/5 border-foreground/10'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2 w-full">
                                  <span className="font-semibold text-sm truncate flex-1 text-foreground/90">
                                    {fileName.replace('.pdf', '')}
                                  </span>
                                  <span className="text-[10px] bg-foreground/10 px-2 py-0.5 rounded-full font-medium text-foreground/70 shrink-0">
                                    {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
                                  </span>
                                </div>
                                <p className="text-xs opacity-60 line-clamp-1 italic">
                                  "{notes[notes.length - 1].text}"
                                </p>
                              </button>
                            );
                          })
                      )}
                    </div>
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
