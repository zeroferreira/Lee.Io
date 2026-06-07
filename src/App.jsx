import { useState, useEffect, useRef } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { AnimatedTitle } from './components/AnimatedTitle';
import { Plus, Undo2, Loader2, HardDrive, Trash2, BookOpen, X, ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { db, storage, firebaseConfig } from './firebase/config';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { ProfileScreen } from './components/ProfileScreen';
import { Notification } from './components/Notification';
import useDrivePicker from 'react-google-drive-picker';
import { localFileStorage } from './utils/localFileStorage';
import { useDocuments } from './hooks/useDocuments';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "741889878750-da4cbkfe3q9gjh2figu71gbt4e9vap5e.apps.googleusercontent.com";
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "AIzaSyDQHr01GZaojE3wdoGzejocuFM-cXQGwTU";
const normalizeFilename = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, "") // remove all whitespace
    .replace(/\(\d+\)/g, "") // remove parenthesized copy numbers like (1), (2)
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

const mergeAnnotations = (localAnns, cloudAnns) => {
  if (!localAnns) return cloudAnns || {};
  if (!cloudAnns) return localAnns || {};
  
  const merged = { ...localAnns };
  
  Object.keys(cloudAnns).forEach(cloudKey => {
    const normCloudKey = normalizeFilename(cloudKey);
    const matchedLocalKey = Object.keys(merged).find(
      localKey => normalizeFilename(localKey) === normCloudKey
    );
    
    const targetKey = matchedLocalKey || cloudKey;
    const localNotes = merged[targetKey] || [];
    const cloudNotes = cloudAnns[cloudKey] || [];
    
    // Merge arrays, removing duplicates by ID
    const combinedNotes = [...localNotes];
    cloudNotes.forEach(cn => {
      if (!combinedNotes.some(ln => ln.id === cn.id)) {
        combinedNotes.push(cn);
      }
    });
    
    combinedNotes.sort((a, b) => new Date(a.date || a.id).getTime() - new Date(b.date || b.id).getTime());
    merged[targetKey] = combinedNotes;
  });
  
  return merged;
};

const findHighlightsForFile = (highlightsMap, fileName) => {
  if (!fileName || !highlightsMap) return {};
  if (highlightsMap[fileName]) return highlightsMap[fileName];
  const normTarget = normalizeFilename(fileName);
  const matchedKey = Object.keys(highlightsMap).find(
    key => normalizeFilename(key) === normTarget
  );
  return matchedKey ? highlightsMap[matchedKey] : {};
};

const mergeHighlights = (localHls, cloudHls) => {
  if (!localHls) return cloudHls || {};
  if (!cloudHls) return localHls || {};
  
  const merged = { ...localHls };
  
  Object.keys(cloudHls).forEach(cloudKey => {
    const normCloudKey = normalizeFilename(cloudKey);
    const matchedLocalKey = Object.keys(merged).find(
      localKey => normalizeFilename(localKey) === normCloudKey
    );
    
    const targetKey = matchedLocalKey || cloudKey;
    const localFileHls = merged[targetKey] || {};
    const cloudFileHls = cloudHls[cloudKey] || {};
    
    // Merge page by page
    const combinedFileHls = { ...localFileHls };
    Object.keys(cloudFileHls).forEach(pageKey => {
      const localPageHls = localFileHls[pageKey] || [];
      const cloudPageHls = cloudFileHls[pageKey] || [];
      
      const combinedPageHls = [...localPageHls];
      cloudPageHls.forEach(ch => {
        if (!combinedPageHls.some(lh => lh.id === ch.id)) {
          combinedPageHls.push(ch);
        }
      });
      
      combinedFileHls[pageKey] = combinedPageHls;
    });
    
    merged[targetKey] = combinedFileHls;
  });
  
  return merged;
};

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

  const [highlightsMap, setHighlightsMap] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('globalHighlights');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, doc: null });
  const [documentsRefresh, setDocumentsRefresh] = useState(0);
  const { documents: recentDocuments, loading: loadingDocuments, deleteDocument } = useDocuments(documentsRefresh);
  const [isMobile, setIsMobile] = useState(false);
  const [currentDocId, setCurrentDocId] = useState(null);
  const [pdfInitialPage, setPdfInitialPage] = useState(1);
  const savePageTimer = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Migrar resaltados heredados (legacy) al mapa global al abrir un archivo
  useEffect(() => {
    if (pdfFile?.name) {
      setHighlightsMap(prev => {
        const normTarget = normalizeFilename(pdfFile.name);
        const matchedKey = Object.keys(prev).find(
          key => normalizeFilename(key) === normTarget
        );
        
        if (!matchedKey) {
          const legacySaved = localStorage.getItem(`highlights:${pdfFile.name}`);
          if (legacySaved) {
            try {
              const parsed = JSON.parse(legacySaved);
              return {
                ...prev,
                [pdfFile.name]: parsed
              };
            } catch (e) {
              console.error(e);
            }
          }
        }
        return prev;
      });
    }
  }, [pdfFile]);

  const handleSaveHighlights = (nextFileHls) => {
    if (!pdfFile?.name) return;
    setHighlightsMap(prev => {
      const normTarget = normalizeFilename(pdfFile.name);
      const matchedKey = Object.keys(prev).find(
        key => normalizeFilename(key) === normTarget
      ) || pdfFile.name;
      
      return {
        ...prev,
        [matchedKey]: nextFileHls
      };
    });
  };
  
  const fileInputRef = useRef(null);

  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [loadedUid, setLoadedUid] = useState(null);

  useEffect(() => {
    // Load user annotations from Firestore if logged in
    let unsubscribe = () => {};
    setCloudLoaded(false);
    setLoadedUid(null);

    const loadUserAnnotations = async () => {
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        
        // Use onSnapshot for real-time updates
        unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.annotations) {
                    setAnnotations(prev => {
                        const next = mergeAnnotations(prev, data.annotations);
                        // Compare if actually changed to avoid unnecessary re-renders
                        if (JSON.stringify(prev) !== JSON.stringify(next)) {
                            return next;
                        }
                        return prev;
                    });
                }
                if (data.highlights) {
                    setHighlightsMap(prev => {
                        const next = mergeHighlights(prev, data.highlights);
                        if (JSON.stringify(prev) !== JSON.stringify(next)) {
                            return next;
                        }
                        return prev;
                    });
                }
            }
            setCloudLoaded(true);
            setLoadedUid(currentUser.uid);
        }, (error) => {
            console.error("Error loading user annotations from Firestore:", error);
            setCloudLoaded(true);
            setLoadedUid(currentUser.uid);
        });
      } else {
        setCloudLoaded(true);
        setLoadedUid(null);
      }
    };
    loadUserAnnotations();
    
    return () => unsubscribe();
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
    localStorage.setItem('globalHighlights', JSON.stringify(highlightsMap));
    // Save to Firestore if logged in AND cloud data has been loaded for current user
    if (currentUser && cloudLoaded && loadedUid === currentUser.uid) {
      const saveToFirestore = async () => {
        try {
          await setDoc(doc(db, "users", currentUser.uid), {
            annotations: annotations,
            highlights: highlightsMap
          }, { merge: true });
        } catch (e) {
          console.error("Error saving annotations to cloud", e);
        }
      };
      saveToFirestore();
    }
  }, [annotations, highlightsMap, currentUser, cloudLoaded, loadedUid]);

  useEffect(() => {
    const syncLocalFilesToCloud = async () => {
      if (!currentUser) return;
      
      try {
        const localFiles = await localFileStorage.getFiles();
        if (localFiles.length === 0) return;
        
        // Obtener documentos existentes en la nube para no duplicar
        const q = query(collection(db, `users/${currentUser.uid}/documents`));
        const querySnapshot = await getDocs(q);
        const cloudNames = new Set(querySnapshot.docs.map(doc => doc.data().name));
        
        let syncedAny = false;
        for (const localFile of localFiles) {
          // Solo sincronizamos archivos locales que no estén en la nube
          if (!cloudNames.has(localFile.name) && localFile.source === 'local') {
            console.log(`Sincronizando archivo local con la nube: ${localFile.name}`);
            const fileBlob = await localFileStorage.getFile(localFile.name);
            if (fileBlob) {
              setNotification(`Sincronizando ${localFile.name} en segundo plano...`);
              const storageRef = ref(storage, `users/${currentUser.uid}/documents/${localFile.name}`);
              const uploadTask = uploadBytesResumable(storageRef, fileBlob);
              
              await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                  null, 
                  (error) => {
                    console.error(`Error al subir ${localFile.name}:`, error);
                    reject(error);
                  }, 
                  async () => {
                    try {
                      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                      await addDoc(collection(db, `users/${currentUser.uid}/documents`), {
                        name: localFile.name,
                        url: downloadURL,
                        createdAt: serverTimestamp(),
                        size: localFile.size || fileBlob.size,
                        lastPage: 1
                      });
                      console.log(`Archivo ${localFile.name} sincronizado correctamente`);
                      syncedAny = true;
                      resolve();
                    } catch (err) {
                      reject(err);
                    }
                  }
                );
              });
            }
          }
        }
        if (syncedAny) {
          setDocumentsRefresh(v => v + 1);
          setNotification("Sincronización en segundo plano completada");
          setTimeout(() => setNotification(null), 3000);
        }
      } catch (error) {
        console.error("Error en sincronización automática de archivos locales:", error);
      }
    };

    syncLocalFilesToCloud();
  }, [currentUser]);

  const addAnnotation = (text, page, geometry = null) => {
    if (!pdfFile) return;
    const fileName = pdfFile.name;
    setAnnotations(prev => {
      const normTarget = normalizeFilename(fileName);
      const matchedKey = Object.keys(prev).find(
        key => normalizeFilename(key) === normTarget
      ) || fileName;
      
      const fileNotes = prev[matchedKey] || [];
      return {
        ...prev,
        [matchedKey]: [...fileNotes, { 
          id: Date.now(), 
          text, 
          page, 
          date: new Date().toISOString(),
          geometry
        }]
      };
    });
  };

  const deleteAnnotation = (id) => {
    if (!pdfFile) return;
    const fileName = pdfFile.name;
    setAnnotations(prev => {
      const normTarget = normalizeFilename(fileName);
      const matchedKey = Object.keys(prev).find(
        key => normalizeFilename(key) === normTarget
      ) || fileName;
      
      const fileNotes = prev[matchedKey] || [];
      return {
        ...prev,
        [matchedKey]: fileNotes.filter(note => note.id !== id)
      };
    });
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'vision');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'vision') {
      root.classList.add('dark', 'vision');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'vision';
      return 'light';
    });
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

  const handlePdfPageChange = (pageNum) => {
    setCurrentPage(pageNum);

    if (currentUser && currentDocId) {
      if (savePageTimer.current) clearTimeout(savePageTimer.current);
      
      savePageTimer.current = setTimeout(() => {
        const docRef = doc(db, `users/${currentUser.uid}/documents`, currentDocId);
        updateDoc(docRef, { 
          lastPage: pageNum,
          lastOpened: serverTimestamp()
        }).catch(e => console.error("Error saving page:", e));
      }, 1000);
    }
    
    if (pdfFile?.name) {
      localStorage.setItem(`lastPage:${pdfFile.name}`, pageNum);
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

      // Optimistic UI: Show file IMMEDIATELY
      setPdfFile(file);
      setPdfInitialPage(1); // Default to 1 for new files
      setCurrentDocId(null); // Reset until we find/create it
      
      // Try to recover local lastPage
      const savedPage = localStorage.getItem(`lastPage:${file.name}`);
      if (savedPage) setPdfInitialPage(parseInt(savedPage));
      
      // Save locally to IndexedDB for offline access
      localFileStorage.saveFile(file, 'local').then(() => {
        setDocumentsRefresh(v => v + 1);
      });

      if (currentUser) {
        // Check if exists to get lastPage from cloud
        // We do this in parallel with upload
        (async () => {
             try {
                const q = query(collection(db, `users/${currentUser.uid}/documents`), where("name", "==", file.name));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const docData = querySnapshot.docs[0].data();
                    const docId = querySnapshot.docs[0].id;
                    setCurrentDocId(docId);
                    if (docData.lastPage) {
                        setPdfInitialPage(docData.lastPage);
                    }
                }
             } catch(e) { console.error(e); }
        })();

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
                const newDoc = await addDoc(collection(db, `users/${currentUser.uid}/documents`), {
                  name: file.name,
                  url: downloadURL,
                  createdAt: serverTimestamp(),
                  size: file.size,
                  lastPage: 1
                });
                setCurrentDocId(newDoc.id);
              } else {
                 // Already exists logic handled above, but ensure ID is set if race condition
                 setCurrentDocId(querySnapshot.docs[0].id);
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
    
    setCurrentDocId(docData.id || null);

    const localPageStr = localStorage.getItem(`lastPage:${docData.name}`);
    const cloudPage = typeof docData.lastPage === 'number'
      ? docData.lastPage
      : parseInt(docData.lastPage || '0', 10);
    const localPage = localPageStr ? parseInt(localPageStr, 10) : 0;

    let startPage = 1;
    if (cloudPage > 1 || localPage > 1) {
      if (cloudPage > 1 && localPage > 1) {
        startPage = Math.max(cloudPage, localPage);
      } else if (cloudPage > 1) {
        startPage = cloudPage;
      } else {
        startPage = localPage;
      }
    } else if (cloudPage === 1 || localPage === 1) {
      startPage = 1;
    }

    setPdfInitialPage(startPage);
    
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
         
         // Descargar y cachear en IndexedDB en segundo plano para acceso offline y cargas rápidas futuras
         (async () => {
           try {
             const res = await fetch(docData.url);
             if (res.ok) {
               const blob = await res.blob();
               const fileObj = new File([blob], docData.name, { type: 'application/pdf' });
               await localFileStorage.saveFile(fileObj, 'local');
               console.log(`Guardado archivo de la nube en caché local: ${docData.name}`);
               setDocumentsRefresh(v => v + 1);
             } else {
               console.warn("No se pudo cachear el archivo localmente:", res.statusText);
             }
           } catch (err) {
             console.warn("Fallo al descargar archivo para caché local (puede ser CORS):", err);
           }
         })();
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
    
    let token = accessToken || localStorage.getItem('googleAccessToken');
     
     // Validar si el token sigue siendo válido antes de usarlo para evitar fallos silenciosos
     if (token) {
       try {
         const check = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
           headers: { 'Authorization': `Bearer ${token}` }
         });
         if (!check.ok) {
           console.warn("Token de Google Drive expirado. Se solicitará re-autenticación.");
           token = null;
           localStorage.removeItem('googleAccessToken');
         }
       } catch (e) {
         console.error("Error al validar token de Google:", e);
         token = null;
       }
     }
     
     // Si no hay token o expiró, solicitar uno nuevo interactivo
     if (!token) {
        try {
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
        setDocumentsRefresh(v => v + 1);

        // If it's a new import (shouldSaveToLibrary is true), save metadata to Firestore instantly
        // No need to upload the file to Storage anymore
        if (currentUser && shouldSaveToLibrary) {
            try {
                const q = query(collection(db, `users/${currentUser.uid}/documents`), where("driveId", "==", fileId));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    const newDoc = await addDoc(collection(db, `users/${currentUser.uid}/documents`), {
                        name: fileName,
                        driveId: fileId,
                        source: 'drive',
                        createdAt: serverTimestamp(),
                        size: file.size,
                        lastPage: 1
                        // No 'url' field needed for Drive files
                    });
                    setCurrentDocId(newDoc.id);
                    setPdfInitialPage(1);
                    console.log("Drive document saved to library");
                    setNotification("Documento guardado en tu biblioteca");
                } else {
                    const existing = querySnapshot.docs[0];
                    setCurrentDocId(existing.id);
                    if (existing.data().lastPage) {
                        setPdfInitialPage(existing.data().lastPage);
                    }
                }
            } catch (err) {
                console.error("Error saving Drive metadata:", err);
            }
        } else {
            setNotification(null); // Clear "Downloading..." message
        }

      } catch (error) {
        console.error("Error downloading from Drive:", error);
        
        // Si el token de Google Drive ha expirado (error 401), intentamos re-autenticar y reintentar
        if (error.message && (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized'))) {
          console.warn("Token de Google Drive expirado. Solicitando re-autenticación...");
          try {
            localStorage.removeItem('googleAccessToken');
            await loginWithGoogle();
            const newToken = localStorage.getItem('googleAccessToken');
            if (newToken) {
              // Reintentar la descarga con el nuevo token válido
              await downloadFileFromDrive(fileId, fileName, newToken, shouldSaveToLibrary);
              return;
            }
          } catch (authErr) {
            console.error("Error al re-autenticar con Google:", authErr);
          }
        }
        
        setNotification(`Error al descargar: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
  };

  const openDocumentFromDriveByName = async (fileName) => {
      let token = accessToken || localStorage.getItem('googleAccessToken');
      
      if (token) {
        try {
          const check = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!check.ok) {
            token = null;
            localStorage.removeItem('googleAccessToken');
          }
        } catch (e) {
          token = null;
        }
      }

      if (!token && currentUser) {
         try {
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

      setNotification(`Buscando "${fileName}" en Google Drive...`);
      try {
        const escapedName = fileName.replace(/'/g, "\\'");
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${escapedName}' and mimeType='application/pdf'&fields=files(id,name,size)&pageSize=1`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error de Drive API: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.files && data.files.length > 0) {
          const fileId = data.files[0].id;
          const name = data.files[0].name;
          await downloadFileFromDrive(fileId, name, token, true);
        } else {
          setNotification(`No se encontró el archivo "${fileName}" en tu Google Drive.`);
        }
      } catch (error) {
        console.error("Error al buscar en Drive:", error);
        setNotification(`Error al buscar en Drive: ${error.message}`);
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
               onOpenDocumentFromDriveByName={openDocumentFromDriveByName}
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
            annotations={findAnnotationsForFile(annotations, pdfFile.name)}
            highlights={findHighlightsForFile(highlightsMap, pdfFile.name)}
            onSaveHighlights={handleSaveHighlights}
            onDeleteAnnotation={deleteAnnotation}
            currentPage={currentPage} // This is for external control if needed
            initialPage={pdfInitialPage}
            onPageChange={handlePdfPageChange}
            currentUser={currentUser}
            onMenuOpen={() => setIsMenuOpen(true)}
            onSaveToCloud={async () => {
              if (!currentUser) {
                try {
                  await loginWithGoogle();
                  setNotification({ type: 'success', text: "Sesión iniciada. ¡Sincronizando datos!" });
                } catch (err) {
                  console.error("Error al iniciar sesión:", err);
                  setNotification({ type: 'error', text: "No se pudo iniciar sesión para sincronizar." });
                }
              } else {
                setNotification({ type: 'info', text: "Guardando anotaciones en la nube..." });
                try {
                  // Guardar anotaciones en Firestore de forma segura con un timeout de 8 segundos
                  await Promise.race([
                    setDoc(doc(db, "users", currentUser.uid), {
                      annotations: annotations
                    }, { merge: true }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de conexión con Firestore")), 8000))
                  ]);
                  
                  // Sincronizar archivos locales en Storage y Firestore en segundo plano (sin bloquear la UI)
                  const syncLocalFilesBackground = async () => {
                    try {
                      const localFiles = await localFileStorage.getFiles();
                      if (localFiles.length === 0) return;
                      
                      const q = query(collection(db, `users/${currentUser.uid}/documents`));
                      const querySnapshot = await getDocs(q);
                      const cloudNames = new Set(querySnapshot.docs.map(doc => doc.data().name));
                      
                      let syncedAny = false;
                      for (const localFile of localFiles) {
                        if (!cloudNames.has(localFile.name) && localFile.source === 'local') {
                          const fileBlob = await localFileStorage.getFile(localFile.name);
                          if (fileBlob) {
                            const storageRef = ref(storage, `users/${currentUser.uid}/documents/${localFile.name}`);
                            const uploadTask = uploadBytesResumable(storageRef, fileBlob);
                            
                            // Timeout de 30 segundos por cada subida de archivo individual en segundo plano
                            await Promise.race([
                              new Promise((res, rej) => {
                                uploadTask.on('state_changed', 
                                  null, 
                                  (error) => {
                                    console.error("Error en uploadTask de fondo:", error);
                                    rej(error);
                                  }, 
                                  async () => {
                                    try {
                                      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                                      await addDoc(collection(db, `users/${currentUser.uid}/documents`), {
                                        name: localFile.name,
                                        url: downloadURL,
                                        createdAt: serverTimestamp(),
                                        size: localFile.size || fileBlob.size,
                                        lastPage: 1
                                      });
                                      syncedAny = true;
                                      res();
                                    } catch (err) {
                                      console.error("Error en callback de subida de fondo:", err);
                                      rej(err);
                                    }
                                  }
                                );
                              }),
                              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout en subida de PDF")), 30000))
                            ]);
                          }
                        }
                      }
                      if (syncedAny) {
                         setDocumentsRefresh(v => v + 1);
                      }
                    } catch (backgroundErr) {
                      console.warn("Sincronización de archivos locales en segundo plano falló o expiró:", backgroundErr);
                    }
                  };
                  
                  // Ejecutar subida de archivos locales en segundo plano sin esperar (sin await)
                  syncLocalFilesBackground();
                  
                  setNotification({ type: 'success', text: "¡Sincronización completada! Tus notas están en la nube." });
                } catch (err) {
                  console.error("Error al guardar en la nube:", err);
                  setNotification({ type: 'error', text: err.message.includes("Timeout") ? "Conexión lenta. Reintenta la sincronización." : "Error al guardar en la nube. Inténtalo de nuevo." });
                  throw err; // Propagar el error para que la UI limpie el estado cargando en el catch/finally
                }
              }
            }}
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
