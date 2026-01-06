import { useState, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageSquarePlus, Highlighter, Eraser, Maximize, Minimize, MoreHorizontal, Square, Circle } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

export const PDFViewer = ({ file, onAddAnnotation, annotations = [], currentPage, onPageChange }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
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
  const [optionsMenu, setOptionsMenu] = useState({ open: false, x: 0, y: 0, targetId: null });
  const [selectedText, setSelectedText] = useState('');
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  
  // Touch state
  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  // Sync with external page control
  useEffect(() => {
    if (currentPage && currentPage !== pageNumber) {
      setPageNumber(currentPage);
    }
  }, [currentPage]);

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
    setPageNumber(1);
    if (onPageChange) {
      onPageChange(1);
    }
  }

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

  const handleHighlightClick = (e, id) => {
    if (activeTool === 'erase') {
      e.stopPropagation();
      if (window.confirm("¿Estás seguro de querer borrar el subrayado/anotación?")) {
        deleteHighlight(id);
      }
    }
  };

  const clearPageHighlights = () => {
    const next = { ...highlights, [pageNumber]: [] };
    saveHighlights(next);
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

  if (!file) return null;

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto p-4 pt-20">
      <div className="flex items-center flex-wrap gap-3 mb-4 bg-background border border-foreground/10 p-2 rounded-lg shadow-sm sticky top-20 z-20 backdrop-blur-md">
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
      </div>

      <div 
        id="pdf-container"
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="w-full border border-foreground/10 shadow-lg flex justify-center bg-gray-100 dark:bg-gray-900 overflow-auto relative"
        style={{ height: 'calc(100vh - 200px)', perspective: '1500px' }} // viewport-based height minus header/toolbars
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex flex-col items-center w-full min-h-full py-8"
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
                  scale={scale} 
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

                     if (activeTool === 'none') {
                       const sel = window.getSelection();
                       if (!sel) return;
                       const text = sel.toString();
                       if (text && sel.rangeCount > 0) {
                         const range = sel.getRangeAt(0);
                         const overlay = overlayRef.current;
                         if (!overlay) return;
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
                           const next = { ...highlights, [pageNumber]: [...(highlights[pageNumber] || []), hx] };
                           saveHighlights(next);
                           const last = rects[rects.length - 1];
                           setSelectedText(text);
                           
                           // Calculate absolute screen position for menu
                           const overlay = overlayRef.current;
                           const overlayRect = overlay.getBoundingClientRect();
                           const screenX = overlayRect.left + (last.x * overlayRect.width) + (last.w * overlayRect.width) / 2;
                           const screenY = overlayRect.top + (last.y * overlayRect.height);

                           setOptionsMenu({
                             open: true,
                             x: last.x, // keep relative for reference
                             y: last.y,
                             screenX,
                             screenY,
                             targetId: id
                           });
                           try { sel.removeAllRanges(); } catch {}
                         }
                       }
                     }
                   }}
                   className="absolute inset-0 z-10"
                   style={{ 
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
                            setNoteText(a.text);
                            // Maybe open read-only modal or just reuse modal?
                            // For now just alert or use existing logic if any
                            // Let's use the modal but maybe we need a "View Note" mode?
                            // Using alert for simplicity as requested "ver sus anotaciones"
                            alert(a.text); 
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
                             onClick={(e) => handleHighlightClick(e, h.id)}
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
                             onClick={(e) => handleHighlightClick(e, h.id)}
                           />
                         )}
                         <button
                           onClick={(e) => {
                             if (activeTool === 'erase') {
                               handleHighlightClick(e, h.id);
                               return;
                             }
                             e.stopPropagation();
                             const btnRect = e.currentTarget.getBoundingClientRect();
                             setOptionsMenu({ 
                               open: true, 
                               x: lastRect.x, 
                               y: lastRect.y, 
                               screenX: btnRect.left + btnRect.width / 2,
                               screenY: btnRect.top,
                               targetId: h.id 
                             });
                             setSelectedText(h.text || '');
                           }}
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
                const q = encodeURIComponent(text);
                window.open(`https://www.google.com/search?q=${q}`, '_blank');
              } else {
                alert("No hay texto seleccionado para buscar.");
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
    </div>
  );
};
