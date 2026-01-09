import { useState, useEffect, useRef } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { AnimatedTitle } from './components/AnimatedTitle';
import { Plus, Undo2, Loader2, HardDrive, Trash2, BookOpen, X, ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { db, storage, firebaseConfig } from './firebase/config';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { ProfileScreen } from './components/ProfileScreen';
import { Notification } from './components/Notification';
import useDrivePicker from 'react-google-drive-picker';
import { localFileStorage } from './utils/localFileStorage';
import { useDocuments } from './hooks/useDocuments';

const GOOGLE_CLIENT_ID = "741889878750-da4cbkfe3q9gjh2figu71gbt4e9vap5e.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyDQHr01GZaojE3wdoGzejocuFM-cXQGwTU";

function AppContent() {
  const [showIntro, setShowIntro] = useState(true);
  const { currentUser, accessToken, loginWithGoogle } = useAuth();
  const [openPicker] = useDrivePicker();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [returnPage, setReturnPage] = useState(null);
  const [annotations, setAnnotations] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('annotations');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, doc: null });
  const { documents: recentDocuments, loading: loadingDocuments, deleteDocument } = useDocuments();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Load user annotations from Firestore if logged in
    const loadUserAnnotations = async () => {
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.annotations) {
            setAnnotations(prev => ({ ...prev, ...data.annotations }));
          }
        }
      }
    };
    loadUserAnnotations();
  }, [currentUser]);

  useEffect(() => {
    // Intro duration: wait for initial animation + a bit more before moving
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 1500); // Reduced time for faster transition
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('annotations', JSON.stringify(annotations));
    // Save to Firestore if logged in
    if (currentUser) {
      const saveToFirestore = async () => {
        try {
          await setDoc(doc(db, "users", currentUser.uid), {
            annotations: annotations
          }, { merge: true });
        } catch (e) {
          console.error("Error saving annotations to cloud", e);
        }
      };
      saveToFirestore();
    }
  }, [annotations, currentUser]);

  const addAnnotation = (text, page, geometry = null) => {
    if (!pdfFile) return;
    const fileName = pdfFile.name;
    setAnnotations(prev => {
      const fileNotes = prev[fileName] || [];
      return {
        ...prev,
        [fileName]: [...fileNotes, { 
          id: Date.now(), 
          text, 
          page, 
          date: new Date().toISOString(),
          geometry // { x, y, w, h, type: 'rect'|'circle' }
        }]
      };
    });
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleAnnotationClick = (targetPage) => {
    if (targetPage === currentPage) return;
    setReturnPage(currentPage);
    setCurrentPage(targetPage);
    setIsMenuOpen(false);
  };

  const handleReturn = () => {
    if (returnPage) {
      setCurrentPage(returnPage);
      setReturnPage(null);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isUploading) {
        e.preventDefault();
        // Standard way to trigger prompt in modern browsers
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

    if (file && file.type === 'application/pdf') {
      if (file.size > MAX_FILE_SIZE) {
        setNotification('El archivo es demasiado grande. El límite es de 50MB por documento para optimizar el almacenamiento.');
        return;
      }

      // Optimistic UI: Show file IMMEDIATELY
      setPdfFile(file);
      
      // Save locally to IndexedDB for offline access
      localFileStorage.saveFile(file, 'local');

      if (currentUser) {
        // Upload in background - don't block UI
        setIsUploading(true);
        setNotification("Sincronizando con la nube (0%)...");
        
        const storageRef = ref(storage, `users/${currentUser.uid}/documents/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
          (snapshot) => {
             const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
             setUploadProgress(progress);
             if (progress % 10 === 0 || progress === 100) {
                setNotification(`Sincronizando con la nube (${Math.round(progress)}%)...`);
             }
          },
          (error) => {
            console.error("Error uploading file:", error);
            // Silent fail for UX - user is already reading
            setNotification("Modo lectura local (error de sincronización)");
            setIsUploading(false);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              // Save metadata to Firestore
              const q = query(collection(db, `users/${currentUser.uid}/documents`), where("name", "==", file.name));
              const querySnapshot = await getDocs(q);
              
              if (querySnapshot.empty) {
                await addDoc(collection(db, `users/${currentUser.uid}/documents`), {
                  name: file.name,
                  url: downloadURL,
                  createdAt: serverTimestamp(),
                  size: file.size
                });
              }
              setNotification("Documento sincronizado correctamente");
              
              // Update URL to remote one silently
              setPdfFile({ name: file.name, url: downloadURL });
            } catch (error) {
              console.error("Error finishing upload:", error);
              setNotification("Error al finalizar sincronización");
            } finally {
              setIsUploading(false);
            }
          }
        );
      }
    } else {
      setNotification('Por favor selecciona un archivo PDF válido.');
    }
  };

  const handleCloudDocumentSelect = async (docData) => {
    setIsMenuOpen(false);
    
    // Update lastOpened in Firestore if logged in
    if (currentUser && docData.id) {
        try {
            await setDoc(doc(db, `users/${currentUser.uid}/documents`, docData.id), {
                lastOpened: serverTimestamp()
            }, { merge: true });
        } catch (e) { 
            console.error("Error updating lastOpened", e); 
        }
    }

    // 1. Try to load from local IndexedDB first (Fastest & works offline)
    const localFile = await localFileStorage.getFile(docData.name);
    if (localFile) {
        console.log("Loaded file from local cache");
        setPdfFile(localFile);
        return;
    }

    // 2. If not found locally, download from source
    // If it's a Drive document, fetch it using the stored ID
    if (docData.source === 'drive' && docData.driveId) {
       let token = accessToken || localStorage.getItem('googleAccessToken');
       if (!token && currentUser) {
         try {
           await loginWithGoogle();
           token = localStorage.getItem('googleAccessToken');
         } catch (e) {
           console.error(e);
         }
       }

       if (token) {
         await downloadFileFromDrive(docData.driveId, docData.name, token, false); // false = don't save again
       } else {
         setNotification("Por favor inicia sesión de nuevo para abrir este archivo de Drive.");
       }
    } else {
       if (docData.url) {
         setPdfFile({ name: docData.name, url: docData.url });
         return;
       }

       if (currentUser) {
         try {
           const q = query(collection(db, `users/${currentUser.uid}/documents`), where("name", "==", docData.name));
           const snapshot = await getDocs(q);
           if (!snapshot.empty) {
             const resolved = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
             if (resolved.url || (resolved.source === 'drive' && resolved.driveId)) {
               await handleCloudDocumentSelect(resolved);
               return;
             }
           }
         } catch (error) {
           console.error(error);
         }
       }

       setNotification("Este documento no está sincronizado en la nube.");
    }
  };

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const handleOpenDrive = async () => {
    if (!currentUser) {
      setNotification("Por favor inicia sesión para acceder a tu Google Drive.");
      setIsMenuOpen(true);
      return;
    }
    
    let token = accessToken;
    
    // If no access token (e.g. after refresh), try to get one silently/interactively
    if (!token) {
       try {
         // This will trigger the popup flow again to get a fresh token
         await loginWithGoogle();
         token = localStorage.getItem('googleAccessToken');
       } catch (e) {
         console.error("Error refreshing token:", e);
         setNotification("No se pudo conectar con Drive. Intenta iniciar sesión nuevamente.");
         return;
       }
    }

    if (!token) {
       setNotification("No se pudo verificar la sesión de Drive.");
       return;
    }

    openPicker({
      clientId: GOOGLE_CLIENT_ID,
      developerKey: GOOGLE_API_KEY,
      viewId: "DOCS",
      token: token,
      showUploadView: false,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
      mimeTypes: "application/pdf",
      callbackFunction: (data) => {
        if (data.action === 'picked') {
          const fileId = data.docs[0].id;
          const fileName = data.docs[0].name;
          downloadFileFromDrive(fileId, fileName, token, true); // true = save to library
        }
      },
    });
  };

  const downloadFileFromDrive = async (fileId, fileName, token, shouldSaveToLibrary = true) => {
      // Show non-blocking notification
      setNotification("Descargando documento de Drive...");
      
      try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
            let errorMessage = `Error ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || await response.text();
            } catch (e) {
                errorMessage = await response.text();
            }
            throw new Error(errorMessage);
        }
        
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'application/pdf' });
        
        // Show file immediately
        setPdfFile(file);
        
        // Save to local IndexedDB
        await localFileStorage.saveFile(file, 'drive', fileId);

        // If it's a new import (shouldSaveToLibrary is true), save metadata to Firestore instantly
        // No need to upload the file to Storage anymore
        if (currentUser && shouldSaveToLibrary) {
            try {
                const q = query(collection(db, `users/${currentUser.uid}/documents`), where("driveId", "==", fileId));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    await addDoc(collection(db, `users/${currentUser.uid}/documents`), {
                        name: fileName,
                        driveId: fileId,
                        source: 'drive',
                        createdAt: serverTimestamp(),
                        size: file.size,
                        // No 'url' field needed for Drive files
                    });
                    console.log("Drive document saved to library");
                    setNotification("Documento guardado en tu biblioteca");
                }
            } catch (err) {
                console.error("Error saving Drive metadata:", err);
            }
        } else {
            setNotification(null); // Clear "Downloading..." message
        }

      } catch (error) {
        console.error("Error downloading from Drive:", error);
        setNotification(`Error al descargar: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
  };

  const handleHomeClick = () => {
    setPdfFile(null);
    setCurrentPage(1);
    setReturnPage(null);
    setIsMenuOpen(false);
  };

  const handleDeleteRequest = (doc, e) => {
    e.stopPropagation();
    setDeleteConfirmation({ isOpen: true, doc });
  };

  const confirmDelete = async () => {
    try {
      if (deleteConfirmation.doc) {
        const success = await deleteDocument(deleteConfirmation.doc);
        if (success) {
          setNotification({ type: 'success', text: 'Documento eliminado correctamente' });
        } else {
          setNotification({ type: 'error', text: 'Error al eliminar el documento' });
        }
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', text: 'Error al eliminar el documento' });
    } finally {
      setDeleteConfirmation({ isOpen: false, doc: null });
    }
  };

  return (
    <LayoutGroup>
      <Notification 
        message={notification} 
        onClose={() => setNotification(null)} 
      />
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border border-foreground/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-medium">¿Eliminar lectura?</h3>
                <p className="text-sm opacity-60">
                  ¿Estás seguro que deseas eliminar "{deleteConfirmation.doc?.name}" de tus lecturas recientes? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3 w-full mt-4">
                  <button
                    onClick={() => setDeleteConfirmation({ isOpen: false, doc: null })}
                    className="flex-1 py-3 px-4 rounded-xl border border-foreground/10 hover:bg-foreground/5 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium shadow-lg shadow-red-500/20"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-background text-foreground transition-colors duration-300 overflow-hidden relative flex flex-col">
        {/* Intro Overlay - Background and Title separated for Morph effect */}
        <AnimatePresence>
          {showIntro && (
            <motion.div 
              key="intro-overlay"
              className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
            >
               {/* Background Layer - Fades out */}
               <motion.div 
                 className="absolute inset-0 bg-background"
                 initial={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 transition={{ duration: 0.8, ease: "easeInOut" }}
               />
               
               {/* Title Layer - Does NOT fade out, allowing layoutId to morph to Header */}
               <div className="relative z-10">
                 <AnimatedTitle size="large" />
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header - Always mounted, controls Small Title visibility */}
        <Header 
          onMenuOpen={() => setIsMenuOpen(true)} 
          showTitle={!showIntro} 
          onHomeClick={handleHomeClick}
        />

        {/* Main Interface Content - Fades in */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: showIntro ? 0 : 1 }}
          transition={{ duration: 0.8, delay: 0.1 }} // Faster fade in
          className="flex-1 flex flex-col relative"
        >
             <Sidebar 
               isOpen={isMenuOpen} 
               onClose={() => setIsMenuOpen(false)}
               theme={theme}
               toggleTheme={toggleTheme}
               annotations={annotations}
               currentFileName={pdfFile?.name}
               onOpenProfile={() => {
                 setIsMenuOpen(false);
                 setShowProfile(true);
               }}
               onAnnotationClick={handleAnnotationClick}
               onCloudDocumentSelect={handleCloudDocumentSelect}
               documents={recentDocuments}
               loadingDocs={loadingDocuments}
             />

             <ProfileScreen 
               isOpen={showProfile} 
               onClose={() => setShowProfile(false)} 
               annotations={annotations}
               documents={recentDocuments}
               onDocumentSelect={handleCloudDocumentSelect}
             />

             <main className="relative flex-1 flex flex-col pt-16">
               {!pdfFile ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-4">
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: !showIntro ? 1 : 0, y: !showIntro ? 0 : 20 }}
                     transition={{ delay: 0.5, duration: 0.8 }}
                     className="text-center space-y-8 max-w-md w-full flex flex-col items-center justify-center"
                   >
                     <h2 className="text-4xl font-light">Bienvenido a Leé.Io</h2>
                     <p className="text-lg opacity-70 max-w-sm">
                       Tu espacio minimalista para leer y anotar documentos PDF.
                     </p>
                     
                     <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center w-full">
                      <button
                        onClick={handleAddClick}
                        className="group flex items-center justify-center space-x-3 bg-foreground text-background px-10 py-4 rounded-full text-xl font-medium hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto min-w-[200px]"
                      >
                        <Plus className="group-hover:rotate-90 transition-transform duration-300" />
                        <span>Agregar</span>
                      </button>

                      <button
                        onClick={handleOpenDrive}
                        className="group flex items-center justify-center space-x-3 bg-background border-2 border-foreground text-foreground px-10 py-4 rounded-full text-xl font-medium hover:bg-foreground/5 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto min-w-[200px]"
                      >
                        <HardDrive className="group-hover:scale-110 transition-transform duration-300" />
                        <span>Drive</span>
                      </button>
                    </div>

                    {/* Recent Readings Section */}
                    {!loadingDocuments && recentDocuments.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-16 w-full max-w-4xl mx-auto px-4"
                      >
                        <h3 className="text-xl font-medium mb-6 flex items-center gap-2 opacity-80">
                          <BookOpen size={20} />
                          Mis Lecturas Recientes
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {recentDocuments.slice(0, 3).map((doc, index) => (
                            <div key={index} className="relative group">
                                <button
                                  onClick={() => handleCloudDocumentSelect(doc)}
                                  className="flex flex-col items-start p-6 bg-foreground/5 hover:bg-foreground/10 rounded-2xl transition-all hover:scale-[1.02] text-left w-full border border-foreground/5 hover:border-foreground/20"
                                >
                                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center mb-4 shadow-sm group-hover:shadow-md transition-shadow">
                                    <span className="text-lg font-serif italic font-bold text-foreground/80">
                                      {doc.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <h4 className="font-medium text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                                    {doc.name.replace('.pdf', '')}
                                  </h4>
                                  <p className="text-xs opacity-50 mt-auto">
                                    {doc.createdAt?.seconds 
                                      ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString()
                                      : new Date(doc.lastModified || Date.now()).toLocaleDateString()
                                    }
                                  </p>
                                </button>
                                <button
                                    onClick={(e) => handleDeleteRequest(doc, e)}
                                    className="absolute top-2 right-2 p-2 rounded-full bg-background/80 hover:bg-red-50 text-foreground/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                                    title="Eliminar lectura"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                   </motion.div>
                 </div>
               ) : (
                 <div className="relative flex-1">
                    {isMobile && (
                      <button
                        onClick={handleHomeClick}
                        className="fixed top-4 left-4 z-50 p-3 bg-background/80 backdrop-blur-md border border-foreground/10 text-foreground rounded-full shadow-lg hover:bg-background transition-all"
                      >
                        <ArrowLeft size={20} />
                      </button>
                    )}
                    <PDFViewer 
                   file={pdfFile}  
                   isMobile={isMobile}
                   onAddAnnotation={addAnnotation} 
                  annotations={annotations[pdfFile.name] || []}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
                    
                    {/* Return to previous page button */}
                    <AnimatePresence>
                      {returnPage && (
                        <motion.button
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          onClick={handleReturn}
                          className="fixed bottom-8 left-8 px-6 py-3 bg-foreground text-background rounded-full shadow-lg hover:opacity-90 transition-all z-30 flex items-center gap-2 font-medium"
                        >
                          <Undo2 size={20} />
                          <span>Volver a pág. {returnPage}</span>
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Floating Action Button for adding another file */}
                    <button
                       onClick={handleAddClick}
                       className="fixed bottom-8 right-8 p-4 bg-foreground text-background rounded-full shadow-lg hover:opacity-90 transition-all z-30"
                       title="Abrir otro PDF"
                     >
                       <Plus size={24} />
                     </button>
                 </div>
               )}

               {/* Hidden File Input */}
               <input
                 type="file"
                 accept=".pdf"
                 ref={fileInputRef}
                 onChange={handleFileChange}
                 className="hidden"
               />
             </main>
        </motion.div>
      </div>
    </LayoutGroup>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
