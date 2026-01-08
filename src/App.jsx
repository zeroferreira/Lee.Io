import { useState, useEffect, useRef } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { AnimatedTitle } from './components/AnimatedTitle';
import { Plus, Undo2, Loader2, HardDrive } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { db, storage, firebaseConfig } from './firebase/config';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { ProfileScreen } from './components/ProfileScreen';
import { Notification } from './components/Notification';
import useDrivePicker from 'react-google-drive-picker';

const GOOGLE_CLIENT_ID = "900762317960-g972j1tn884t9pgbl9e6f3dhd857ef0k.apps.googleusercontent.com";

function AppContent() {
  const [showIntro, setShowIntro] = useState(true);
  const { currentUser, accessToken } = useAuth();
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

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

    if (file && file.type === 'application/pdf') {
      if (file.size > MAX_FILE_SIZE) {
        setNotification('El archivo es demasiado grande. El límite es de 50MB por documento para optimizar el almacenamiento.');
        return;
      }

      if (currentUser) {
        setIsUploading(true);
        setUploadProgress(0);
        
        // Timeout check for 0% progress (likely CORS issue)
        const progressCheck = setTimeout(() => {
          setUploadProgress(current => {
            if (current === 0) {
              uploadTask.cancel();
              // Silent fallback to local for better UX while configuring cloud
              console.warn("Upload timed out (CORS/Network). Falling back to local file.");
              setIsUploading(false);
              setPdfFile(file); 
              return 0;
            }
            return current;
          });
        }, 2000); // Reduced to 2 seconds for instant feedback

        const storageRef = ref(storage, `users/${currentUser.uid}/documents/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            if (progress > 0) clearTimeout(progressCheck);
          },
          (error) => {
            clearTimeout(progressCheck);
            
            // Ignore intentional cancellations (fallback mechanism)
            if (error.code === 'storage/canceled') {
              console.log("Upload canceled intentionally for local fallback");
              return;
            }

            console.error("Error uploading file:", error);
            let errorMessage = "Error al subir el archivo.";
            if (error.code === 'storage/unauthorized') {
              errorMessage = "No tienes permisos para subir archivos. Verifica que has iniciado sesión.";
            } else if (error.code === 'storage/unknown') {
              errorMessage = "Ocurrió un error desconocido. Intenta de nuevo.";
            }
            
            // Only alert for real errors, not cancellations
            alert(`${errorMessage} (${error.message})`);
            
            setIsUploading(false);
            setPdfFile(file); // Fallback local
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
              } else {
                 // Optional: update timestamp or size if changed
              }

              setPdfFile({ name: file.name, url: downloadURL });
            } catch (error) {
              console.error("Error finishing upload:", error);
              setPdfFile(file); // Fallback
            } finally {
              setIsUploading(false);
            }
          }
        );
      } else {
        setPdfFile(file);
      }
    } else {
      setNotification('Por favor selecciona un archivo PDF válido.');
    }
  };

  const handleCloudDocumentSelect = (docData) => {
    setPdfFile({ name: docData.name, url: docData.url });
    setIsMenuOpen(false);
  };

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const handleOpenDrive = () => {
    if (!currentUser) {
      setNotification("Por favor inicia sesión para acceder a tu Google Drive.");
      setIsMenuOpen(true);
      return;
    }
    
    if (!accessToken) {
       setNotification("Necesitamos renovar tu sesión para acceder a Drive. Por favor cierra sesión y vuelve a entrar.");
       return;
    }

    openPicker({
      clientId: GOOGLE_CLIENT_ID,
      developerKey: firebaseConfig.apiKey,
      viewId: "DOCS",
      token: accessToken,
      showUploadView: false,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
      mimeTypes: "application/pdf",
      callbackFunction: (data) => {
        if (data.action === 'picked') {
          const fileId = data.docs[0].id;
          const fileName = data.docs[0].name;
          downloadFileFromDrive(fileId, fileName, accessToken);
        }
      },
    });
  };

  const downloadFileFromDrive = async (fileId, fileName, token) => {
      setIsUploading(true);
      try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to download');
        
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'application/pdf' });
        
        setPdfFile(file);
      } catch (error) {
        console.error("Error downloading from Drive:", error);
        setNotification("Error al cargar el archivo desde Drive.");
      } finally {
        setIsUploading(false);
      }
  };

  return (
    <LayoutGroup>
      <Notification 
        message={notification} 
        onClose={() => setNotification(null)} 
      />
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
        <Header onMenuOpen={() => setIsMenuOpen(true)} showTitle={!showIntro} />

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
             />

             <ProfileScreen 
               isOpen={showProfile} 
               onClose={() => setShowProfile(false)} 
               annotations={annotations}
             />

             {isUploading && (
               <div className="absolute inset-0 z-[150] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                 <div className="flex flex-col items-center gap-4 w-64">
                   <Loader2 className="animate-spin h-10 w-10 text-foreground" />
                   <p className="text-lg font-medium">Subiendo documento...</p>
                   <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
                     <motion.div 
                        className="h-full bg-foreground"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                     />
                   </div>
                   <p className="text-sm opacity-60">{Math.round(uploadProgress)}%</p>
                 </div>
               </div>
             )}

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
                   </motion.div>
                 </div>
               ) : (
                 <div className="relative flex-1">
                    <PDFViewer 
                  file={pdfFile} 
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
