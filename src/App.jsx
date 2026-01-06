import { useState, useEffect, useRef } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { AnimatedTitle } from './components/AnimatedTitle';
import { Plus, Undo2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { db } from './firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ProfileScreen } from './components/ProfileScreen';

function AppContent() {
  const [showIntro, setShowIntro] = useState(true);
  const { currentUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
    }, 4500); // Even longer to allow full fall animation + pause
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
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      alert('Por favor selecciona un archivo PDF válido.');
    }
  };

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <LayoutGroup>
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
          transition={{ duration: 1, delay: 0.2 }} // Faster fade in
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
             />

             <ProfileScreen 
               isOpen={showProfile} 
               onClose={() => setShowProfile(false)} 
               annotations={annotations}
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
                     
                     <div className="pt-4">
                       <button
                         onClick={handleAddClick}
                         className="group flex items-center justify-center space-x-3 bg-foreground text-background px-10 py-4 rounded-full text-xl font-medium hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto min-w-[200px]"
                       >
                         <Plus className="group-hover:rotate-90 transition-transform duration-300" />
                         <span>Agregar</span>
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
