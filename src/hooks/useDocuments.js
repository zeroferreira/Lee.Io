import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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

  return { documents, loading };
};
