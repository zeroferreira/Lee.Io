import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { localFileStorage } from '../utils/localFileStorage';
import { useAuth } from '../context/AuthContext';

export const useDocuments = () => {
  const { currentUser } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    const fetchDocs = async () => {
      setLoading(true);
      
      // 1. Get Local Docs
      let localFiles = [];
      try {
        localFiles = await localFileStorage.getFiles();
      } catch (error) {
        console.error("Error getting local files:", error);
      }
      
      // 2. Setup Cloud Listener if logged in
      if (currentUser) {
        const q = query(collection(db, `users/${currentUser.uid}/documents`), orderBy("createdAt", "desc"));
        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const cloudDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          mergeAndSetDocuments(localFiles, cloudDocs);
        }, (error) => {
          console.error("Error fetching cloud docs:", error);
          mergeAndSetDocuments(localFiles, []);
        });
      } else {
        mergeAndSetDocuments(localFiles, []);
      }
    };

    fetchDocs();

    return () => unsubscribe();
  }, [currentUser]);

  const mergeAndSetDocuments = (localDocs, cloudDocs) => {
     // Combine lists, preferring Cloud if duplicates exist (by name)
     const combined = [...cloudDocs];
     localDocs.forEach(localDoc => {
       if (!combined.find(cd => cd.name === localDoc.name)) {
         combined.push(localDoc);
       }
     });

     // Sort by date
     combined.sort((a, b) => {
       const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.lastModified || 0);
       const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.lastModified || 0);
       return dateB - dateA;
     });

     setDocuments(combined);
     setLoading(false);
  };

  const deleteDocument = async (document) => {
    try {
      // 1. Delete from Local Storage
      await localFileStorage.deleteFile(document.name);

      // 2. Delete from Firestore if logged in
      if (currentUser) {
         // If we have an ID (from cloud), delete directly
         if (document.id) {
           await deleteDoc(doc(db, `users/${currentUser.uid}/documents`, document.id));
         } else {
           // If we don't have ID (maybe mapped from local), try to find it by name
           const q = query(collection(db, `users/${currentUser.uid}/documents`), where("name", "==", document.name));
           const snapshot = await getDocs(q);
           snapshot.forEach(async (d) => {
             await deleteDoc(d.ref);
           });
         }
         
         // Note: We are not deleting the actual file from Storage/Drive to avoid data loss on source.
         // We only remove the reference from the app.
      }
      
      // Refresh local state if not using real-time listener for local files
      // (The listener handles cloud updates, but local ones need manual refresh or state update)
      // Since mergeAndSetDocuments relies on fetching, we might need to manually trigger a re-fetch or filter local state.
      // For simplicity, let's filter the current state immediately for UI responsiveness
      setDocuments(prev => prev.filter(d => d.name !== document.name));

      return true;
    } catch (error) {
      console.error("Error deleting document:", error);
      return false;
    }
  };

  return { documents, loading, deleteDocument };
};
