import { useState, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageSquarePlus, Highlighter, Eraser, Maximize, Minimize, MoreHorizontal, Square, Circle, Copy, Search, Expand, Shrink, Menu, X, Trash2, Globe2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

const generateSpanishPhonetics = (text) => {
  if (!text) return '';
  const markEnye = (value) =>
    value
      .replace(/ñ/g, 'ny')
      .replace(/Ñ/g, 'ny');
  const normalized = markEnye(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const transformWord = (word) => {
    let result = word;
    result = result.replace(/qu([ei])/g, 'k$1');
    result = result.replace(/gu([ei])/g, 'g$1');
    result = result.replace(/ll/g, 'y');
    result = result.replace(/ch/g, 'ch');
    result = result.replace(/ce/g, 'se');
    result = result.replace(/ci/g, 'si');
    result = result.replace(/ge/g, 'je');
    result = result.replace(/gi/g, 'ji');
    result = result.replace(/z/g, 's');
    result = result.replace(/c([aou])/g, 'k$1');
    result = result.replace(/v/g, 'b');
    result = result.replace(/h/g, '');
    return result;
  };
  return normalized
    .split(/\s+/)
    .map(transformWord)
    .join(' ')
    .trim();
};

const generateSpanishIPA = (text) => {
  if (!text) return '';
  const normalized = text
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const transformWord = (word) => {
    let result = word;
    result = result.replace(/gue/g, 'ge');
    result = result.replace(/gui/g, 'gi');
    result = result.replace(/que/g, 'ke');
    result = result.replace(/qui/g, 'ki');
    result = result.replace(/qu/g, 'k');
    result = result.replace(/ll/g, 'ʝ');
    result = result.replace(/ch/g, 'tʃ');
    result = result.replace(/ñ/g, 'ɲ');
    result = result.replace(/ce/g, 'se');
    result = result.replace(/ci/g, 'si');
    result = result.replace(/ge/g, 'xe');
    result = result.replace(/gi/g, 'xi');
    result = result.replace(/j/g, 'x');
    result = result.replace(/z/g, 's');
    result = result.replace(/c([aou])/g, 'k$1');
    result = result.replace(/v/g, 'b');
    result = result.replace(/h/g, '');
    result = result.replace(/y$/g, 'i');
    result = result.replace(/y/g, 'ʝ');
    result = result.replace(/rr/g, 'r');
    result = result.replace(/r/g, 'ɾ');
    return result;
  };
  return normalized
    .split(/\s+/)
    .map(transformWord)
    .join(' ')
    .trim();
};

export const PDFViewer = ({ file, isMobile, onAddAnnotation, annotations = [], currentPage, initialPage = 1, onPageChange, onDeleteAnnotation }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(null);
  const [containerHeight, setContainerHeight] = useState(null);
  const [fitMode, setFitMode] = useState('auto'); // 'width' | 'height' | 'auto'
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [activeTool, setActiveTool] = useState('none'); // 'none', 'highlight', 'erase', 'note_rect', 'note_circle'
  const [tempNoteRect, setTempNoteRect] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const [highlights, setHighlights] = useState({});
  const [direction, setDirection] = useState(0); // -1 prev, 1 next
  const [animationMode, setAnimationMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('animationMode') || 'flip';
    }
    return 'flip';
  });
  const [optionsMenu, setOptionsMenu] = useState({ open: false, x: 0, y: 0, targetId: null, isNewSelection: false });
  const [tempSelection, setTempSelection] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [noteListModal, setNoteListModal] = useState({ isOpen: false, notes: [] });
  const [deleteHighlightModal, setDeleteHighlightModal] = useState({ isOpen: false, targetId: null, message: '' });
  const [deleteNoteModal, setDeleteNoteModal] = useState({ isOpen: false, note: null });
  const [toast, setToast] = useState({ open: false, message: '', variant: 'info' });
  const [translatorModal, setTranslatorModal] = useState({
    isOpen: false,
    text: '',
    activeLang: null,
    loading: false,
    translations: {},
    phonetics: {},
    phoneticsIPA: {},
    error: ''
  });
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  
  // Touch state
  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  // Sync with external page control
  useEffect(() => {
    if (currentPage && currentPage !== pageNumber) {
      setPageNumber(currentPage);
    }
  }, [currentPage]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Minimum swipe distance (in px) 
  const minSwipeDistance = 50; 

  const onTouchStart = (e) => {
    touchEnd.current = null; // Reset
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && pageNumber < (numPages || 1)) {
      changePage(1);
    }
    if (isRightSwipe && pageNumber > 1) {
      changePage(-1);
    }
  };

  function changePage(offset) {
    const newPage = pageNumber + offset;
    setDirection(offset);
    setPageNumber(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  }

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    // Use initialPage if provided and valid, otherwise 1
    const startPage = (initialPage && initialPage > 0 && initialPage <= numPages) ? initialPage : 1;
    setPageNumber(startPage);
    // Don't trigger onPageChange on load to avoid overwriting persisted state with default (1)
    // before async fetch completes
  }

  // React to initialPage changes after mount (e.g. async fetch)
  useEffect(() => {
    if (initialPage && initialPage > 0 && numPages && initialPage <= numPages) {
      setPageNumber(initialPage);
    }
  }, [initialPage, numPages]);

  const handleSaveNote = () => {
    if (noteText.trim()) {
      let geometry = null;
      if (tempNoteRect) {
         geometry = { ...tempNoteRect, type: activeTool === 'note_circle' ? 'circle' : 'rect' };
      }
      onAddAnnotation(noteText, pageNumber, geometry);
      setNoteText('');
      setTempNoteRect(null);
      setIsNoteModalOpen(false);
      setActiveTool('none');
    }
  };

  useEffect(() => {
    if (isFullScreen) {
      // Force update size and set fit mode to width for mobile
      const update = () => {
        const el = document.getElementById('pdf-container');
        if (el) {
          setContainerWidth(el.clientWidth);
          setContainerHeight(el.clientHeight);
        }
      };
      // Small delay to allow layout transition
      setTimeout(update, 100);
      setTimeout(update, 500); // Double check
      
      if (isMobile) {
        setFitMode('width');
      }
    }
  }, [isFullScreen, isMobile]);

  useEffect(() => {
    const updateSize = () => {
      const el = document.getElementById('pdf-container');
      if (el) {
        setContainerWidth(el.clientWidth);
        setContainerHeight(el.clientHeight);
      }
      // Decide default fit mode by breakpoint
      const w = window.innerWidth;
      if (fitMode === 'auto') {
        if (w >= 1024) {
          setFitMode('height'); // desktop/laptop fit height
        } else {
          setFitMode('width'); // mobile/tablet fit width
        }
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load persisted highlights per file
  useEffect(() => {
    if (!file?.name) return;
    const saved = localStorage.getItem(`highlights:${file.name}`);
    if (saved) {
      try {
        setHighlights(JSON.parse(saved));
      } catch {
        setHighlights({});
      }
    } else {
      setHighlights({});
    }
  }, [file?.name]);

  const saveHighlights = (next) => {
    setHighlights(next);
    if (file?.name) {
      localStorage.setItem(`highlights:${file.name}`, JSON.stringify(next));
    }
  };

  const pageHighlights = useMemo(() => {
    return highlights[pageNumber] || [];
  }, [highlights, pageNumber]);

  const beginHighlight = (e) => {
    if (activeTool === 'none') return;
    
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    if (activeTool === 'highlight') {
      setSelectionRect({ x: startX, y: startY, w: 0, h: 0 });
    } else if (activeTool.startsWith('note')) {
      setTempNoteRect({ 
        x: startX / rect.width, 
        y: startY / rect.height, 
        w: 0, 
        h: 0 
      });
    }

    // Close options menu if open
    if (optionsMenu.open) setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
  };

  const handleMouseMove = (e) => {
    if (activeTool === 'none') return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();

    if (activeTool === 'highlight' && selectionRect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setSelectionRect(prev => ({ ...prev, w: mx - prev.x, h: my - prev.y }));
    } else if (activeTool.startsWith('note') && tempNoteRect) {
      const currentX = (e.clientX - rect.left) / rect.width;
      const currentY = (e.clientY - rect.top) / rect.height;
      
      setTempNoteRect(prev => ({
        ...prev,
        w: currentX - prev.x,
        h: currentY - prev.y
      }));
    }
  };

  const finishHighlight = () => {
    if (activeTool === 'highlight' && selectionRect) {
       const overlay = overlayRef.current;
       if (overlay && (Math.abs(selectionRect.w) > 5 || Math.abs(selectionRect.h) > 5)) {
           const overlayW = overlay.clientWidth;
           const overlayH = overlay.clientHeight;
           const norm = {
              x: Math.max(0, Math.min(1, selectionRect.x / overlayW)),
              y: Math.max(0, Math.min(1, selectionRect.y / overlayH)),
              w: Math.max(0, Math.min(1, selectionRect.w / overlayW)),
              h: Math.max(0, Math.min(1, selectionRect.h / overlayH)),
              color: 'rgba(255, 235, 59, 0.35)',
              id: Date.now(),
           };
           const next = { ...highlights, [pageNumber]: [...(highlights[pageNumber] || []), norm] };
           saveHighlights(next);
       }
       setSelectionRect(null);
       return;
    }

    if (activeTool.startsWith('note')) {
        if (tempNoteRect && (Math.abs(tempNoteRect.w) > 0.01 || Math.abs(tempNoteRect.h) > 0.01)) {
            const normalized = {
                x: tempNoteRect.w < 0 ? tempNoteRect.x + tempNoteRect.w : tempNoteRect.x,
                y: tempNoteRect.h < 0 ? tempNoteRect.y + tempNoteRect.h : tempNoteRect.y,
                w: Math.abs(tempNoteRect.w),
                h: Math.abs(tempNoteRect.h)
            };
            setTempNoteRect(normalized);
            setIsNoteModalOpen(true);
        } else {
            setTempNoteRect(null);
        }
        return;
    }
  };

  const handleTouchStartHighlight = (e) => {
    if (activeTool === 'none') return;
    e.stopPropagation();
    const touch = e.touches[0];
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const startX = touch.clientX - rect.left;
    const startY = touch.clientY - rect.top;
    
    if (activeTool === 'highlight') {
      setSelectionRect({ x: startX, y: startY, w: 0, h: 0 });
    } else if (activeTool.startsWith('note')) {
      setTempNoteRect({ 
        x: startX / rect.width, 
        y: startY / rect.height, 
        w: 0, 
        h: 0 
      });
    }
    if (optionsMenu.open) setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
  };

  const handleTouchMoveHighlight = (e) => {
    if (activeTool === 'none') return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    const touch = e.touches[0];
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();

    if (activeTool === 'highlight' && selectionRect) {
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      setSelectionRect(prev => ({ ...prev, w: mx - prev.x, h: my - prev.y }));
    } else if (activeTool.startsWith('note') && tempNoteRect) {
      const currentX = (touch.clientX - rect.left) / rect.width;
      const currentY = (touch.clientY - rect.top) / rect.height;
      setTempNoteRect(prev => ({
        ...prev,
        w: currentX - prev.x,
        h: currentY - prev.y
      }));
    }
  };

  const handleTouchEndHighlight = (e) => {
    if (activeTool === 'none') return;
    e.stopPropagation();
    finishHighlight();
  };

  const removeLastHighlight = () => {
    const list = highlights[pageNumber] || [];
    if (list.length === 0) return;
    const next = { ...highlights, [pageNumber]: list.slice(0, -1) };
    saveHighlights(next);
  };

  const deleteHighlight = (id) => {
    const list = highlights[pageNumber] || [];
    const next = { ...highlights, [pageNumber]: list.filter(h => h.id !== id) };
    saveHighlights(next);
  };

  const handleHighlightClick = (e, highlight, anchorRect) => {
    e.stopPropagation();
    if (activeTool === 'erase') {
      setDeleteHighlightModal({
        isOpen: true,
        targetId: highlight.id,
        message: "¿Estás seguro de querer borrar el subrayado/anotación?"
      });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const baseRect = anchorRect 
      || (Array.isArray(highlight.rects) && highlight.rects.length > 0 ? highlight.rects[highlight.rects.length - 1] : highlight);
    setOptionsMenu({
      open: true,
      x: baseRect.x,
      y: baseRect.y,
      screenX: rect.left + rect.width / 2,
      screenY: rect.top,
      targetId: highlight.id
    });
    setSelectedText(highlight.text || '');
  };

  const clearPageHighlights = () => {
    const next = { ...highlights, [pageNumber]: [] };
    saveHighlights(next);
  };

  const showToast = (message, variant = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ open: true, message, variant });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, open: false }));
    }, 2000);
  };

  const translateText = async (lang) => {
    if (!translatorModal.text.trim()) {
      showToast('No hay texto para traducir', 'error');
      return;
    }

    const sourceLangMap = {
      en: 'en',
      it: 'it',
      de: 'de',
      ru: 'ru'
    };
    const sourceLang = sourceLangMap[lang] || 'en';

    if (translatorModal.translations[lang]) {
      const existingTranslation = translatorModal.translations[lang];
      const existingPhonetic = translatorModal.phonetics?.[lang];
      const existingIPA = translatorModal.phoneticsIPA?.[lang];
      if (existingTranslation && (!existingPhonetic || !existingIPA)) {
        const phonetic = existingPhonetic || generateSpanishPhonetics(existingTranslation);
        const ipa = existingIPA || generateSpanishIPA(existingTranslation);
        setTranslatorModal(prev => ({
          ...prev,
          activeLang: lang,
          phonetics: { ...prev.phonetics, [lang]: phonetic },
          phoneticsIPA: { ...prev.phoneticsIPA, [lang]: ipa },
          error: ''
        }));
      } else {
        setTranslatorModal(prev => ({ ...prev, activeLang: lang, error: '' }));
      }
      return;
    }

    setTranslatorModal(prev => ({ ...prev, activeLang: lang, loading: true, error: '' }));

    const textToTranslate = translatorModal.text.replace(/\s+/g, ' ').trim();
    // Use a generic email to increase quota and enable machine translation backup
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=${sourceLang}|es&de=freetranslation@lee.io&mt=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      
      if (data.responseStatus !== 200 && data.responseStatus !== '200') {
         // MyMemory might return 200 OK status but a non-200 responseStatus in JSON
         throw new Error(data.responseDetails || `API Error ${data.responseStatus}`);
      }

      const raw = data?.responseData?.translatedText || '';
      const translated = raw
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
        
      if (!translated) {
        throw new Error('Traducción vacía');
      }

      const phonetic = generateSpanishPhonetics(translated);
      const ipa = generateSpanishIPA(translated);

      setTranslatorModal(prev => ({
        ...prev,
        loading: false,
        translations: { ...prev.translations, [lang]: translated },
        phonetics: { ...prev.phonetics, [lang]: phonetic },
        phoneticsIPA: { ...prev.phoneticsIPA, [lang]: ipa },
        error: ''
      }));
    } catch (e) {
      console.error(e);
      setTranslatorModal(prev => ({
        ...prev,
        loading: false,
        error: `Error: ${e.message || 'No se pudo conectar con el servicio'}`
      }));
    }
  };

  const pageVariants = {
    slide: {
      enter: (direction) => ({
        x: direction > 0 ? 400 : -400,
        opacity: 0
      }),
      center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        transition: { duration: 0.35, ease: "easeOut" }
      },
      exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? 400 : -400,
        opacity: 0,
        transition: { duration: 0.3, ease: "easeIn" }
      })
    },
    flip: {
      enter: (direction) => ({
        x: 0,
        opacity: 0,
        rotateY: direction > 0 ? 80 : -80,
        scale: 0.96
      }),
      center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        rotateY: 0,
        scale: 1,
        transition: { duration: 0.5, type: "spring", stiffness: 280, damping: 28 }
      },
      exit: (direction) => ({
        zIndex: 0,
        x: 0,
        opacity: 0,
        rotateY: direction < 0 ? -80 : 80,
        scale: 0.96,
        transition: { duration: 0.45 }
      })
    },
    curl: {
      enter: (direction) => ({
        x: 0,
        opacity: 0,
        rotateY: direction > 0 ? 30 : -30,
        skewX: direction > 0 ? -6 : 6,
        scale: 0.98
      }),
      center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        rotateY: 0,
        skewX: 0,
        scale: 1,
        transition: { duration: 0.5, ease: "easeOut" }
      },
      exit: (direction) => ({
        zIndex: 0,
        x: 0,
        opacity: 0,
        rotateY: direction < 0 ? -30 : 30,
        skewX: direction < 0 ? 6 : -6,
        scale: 0.98,
        transition: { duration: 0.45, ease: "easeIn" }
      })
    }
  };

  const handleTextSelection = () => {
    if (activeTool !== 'none') return;
    
    // Small delay to ensure selection is complete
    setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const text = sel.toString();
        
        if (text && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const overlay = overlayRef.current;
          if (!overlay) return;
          
          // Check if selection is inside our PDF container
          const container = containerRef.current;
          if (!container || !container.contains(sel.anchorNode)) return;

          const orect = overlay.getBoundingClientRect();
          const rects = Array.from(range.getClientRects()).map(r => {
            return {
              x: Math.max(0, Math.min(1, (r.left - orect.left) / orect.width)),
              y: Math.max(0, Math.min(1, (r.top - orect.top) / orect.height)),
              w: Math.max(0, Math.min(1, r.width / orect.width)),
              h: Math.max(0, Math.min(1, r.height / orect.height)),
            };
          }).filter(r => r.w > 0 && r.h > 0);

          if (rects.length > 0) {
            const id = Date.now();
            const hx = { id, rects, color: 'rgba(255, 235, 59, 0.35)', text };
            
            setTempSelection(hx);
            
            const last = rects[rects.length - 1];
            setSelectedText(text);
            
            // Calculate absolute screen position for menu
            const screenX = orect.left + (last.x * orect.width) + (last.w * orect.width) / 2;
            const screenY = orect.top + (last.y * orect.height);

            setOptionsMenu({
              open: true,
              x: last.x, 
              y: last.y,
              screenX,
              screenY,
              targetId: id,
              isNewSelection: true
            });
            try { sel.removeAllRanges(); } catch {}
          }
        }
    }, 10);
  };

  return (
    <div className={`flex flex-col w-full mx-auto relative ${isFullScreen ? 'fixed inset-0 z-50 bg-background max-w-none h-[100dvh]' : (isMobile ? 'bg-background max-w-5xl h-full' : 'p-4 pt-20 max-w-5xl h-full')}`}>
      {!isFullScreen && (
      <div className={`flex items-center flex-wrap gap-3 bg-background border-foreground/10 z-20 ${isMobile ? 'w-full justify-between shadow-sm p-2 border-b flex-none' : 'p-2 rounded-lg border shadow-sm mb-4 sticky top-20'}`}>
        <div className="flex items-center gap-2">
            <button
            disabled={pageNumber <= 1}
          onClick={() => changePage(-1)}
          className="p-1 hover:bg-foreground/5 rounded disabled:opacity-50"
        >
          <ChevronLeft />
        </button>
        <span className="text-sm font-medium">
          {pageNumber} / {numPages || '--'}
        </span>
        <button
          disabled={pageNumber >= numPages}
          onClick={() => changePage(1)}
          className="p-1 hover:bg-foreground/5 rounded disabled:opacity-50"
        >
          <ChevronRight />
        </button>
        </div>
        <div className="w-px h-6 bg-foreground/10 mx-2" />
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 hover:bg-foreground/5 rounded">
          <ZoomOut size={20} />
        </button>
        <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-1 hover:bg-foreground/5 rounded">
          <ZoomIn size={20} />
        </button>
        <div className="w-px h-6 bg-foreground/10 mx-2" />
        <select
          value={animationMode}
          onChange={e => {
            const v = e.target.value;
            setAnimationMode(v);
            localStorage.setItem('animationMode', v);
          }}
          className="text-sm border border-foreground/20 rounded px-2 py-1 bg-background"
          title="Animación al pasar página"
        >
          <option value="slide">Deslizar</option>
          <option value="flip">Volteo 3D</option>
          <option value="curl">Página</option>
        </select>
        <div className="w-px h-6 bg-foreground/10 mx-2" />
        {/* Fit controls */}
        <button 
          onClick={() => setFitMode('width')} 
          className={`p-1 rounded ${fitMode === 'width' ? 'bg-foreground text-background' : 'hover:bg-foreground/5'}`}
          title="Ajustar al ancho"
        >
          <Maximize size={18} />
        </button>
        <button 
          onClick={() => setFitMode('height')} 
          className={`p-1 rounded ${fitMode === 'height' ? 'bg-foreground text-background' : 'hover:bg-foreground/5'}`}
          title="Ajustar al alto"
        >
          <Minimize size={18} />
        </button>
        <div className="w-px h-6 bg-foreground/10 mx-2" />
        {/* Highlight tools */}
        <button 
          onClick={() => setActiveTool(activeTool === 'highlight' ? 'none' : 'highlight')} 
          className={`p-1 rounded ${activeTool === 'highlight' ? 'bg-foreground text-background' : 'hover:bg-foreground/5'}`}
          title="Subrayar"
        >
          <Highlighter size={18} />
        </button>
        <button 
          onClick={() => setActiveTool(activeTool === 'erase' ? 'none' : 'erase')} 
          className={`p-1 rounded ${activeTool === 'erase' ? 'bg-foreground text-background' : 'hover:bg-foreground/5'}`}
          title={activeTool === 'erase' ? "Modo borrador activo" : "Borrador"}
        >
          <Eraser size={18} />
        </button>
        <button 
          onClick={clearPageHighlights} 
          className="p-1 hover:bg-foreground/5 rounded text-sm"
          title="Limpiar subrayados de la página"
        >
          Limpiar
        </button>
        <div className="w-px h-6 bg-foreground/10 mx-2" />
        <div className="flex items-center gap-1 bg-foreground/5 rounded p-0.5">
           <button 
             onClick={() => setActiveTool(activeTool.startsWith('note') ? 'none' : 'note_rect')} 
             className={`p-1 rounded ${activeTool.startsWith('note') ? 'bg-foreground text-background' : 'hover:bg-foreground/10'}`} 
             title="Agregar nota"
           >
             <MessageSquarePlus size={20} />
           </button>
           {activeTool.startsWith('note') && (
             <div className="flex items-center gap-1 ml-1 animate-in fade-in slide-in-from-left-2">
                <button
                  onClick={() => setActiveTool('note_rect')}
                  className={`p-1 rounded ${activeTool === 'note_rect' ? 'bg-background shadow text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
                  title="Rectángulo"
                >
                  <Square size={14} />
                </button>
                <button
                  onClick={() => setActiveTool('note_circle')}
                  className={`p-1 rounded ${activeTool === 'note_circle' ? 'bg-background shadow text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
                  title="Círculo"
                >
                  <Circle size={14} />
                </button>
             </div>
           )}
        </div>
        <div className="w-px h-6 bg-foreground/10 mx-2" />
        <button 
          onClick={() => setIsFullScreen(true)} 
          className="p-1 hover:bg-foreground/5 rounded"
          title="Pantalla completa"
        >
          <Expand size={20} />
        </button>
      </div>
      )}

      <div 
        id="pdf-container"
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseUp={handleTextSelection}
        className={`w-full flex justify-center bg-gray-100 dark:bg-gray-900 overflow-auto relative flex-1 ${isMobile ? '' : 'border border-foreground/10 shadow-lg rounded-lg'}`}
        style={{ perspective: '1500px' }}
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          className={`flex flex-col items-center w-full min-h-full ${isFullScreen ? 'py-0' : 'py-8'}`}
          loading={<div className="p-10">Cargando PDF...</div>}
          error={<div className="p-10 text-red-500">Error al cargar el PDF.</div>}
        >
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={pageNumber}
              custom={direction}
              variants={pageVariants[animationMode]}
              initial="enter"
              animate="center"
              exit="exit"
              className="relative flex items-center justify-center my-auto"
              style={{ transformStyle: 'preserve-3d', transformOrigin: direction > 0 ? 'left center' : 'right center' }}
            >
              <div className="relative shadow-2xl">
                <Page 
                  pageNumber={pageNumber} 
                  scale={fitMode === 'width' ? undefined : scale} 
                  width={fitMode === 'width' ? containerWidth || undefined : undefined}
                  height={fitMode === 'height' ? containerHeight || undefined : undefined}
                  className=""
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
                {animationMode === 'curl' && (
                  <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                      key={`curl-${pageNumber}`}
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 120, opacity: 0.4 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.45 }}
                      className="absolute inset-y-0 right-0"
                      style={{
                        background: 'linear-gradient(to left, rgba(0,0,0,0.35), rgba(0,0,0,0))'
                      }}
                    />
                  </AnimatePresence>
                )}
                 <div 
                   ref={overlayRef}
                   onMouseDown={beginHighlight}
                   onMouseMove={handleMouseMove}
                   onTouchStart={handleTouchStartHighlight}
                   onTouchMove={handleTouchMoveHighlight}
                   onTouchEnd={handleTouchEndHighlight}
                   onMouseUp={() => {
                     finishHighlight();
                   }}
                   className="absolute inset-0 z-10"
                   style={{ 
                     pointerEvents: activeTool === 'none' ? 'none' : 'auto',
                     cursor: activeTool === 'erase' 
                       ? "url('data:image/svg+xml;utf8,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"black\" stroke-width=\"2\" fill=\"rgba(255,255,255,0.5)\"/></svg>') 12 12, auto"
                       : (activeTool !== 'none' ? 'crosshair' : 'text')
                   }}
                 >
                  {annotations.filter(a => a.page === pageNumber && a.geometry).map(a => (
                     <div
                        key={a.id}
                        className={`absolute border-2 ${a.geometry.type === 'circle' ? 'rounded-full' : 'rounded-sm'} border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer transition-colors`}
                        style={{
                            left: `${a.geometry.x * 100}%`,
                            top: `${a.geometry.y * 100}%`,
                            width: `${a.geometry.w * 100}%`,
                            height: `${a.geometry.h * 100}%`
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setNoteListModal({ isOpen: true, notes: [a] });
                        }}
                        title={a.text}
                     />
                   ))}
                   {tempNoteRect && activeTool.startsWith('note') && (
                     <div
                        className={`absolute border-2 ${activeTool === 'note_circle' ? 'rounded-full' : 'rounded-sm'} border-blue-500/50 bg-blue-500/10`}
                        style={{
                            left: `${Math.min(tempNoteRect.x, tempNoteRect.x + tempNoteRect.w) * 100}%`,
                            top: `${Math.min(tempNoteRect.y, tempNoteRect.y + tempNoteRect.h) * 100}%`,
                            width: `${Math.abs(tempNoteRect.w) * 100}%`,
                            height: `${Math.abs(tempNoteRect.h) * 100}%`
                        }}
                     />
                   )}
                   {pageHighlights.map(h => {
                     const hasRects = Array.isArray(h.rects) && h.rects.length > 0;
                     const lastRect = hasRects ? h.rects[h.rects.length - 1] : h;
                     return (
                       <div key={h.id} className="absolute inset-0 pointer-events-none">
                         {hasRects ? h.rects.map((r, idx) => (
                           <div
                             key={`${h.id}-${idx}`}
                             className="absolute rounded-sm pointer-events-auto"
                             style={{
                               left: `${Math.min(r.x, r.x + r.w) * 100}%`,
                               top: `${Math.min(r.y, r.y + r.h) * 100}%`,
                               width: `${Math.abs(r.w) * 100}%`,
                               height: `${Math.abs(r.h) * 100}%`,
                               background: h.color,
                             }}
                             onClick={(e) => handleHighlightClick(e, h, r)}
                           />
                         )) : (
                           <div
                             className="absolute rounded-sm pointer-events-auto"
                             style={{
                               left: `${Math.min(h.x, h.x + h.w) * 100}%`,
                               top: `${Math.min(h.y, h.y + h.h) * 100}%`,
                               width: `${Math.abs(h.w) * 100}%`,
                               height: `${Math.abs(h.h) * 100}%`,
                               background: h.color,
                             }}
                             onClick={(e) => handleHighlightClick(e, h, h)}
                           />
                         )}
                         <button
                           onClick={(e) => handleHighlightClick(e, h, lastRect)}
                           className="absolute -translate-x-1/2 -translate-y-1/2 p-1 bg-background border border-foreground/20 rounded-full shadow hover:bg-foreground/5 z-20 pointer-events-auto"
                           style={{
                             left: `${(Math.min(lastRect.x, lastRect.x + lastRect.w) + Math.abs(lastRect.w)) * 100}%`,
                             top: `${Math.min(lastRect.y, lastRect.y + lastRect.h) * 100}%`,
                           }}
                           title="Opciones"
                         >
                           <MoreHorizontal size={16} />
                         </button>
                       </div>
                     );
                   })}
                   {selectionRect && (
                     <div 
                       className="absolute border border-yellow-400/70 bg-yellow-200/30"
                       style={{
                         left: `${Math.min(selectionRect.x, selectionRect.x + selectionRect.w)}px`,
                         top: `${Math.min(selectionRect.y, selectionRect.y + selectionRect.h)}px`,
                         width: `${Math.abs(selectionRect.w)}px`,
                         height: `${Math.abs(selectionRect.h)}px`,
                       }}
                     />
                   )}
                   {tempSelection && Array.isArray(tempSelection.rects) && tempSelection.rects.length > 0 && (
                     <div className="absolute inset-0 pointer-events-none">
                       {tempSelection.rects.map((r, idx) => (
                         <div
                           key={`temp-${idx}`}
                           className="absolute rounded-sm"
                           style={{
                             left: `${Math.min(r.x, r.x + r.w) * 100}%`,
                             top: `${Math.min(r.y, r.y + r.h) * 100}%`,
                             width: `${Math.abs(r.w) * 100}%`,
                             height: `${Math.abs(r.h) * 100}%`,
                             background: tempSelection.color || 'rgba(255, 235, 59, 0.35)',
                           }}
                         />
                       ))}
                     </div>
                   )}
                 </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Document>
      </div>

      {optionsMenu.open && (
        <div
          className="fixed z-[100] bg-background border border-foreground/20 rounded-lg shadow-xl flex items-center gap-2 p-2 transform -translate-x-1/2 -translate-y-full mt-[-10px]"
          style={{
            left: optionsMenu.screenX,
            top: optionsMenu.screenY,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {optionsMenu.isNewSelection ? (
            <>
              <button
                onClick={() => {
                  if (selectedText) {
                    const q = encodeURIComponent(selectedText);
                    window.open(`https://www.google.com/search?q=${q}`, '_blank');
                  }
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                  setTempSelection(null);
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1"
                title="Buscar en Google"
              >
                <Search size={14} />
              </button>
              <button
                onClick={() => {
                  if (!selectedText) {
                    showToast('No hay texto para traducir', 'error');
                  } else {
                    setTranslatorModal({
                      isOpen: true,
                      text: selectedText,
                      activeLang: null,
                      loading: false,
                      translations: {},
                      phonetics: {},
                      phoneticsIPA: {},
                      error: ''
                    });
                  }
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                  setTempSelection(null);
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1"
                title="Traducir a español"
              >
                <Globe2 size={14} />
              </button>
              <button
                onClick={() => {
                  if (tempSelection) {
                    const next = { ...highlights, [pageNumber]: [...(highlights[pageNumber] || []), tempSelection] };
                    saveHighlights(next);
                  }
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                  setTempSelection(null);
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1"
                title="Subrayar"
              >
                <Highlighter size={14} />
              </button>
              <button
                onClick={() => {
                  if (tempSelection) {
                    const next = { ...highlights, [pageNumber]: [...(highlights[pageNumber] || []), tempSelection] };
                    saveHighlights(next);
                    
                    setNoteText(selectedText ? `"${selectedText}"\n\n` : '');
                    setIsNoteModalOpen(true);
                  }
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                  setTempSelection(null);
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1"
                title="Anotar"
              >
                <MessageSquarePlus size={14} />
              </button>
              <button
                onClick={() => {
                  if (selectedText) {
                    navigator.clipboard.writeText(selectedText).then(() => {
                      showToast('Texto copiado al portapapeles', 'success');
                    }).catch(err => {
                      console.error('Error al copiar:', err);
                    });
                  }
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                  setTempSelection(null);
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1"
                title="Copiar"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => {
                    setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                    setTempSelection(null);
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5"
              >
                X
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  const targetList = highlights[pageNumber] || [];
                  const h = targetList.find(x => x.id === optionsMenu.targetId);
                  const text = selectedText || (h?.text || '');
                  
                  setNoteText(text ? `"${text}"\n\n` : '');
                  setIsNoteModalOpen(true);
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5"
              >
                Idea
              </button>
              <button
                onClick={() => {
                  const targetList = highlights[pageNumber] || [];
                  const h = targetList.find(x => x.id === optionsMenu.targetId);
                  const text = selectedText || (h?.text || '');
                  const related = annotations.filter(a => a.page === pageNumber && a.text && (text ? a.text.includes(text) : true));
                  
                  setNoteListModal({ isOpen: true, notes: related });
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5"
              >
                Ver notas
              </button>
              <div className="flex items-center gap-1">
                {['rgba(255, 235, 59, 0.35)','rgba(76, 175, 80, 0.35)','rgba(255, 105, 180, 0.35)','rgba(30, 144, 255, 0.35)'].map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      const list = highlights[pageNumber] || [];
                      const next = list.map(h => h.id === optionsMenu.targetId ? { ...h, color: c } : h);
                      const merged = { ...highlights, [pageNumber]: next };
                      saveHighlights(merged);
                      setOptionsMenu({ ...optionsMenu });
                    }}
                    className="w-5 h-5 rounded"
                    style={{ background: c }}
                    title="Color"
                  />
                ))}
              </div>
              <button
                onClick={() => {
                    const targetList = highlights[pageNumber] || [];
                    const h = targetList.find(x => x.id === optionsMenu.targetId);
                    const text = selectedText || (h?.text || '');
                    if (text) {
                      navigator.clipboard.writeText(text).then(() => {
                        showToast('Texto copiado al portapapeles', 'success');
                      }).catch(err => {
                        console.error('Error al copiar:', err);
                      });
                    } else {
                      showToast('No hay texto para copiar', 'error');
                    }
                    setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1"
                title="Copiar texto"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => {
                  setDeleteHighlightModal({
                    isOpen: true,
                    targetId: optionsMenu.targetId,
                    message: "¿Eliminar este subrayado?"
                  });
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1 text-red-500"
                title="Eliminar subrayado"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => {
                  const targetList = highlights[pageNumber] || [];
                  const h = targetList.find(x => x.id === optionsMenu.targetId);
                  const text = selectedText || (h?.text || '');
                  if (text) {
                    const q = encodeURIComponent(text);
                    window.open(`https://www.google.com/search?q=${q}`, '_blank');
                  } else {
                    showToast('No hay texto seleccionado para buscar.', 'error');
                  }
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5"
              >
                Buscar
              </button>
              <button
                onClick={() => setOptionsMenu({ open: false, x: 0, y: 0, targetId: null })}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5"
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      )}

      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background p-6 rounded-lg shadow-xl w-full max-w-md border border-foreground/10">
            <h3 className="font-bold mb-4 text-lg">Agregar nota en página {pageNumber}</h3>
            <textarea 
              className="w-full p-3 border border-foreground/20 rounded mb-4 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              rows={4}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Escribe tu nota aquí..."
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setIsNoteModalOpen(false)} 
                className="px-4 py-2 text-sm hover:bg-foreground/5 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveNote} 
                className="px-4 py-2 bg-foreground text-background rounded text-sm hover:opacity-90 font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {noteListModal.isOpen && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setNoteListModal({ isOpen: false, notes: [] })}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background w-full max-w-md rounded-xl shadow-2xl border border-foreground/10 overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-foreground/10 flex justify-between items-center bg-foreground/5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <MessageSquarePlus size={20} />
                Notas relacionadas
              </h3>
              <button 
                onClick={() => setNoteListModal({ isOpen: false, notes: [] })}
                className="p-1 hover:bg-foreground/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
              {noteListModal.notes.length === 0 ? (
                <div className="text-center py-8 text-foreground/50">
                  <p>No hay notas vinculadas a este texto.</p>
                </div>
              ) : (
                noteListModal.notes.map((note, idx) => (
                  <div key={idx} className="bg-foreground/5 p-3 rounded-lg border border-foreground/5 hover:border-foreground/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="bg-foreground/10 text-xs font-bold px-2 py-1 rounded min-w-[1.5rem] text-center mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.text}</p>
                        <div className="flex items-center justify-between text-xs text-foreground/50 mt-1">
                          {note.page && (
                            <span>Página {note.page}</span>
                          )}
                          <button
                            onClick={() => {
                              setDeleteNoteModal({ isOpen: true, note });
                            }}
                            className="inline-flex items-center gap-1 text-red-500 hover:text-red-400 font-medium"
                            title="Borrar nota"
                          >
                            <Trash2 size={14} />
                            <span>Borrar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 border-t border-foreground/10 bg-background flex justify-end">
              <button 
                onClick={() => setNoteListModal({ isOpen: false, notes: [] })}
                className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteHighlightModal.isOpen && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDeleteHighlightModal({ isOpen: false, targetId: null, message: '' })}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background w-full max-w-sm rounded-xl shadow-2xl border border-foreground/10 overflow-hidden"
          >
            <div className="p-4 border-b border-foreground/10 bg-foreground/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-base">Borrar subrayado</h3>
                <p className="text-xs text-foreground/60">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                {deleteHighlightModal.message || '¿Quieres borrar este subrayado?'}
              </p>
            </div>
            <div className="px-4 pb-4 pt-2 flex justify-end gap-3">
              <button
                onClick={() => setDeleteHighlightModal({ isOpen: false, targetId: null, message: '' })}
                className="px-4 py-2 text-sm rounded-lg hover:bg-foreground/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deleteHighlightModal.targetId !== null) {
                    deleteHighlight(deleteHighlightModal.targetId);
                  }
                  setDeleteHighlightModal({ isOpen: false, targetId: null, message: '' });
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-background hover:bg-red-600 font-medium"
              >
                Borrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteNoteModal.isOpen && (
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDeleteNoteModal({ isOpen: false, note: null })}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background w-full max-w-sm rounded-xl shadow-2xl border border-foreground/10 overflow-hidden"
          >
            <div className="p-4 border-b border-foreground/10 bg-foreground/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-base">Borrar nota</h3>
                <p className="text-xs text-foreground/60">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                {deleteNoteModal.note?.text || '¿Quieres borrar esta nota?'}
              </p>
            </div>
            <div className="px-4 pb-4 pt-2 flex justify-end gap-3">
              <button
                onClick={() => setDeleteNoteModal({ isOpen: false, note: null })}
                className="px-4 py-2 text-sm rounded-lg hover:bg-foreground/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deleteNoteModal.note && typeof deleteNoteModal.note.id !== 'undefined' && deleteNoteModal.note.id !== null && typeof onDeleteAnnotation === 'function') {
                    onDeleteAnnotation(deleteNoteModal.note.id);
                  }
                  if (deleteNoteModal.note) {
                    setNoteListModal(prev => ({
                      ...prev,
                      notes: prev.notes.filter(n => n.id !== deleteNoteModal.note.id)
                    }));
                  }
                  setDeleteNoteModal({ isOpen: false, note: null });
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-background hover:bg-red-600 font-medium"
              >
                Borrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {translatorModal.isOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() =>
            setTranslatorModal({
              isOpen: false,
              text: '',
              activeLang: null,
              loading: false,
              translations: {},
              phonetics: {},
              phoneticsIPA: {},
              error: ''
            })
          }
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background w-full max-w-md rounded-xl shadow-2xl border border-foreground/10 overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-foreground/10 flex justify-between items-center bg-foreground/5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Globe2 size={20} />
                Traducir a español
              </h3>
              <button
                onClick={() =>
                  setTranslatorModal({
                    isOpen: false,
                    text: '',
                    activeLang: null,
                    loading: false,
                    translations: {},
                    phonetics: {},
                    phoneticsIPA: {},
                    error: ''
                  })
                }
                className="p-1 hover:bg-foreground/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-foreground/10">
              <p className="text-xs text-foreground/60 mb-1">Texto seleccionado</p>
              <div className="text-sm bg-foreground/5 rounded-lg px-3 py-2 whitespace-pre-wrap">
                {translatorModal.text}
              </div>
            </div>

            <div className="px-4 pt-3 flex gap-2 flex-wrap">
              {[
                { code: 'en', label: 'Inglés' },
                { code: 'it', label: 'Italiano' },
                { code: 'de', label: 'Alemán' },
                { code: 'ru', label: 'Ruso' }
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => translateText(lang.code)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    translatorModal.activeLang === lang.code
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-foreground/20 hover:bg-foreground/5'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {translatorModal.loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-foreground/60">
                  Traduciendo...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs text-foreground/60">Resultado en español</p>
                    <div className="bg-foreground/5 rounded-lg px-3 py-2 min-h-[4rem] whitespace-pre-wrap text-sm">
                      {translatorModal.translations[translatorModal.activeLang] ||
                        (translatorModal.error || 'Elige un idioma para traducir.')}
                    </div>
                  </div>
                  {translatorModal.translations[translatorModal.activeLang] &&
                    translatorModal.phoneticsIPA[translatorModal.activeLang] && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground/60">Fonética IPA aproximada</p>
                        <div className="bg-foreground/5 rounded-lg px-3 py-2 min-h-[3rem] whitespace-pre-wrap text-xs font-mono">
                          {translatorModal.phoneticsIPA[translatorModal.activeLang]}
                        </div>
                      </div>
                    )}
                  {translatorModal.translations[translatorModal.activeLang] &&
                    translatorModal.phonetics[translatorModal.activeLang] && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground/60">Fonética aproximada castellanizada</p>
                        <div className="bg-foreground/5 rounded-lg px-3 py-2 min-h-[3rem] whitespace-pre-wrap text-xs font-mono">
                          {translatorModal.phonetics[translatorModal.activeLang]}
                        </div>
                      </div>
                    )}
                </div>
              )}
              {translatorModal.error && !translatorModal.loading && (
                <p className="mt-2 text-xs text-red-500">{translatorModal.error}</p>
              )}
            </div>

            <div className="p-4 border-t border-foreground/10 flex justify-end">
              <button
                onClick={() =>
                  setTranslatorModal({
                    isOpen: false,
                    text: '',
                    activeLang: null,
                    loading: false,
                    translations: {},
                    phonetics: {},
                    phoneticsIPA: {},
                    error: ''
                  })
                }
                className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {toast.open && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[140] px-4">
          <div
            className={
              toast.variant === 'success'
                ? 'bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2'
                : toast.variant === 'error'
                ? 'bg-red-500 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2'
                : 'bg-foreground text-background px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2'
            }
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Full Screen FAB */}
      {isFullScreen && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
            <AnimatePresence>
                {isFabMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-background border border-foreground/10 rounded-2xl shadow-2xl p-4 mb-2 flex flex-col gap-4 min-w-[250px]"
                    >
                         {/* Header with Exit */}
                         <div className="flex items-center justify-between border-b border-foreground/10 pb-2">
                            <span className="font-medium text-sm">Controles</span>
                            <button 
                                onClick={() => setIsFullScreen(false)}
                                className="p-1 hover:bg-foreground/5 rounded text-xs flex items-center gap-1 text-red-500 font-medium"
                            >
                                <Shrink size={14} />
                                <span>Salir</span>
                            </button>
                         </div>

                         {/* Page Navigation */}
                         <div className="flex items-center justify-between gap-2">
                            <button disabled={pageNumber <= 1} onClick={() => changePage(-1)} className="p-2 hover:bg-foreground/5 rounded-full disabled:opacity-50"><ChevronLeft size={20}/></button>
                            <span className="text-sm font-medium">{pageNumber} / {numPages || '--'}</span>
                            <button disabled={pageNumber >= numPages} onClick={() => changePage(1)} className="p-2 hover:bg-foreground/5 rounded-full disabled:opacity-50"><ChevronRight size={20}/></button>
                         </div>
                         
                         {/* Zoom */}
                         <div className="flex items-center justify-between gap-2 bg-foreground/5 rounded-lg p-1">
                            <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 hover:bg-background rounded"><ZoomOut size={16}/></button>
                            <span className="text-xs w-8 text-center">{Math.round(scale * 100)}%</span>
                            <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-1 hover:bg-background rounded"><ZoomIn size={16}/></button>
                         </div>

                         {/* Tools Grid */}
                         <div className="grid grid-cols-4 gap-2">
                            <button onClick={() => setActiveTool(activeTool === 'highlight' ? 'none' : 'highlight')} className={`p-2 rounded flex items-center justify-center ${activeTool === 'highlight' ? 'bg-foreground text-background' : 'hover:bg-foreground/5'}`} title="Subrayar"><Highlighter size={18}/></button>
                            <button onClick={() => setActiveTool(activeTool === 'erase' ? 'none' : 'erase')} className={`p-2 rounded flex items-center justify-center ${activeTool === 'erase' ? 'bg-foreground text-background' : 'hover:bg-foreground/5'}`} title="Borrador"><Eraser size={18}/></button>
                            <button onClick={() => setActiveTool(activeTool.startsWith('note') ? 'none' : 'note_rect')} className={`p-2 rounded flex items-center justify-center ${activeTool.startsWith('note') ? 'bg-foreground text-background' : 'hover:bg-foreground/5'}`} title="Nota"><MessageSquarePlus size={18}/></button>
                            <button onClick={clearPageHighlights} className="p-2 hover:bg-foreground/5 rounded flex items-center justify-center text-red-500" title="Limpiar todo"><X size={18}/></button>
                         </div>
                         
                         {/* Additional Note Tools */}
                         {activeTool.startsWith('note') && (
                            <div className="flex items-center gap-2 justify-center bg-foreground/5 p-1 rounded-lg">
                                <button onClick={() => setActiveTool('note_rect')} className={`p-1 rounded ${activeTool === 'note_rect' ? 'bg-background shadow' : ''}`}><Square size={14}/></button>
                                <button onClick={() => setActiveTool('note_circle')} className={`p-1 rounded ${activeTool === 'note_circle' ? 'bg-background shadow' : ''}`}><Circle size={14}/></button>
                            </div>
                         )}

                         {/* View Options */}
                         <div className="flex items-center gap-2 border-t border-foreground/10 pt-2">
                             <select
                                value={animationMode}
                                onChange={e => { setAnimationMode(e.target.value); localStorage.setItem('animationMode', e.target.value); }}
                                className="text-xs border border-foreground/20 rounded px-2 py-1 bg-background flex-1"
                              >
                                <option value="slide">Deslizar</option>
                                <option value="flip">Volteo 3D</option>
                                <option value="curl">Página</option>
                              </select>
                         </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <button
                onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
                className="w-14 h-14 rounded-full bg-foreground text-background shadow-xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
            >
                {isFabMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
      )}

    </div>
  );
};
