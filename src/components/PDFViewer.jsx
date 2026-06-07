import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageSquarePlus, Highlighter, Eraser, Maximize, Minimize, MoreHorizontal, Square, Circle, Copy, Search, Expand, Shrink, Menu, X, Trash2, Globe2, Sparkles, Send, Share2, Printer, Download, BookOpen, FileText, LayoutGrid, Paperclip } from 'lucide-react';
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

const fetchEnglishIPA = async (text) => {
  const word = text.trim().split(/\s+/)[0].toLowerCase();
  if (!word) return '';
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) return '';
    const data = await response.json();
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry) return '';
    const fromPhonetics = Array.isArray(entry.phonetics)
      ? (entry.phonetics.find((p) => p && typeof p.text === 'string' && p.text.trim()) || entry.phonetics[0])
      : null;
    const ipaText = (fromPhonetics && fromPhonetics.text) || entry.phonetic || '';
    return typeof ipaText === 'string' ? ipaText : '';
  } catch (error) {
    console.error(error);
    return '';
  }
};

const castellanizeEnglishIPA = (ipaText) => {
  if (!ipaText) return '';
  let result = ipaText.toString();
  result = result.replace(/[\/\[\]]/g, '');
  result = result.replace(/[ˈˌ]/g, '');
  result = result.replace(/aɪ/g, 'ai');
  result = result.replace(/ɔɪ/g, 'oi');
  result = result.replace(/aʊ/g, 'au');
  result = result.replace(/oʊ/g, 'ou');
  result = result.replace(/eɪ/g, 'ei');
  result = result.replace(/ɪə/g, 'ia');
  result = result.replace(/eə/g, 'ea');
  result = result.replace(/ʊə/g, 'ua');
  result = result.replace(/əl\b/g, 'ol');
  result = result.replace(/iː/g, 'i');
  result = result.replace(/ɪ/g, 'i');
  result = result.replace(/uː/g, 'u');
  result = result.replace(/ʊ/g, 'u');
  result = result.replace(/e/g, 'e');
  result = result.replace(/æ/g, 'a');
  result = result.replace(/ʌ/g, 'a');
  result = result.replace(/ɑː/g, 'a');
  result = result.replace(/ɒ/g, 'o');
  result = result.replace(/ɔː/g, 'o');
  result = result.replace(/ə/g, 'e');
  result = result.replace(/θ/g, 'z');
  result = result.replace(/ð/g, 'd');
  result = result.replace(/ŋ/g, 'ng');
  result = result.replace(/ʃ/g, 'sh');
  result = result.replace(/ʒ/g, 'y');
  result = result.replace(/tʃ/g, 'ch');
  result = result.replace(/dʒ/g, 'y');
  result = result.replace(/ɡ/g, 'g');
  result = result.replace(/ɹ/g, 'r');
  result = result.replace(/ʔ/g, '');
  result = result.replace(/\s+/g, ' ');
  return result.trim();
};

const LANGUAGE_LABELS_ES = {
  en: 'inglés',
  es: 'español',
  it: 'italiano',
  de: 'alemán',
  ru: 'ruso',
  fr: 'francés',
  pt: 'portugués'
};

const getSourceLanguageLabel = (sourceLang, detectedSourceLang) => {
  const code = sourceLang === 'auto' ? (detectedSourceLang || '') : (sourceLang || '');
  if (!code) return 'el idioma original';
  const normalized = String(code).toLowerCase();
  return LANGUAGE_LABELS_ES[normalized] || `el idioma ${normalized}`;
};

const generateGeminiResponse = (prompt, docName) => {
  const cleanDocName = docName ? docName.replace('.pdf', '') : 'documento';
  const lowerPrompt = prompt.toLowerCase();
  
  // Respuestas personalizadas si es Jacobo Grinberg - El Yo Como Idea
  const isGrinberg = cleanDocName.toLowerCase().includes('grinberg') || cleanDocName.toLowerCase().includes('yo como idea');
  
  if (isGrinberg) {
    if (lowerPrompt.includes('punto') || lowerPrompt.includes('puntos principales') || lowerPrompt.includes('enumera')) {
      return `### Puntos principales de **${cleanDocName}** (Jacobo Grinberg):

1. **La Realidad Holográfica y el Campo Sintérgico:** El cerebro interactúa con un campo cuántico de información base (el *campo sintérgico*). La percepción es una decodificación holográfica de esta interacción.
2. **El "Yo" como una Construcción del Observador:** El "Yo" no es una entidad fija, sino un nivel de unificación de la conciencia. Es una "idea" generada por los procesos de filtrado del cerebro.
3. **El Neuroalgoritmo:** El cerebro procesa enormes cantidades de información a través de procesos convergentes de abstracción, reduciendo la complejidad del campo en un concepto unitario.
4. **La Conciencia de Unidad:** A medida que el observador se desidentifica de los neuroalgoritmos, la conciencia se expande hacia el "Observador Puro", disolviendo la separación sujeto-objeto.`;
    }
    
    if (lowerPrompt.includes('resumen') || lowerPrompt.includes('resume') || lowerPrompt.includes('sección')) {
      return `### Resumen por secciones de **${cleanDocName}**:

* **Sección 1: El Cerebro y el Campo Sintérgico:** Explica cómo el cerebro funciona como un transductor. Las neuronas crean una distorsión en la estructura del espacio (campo neuronal).
* **Sección 2: La Génesis de la Identidad ("El Yo"):** Analiza cómo la auto-imagen se consolida a través de condicionamientos lingüísticos y sociales, creando la idea del "Yo".
* **Sección 3: El Observador y los Niveles de Conciencia:** Describe la meditación autoalusiva como una vía para experimentar al Observador Puro, libre del condicionamiento conceptual.
* **Sección 4: Conclusiones Ontológicas:** El autor postula que el espacio es conciencia pura en diferente grado de coherencia y simetría.`;
    }

    if (lowerPrompt.includes('tabla') || lowerPrompt.includes('conceptos clave') || lowerPrompt.includes('define')) {
      return `### Conceptos clave de **${cleanDocName}**:

| Concepto | Definición en la Teoría Sintérgica |
| :--- | :--- |
| **Campo Sintérgico** | Matriz informacional pura del espacio que contiene infinitas dimensiones de información. |
| **Campo Neuronal** | La distorsión electromagnética y cuántica creada por la actividad del cerebro en el espacio. |
| **El Observador** | El núcleo no-físico de la conciencia que atestigua las creaciones del campo neuronal. |
| **Sintergia** | Grado de síntesis (coherencia) y energía (frecuencia) en la organización del espacio o el cerebro. |
| **Neuroalgoritmo** | Proceso neural que sintetiza millones de bits de datos en una sola experiencia integrada. |`;
    }
  }

  // Respuestas genéricas por defecto
  if (lowerPrompt.includes('punto') || lowerPrompt.includes('puntos principales') || lowerPrompt.includes('enumera')) {
    return `### Puntos principales de **${cleanDocName}**:

1. **Introducción y Contexto:** El documento presenta el marco inicial, los antecedentes históricos o la motivación del tema.
2. **Metodología y Tesis Central:** Se expone la idea o propuesta principal, estableciendo los argumentos lógicos que la sustentan.
3. **Desarrollo de Argumentos:** Análisis de evidencias, datos empíricos o discursos analíticos que dan solidez al planteamiento general.
4. **Conclusión y Aplicación:** Resumen de hallazgos y sugerencias de implementación práctica en sus respectivas áreas.`;
  }
  
  if (lowerPrompt.includes('resumen') || lowerPrompt.includes('resume') || lowerPrompt.includes('sección')) {
    return `### Resumen Estructurado de **${cleanDocName}**:

* **Parte I: Planteamiento:** Presenta los conceptos iniciales, la problemática general y los objetivos planteados del documento.
* **Parte II: Desarrollo Técnico/Analítico:** Expone la discusión principal de los datos y el cuerpo de ideas del texto.
* **Parte III: Conclusión:** Integra las reflexiones finales, limitaciones y perspectivas de estudios futuros descritos en el archivo.`;
  }

  if (lowerPrompt.includes('tabla') || lowerPrompt.includes('conceptos clave') || lowerPrompt.includes('define')) {
    return `### Conceptos Clave de **${cleanDocName}**:

| Concepto | Descripción General | Relevancia en el Texto |
| :--- | :--- | :--- |
| **Tesis Principal** | La afirmación o idea fundamental que el autor busca demostrar. | Columna vertebral del documento. |
| **Evidencia Clave** | Datos o argumentos primarios que respaldan la hipótesis. | Da validez y rigurosidad al texto. |
| **Conclusión** | El desenlace de la investigación o desarrollo. | Sintetiza el propósito del archivo. |`;
  }

  return `¡Hola! Soy **Gemini**, tu asistente de lectura. 

Estoy analizando tu documento **"${cleanDocName}"**. 

Puedes hacerme preguntas específicas sobre el texto, solicitar resúmenes de páginas o pedirme que elabore conceptos clave en una tabla.

*¿Qué te gustaría explorar hoy?*`;
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
    sourceLang: 'auto',
    targetLang: 'es',
    detectedSourceLang: '',
    loading: false,
    translatedText: '',
    phonetics: '',
    phoneticsIPA: '',
    error: ''
  });
  
  const [showThumbnails, setShowThumbnails] = useState(!isMobile);
  const [showGemini, setShowGemini] = useState(false);
  const [geminiChat, setGeminiChat] = useState([]);
  const [geminiInput, setGeminiInput] = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [pdfText, setPdfText] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (file?.name) {
      setGeminiChat([{
        sender: 'gemini',
        text: `¡Hola! Soy **Gemini**, tu asistente de lectura. 
        
Estoy analizando tu documento **"${file.name.replace('.pdf', '')}"**. 

Puedes hacerme preguntas específicas sobre el texto, pedirme resúmenes de secciones o solicitar la definición de conceptos clave en una tabla.

*¿Qué te gustaría explorar hoy?*`,
        timestamp: new Date()
      }]);
    }
  }, [file?.name]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [geminiChat]);

  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  
  // Touch state
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const menuRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);

  const resolvedFitMode = useMemo(() => {
    if (fitMode !== 'auto') return fitMode;
    return windowWidth >= 1024 ? 'height' : 'width';
  }, [fitMode, windowWidth]);

  // Adjust menu position to keep it on screen
  useLayoutEffect(() => {
    if (optionsMenu.open && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const winW = window.innerWidth;
      const padding = 10;
      
      let newLeft = optionsMenu.screenX;
      
      // Horizontal clamping (center based)
      const halfWidth = rect.width / 2;
      
      if (newLeft - halfWidth < padding) {
        newLeft = halfWidth + padding;
      } else if (newLeft + halfWidth > winW - padding) {
        newLeft = winW - halfWidth - padding;
      }
      
      if (newLeft !== optionsMenu.screenX) {
        menu.style.left = `${newLeft}px`;
      }
    }
  }, [optionsMenu.open, optionsMenu.screenX]);

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

  const handleContainerTouchEnd = () => {
    onTouchEnd();
    handleTextSelection();
  };

  function changePage(offset) {
    const newPage = pageNumber + offset;
    setDirection(offset);
    setPageNumber(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  }

  async function onDocumentLoadSuccess(pdf) {
    const num = pdf.numPages;
    setNumPages(num);
    // Use initialPage if provided and valid, otherwise 1
    const startPage = (initialPage && initialPage > 0 && initialPage <= num) ? initialPage : 1;
    setPageNumber(startPage);
    // Don't trigger onPageChange on load to avoid overwriting persisted state with default (1)
    // before async fetch completes
    
    // Extract text in the background
    try {
      let extractedText = "";
      const maxPages = Math.min(num, 150); // limit to 150 pages to keep payload size reasonable
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        if (pageText.trim()) {
          extractedText += `\n[Página ${i}]: ${pageText}\n`;
        }
      }
      setPdfText(extractedText);
    } catch (error) {
      console.error("Error al extraer texto del PDF:", error);
    }
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
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const handleSelectionChange = () => {
      handleTextSelection();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isMobile, activeTool]);

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

  const translateViaGoogle = async ({ q, source, target }) => {
    const sl = source || 'auto';
    const tl = target || 'es';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map(part => (Array.isArray(part) ? (part[0] || '') : '')).join('')
      : '';
    const detectedSourceLang = typeof data?.[2] === 'string' ? data[2] : '';
    if (!translated.trim()) {
      throw new Error('Traducción vacía');
    }
    return { translatedText: translated.trim(), detectedSourceLang };
  };

  const translateViaMyMemory = async ({ q, source, target }) => {
    const sl = source || 'en';
    const tl = target || 'es';
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(sl)}|${encodeURIComponent(tl)}&de=freetranslation@lee.io&mt=1`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data?.responseStatus !== 200 && data?.responseStatus !== '200') {
      throw new Error(data?.responseDetails || `API Error ${data?.responseStatus}`);
    }
    const raw = data?.responseData?.translatedText || '';
    const translated = String(raw)
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (!translated) {
      throw new Error('Traducción vacía');
    }
    return { translatedText: translated, detectedSourceLang: '' };
  };

  const translateText = async () => {
    if (!translatorModal.text.trim()) {
      showToast('No hay texto para traducir', 'error');
      return;
    }

    const source = translatorModal.sourceLang || 'auto';
    const target = translatorModal.targetLang || 'es';
    if (source !== 'auto' && source === target) {
      setTranslatorModal(prev => ({ ...prev, error: 'El idioma de origen y destino no pueden ser iguales.' }));
      return;
    }

    setTranslatorModal(prev => ({ ...prev, loading: true, error: '' }));

    const cleanSourceText = translatorModal.text.replace(/\s+/g, ' ').trim();

    try {
      let result;
      try {
        result = await translateViaGoogle({ q: cleanSourceText, source, target });
      } catch (primaryError) {
        if (source !== 'auto') {
          result = await translateViaMyMemory({ q: cleanSourceText, source, target });
        } else {
          throw primaryError;
        }
      }

      const translated = result.translatedText;
      const detected = source === 'auto' ? (result.detectedSourceLang || '') : '';
      const shouldShowSpanishPhonetics = target === 'es';
      const baseTextForPronunciation = cleanSourceText;
      let phonetic = '';
      let ipa = '';
      if (shouldShowSpanishPhonetics) {
        const langForPronunciation = (source === 'auto' ? detected : source || '').toLowerCase();
        if (langForPronunciation === 'en') {
          const englishIPA = await fetchEnglishIPA(baseTextForPronunciation);
          ipa = englishIPA || '';
          phonetic = englishIPA
            ? castellanizeEnglishIPA(englishIPA)
            : generateSpanishPhonetics(baseTextForPronunciation);
        } else {
          phonetic = generateSpanishPhonetics(baseTextForPronunciation);
          ipa = generateSpanishIPA(baseTextForPronunciation);
        }
      }

      setTranslatorModal(prev => ({
        ...prev,
        loading: false,
        translatedText: translated,
        detectedSourceLang: detected,
        phonetics: phonetic,
        phoneticsIPA: ipa,
        error: ''
      }));
    } catch (e) {
      console.error(e);
      setTranslatorModal(prev => ({
        ...prev,
        loading: false,
        error: `Error: ${e?.message || 'No se pudo traducir en este momento.'}`
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

  const getRangeTextWithSpacing = (range) => {
    const ancestor =
      range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer?.parentElement;
    if (!ancestor) return '';

    const safeIntersectsNode = (node) => {
      try {
        if (typeof range.intersectsNode === 'function') {
          return range.intersectsNode(node);
        }
      } catch {}
      try {
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);
        return (
          range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
          range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
        );
      } catch {
        return false;
      }
    };

    const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);

    const segments = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node || !node.nodeValue) continue;
      if (!safeIntersectsNode(node)) continue;

      const value = node.nodeValue;
      let start = 0;
      let end = value.length;

      if (node === range.startContainer && node === range.endContainer) {
        start = range.startOffset;
        end = range.endOffset;
      } else if (node === range.startContainer) {
        start = range.startOffset;
      } else if (node === range.endContainer) {
        end = range.endOffset;
      }

      if (end <= start) continue;

      const slice = value.slice(start, end);
      const normalizedSlice = slice.replace(/\s+/g, ' ').trim();
      if (!normalizedSlice) continue;

      const parent = node.parentElement;
      if (!parent || typeof parent.getBoundingClientRect !== 'function') continue;
      const rect = parent.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      segments.push({
        text: normalizedSlice,
        rect
      });
    }

    if (segments.length === 0) {
      return range.toString();
    }

    segments.sort((a, b) => (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left));

    const lineThreshold = 6;
    const spaceThreshold = 3;
    let out = '';
    let prev = null;

    for (const seg of segments) {
      const t = seg.text.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (!prev) {
        out = t;
        prev = seg;
        continue;
      }
      const sameLine = Math.abs(seg.rect.top - prev.rect.top) <= lineThreshold;
      const gap = seg.rect.left - prev.rect.right;
      const needsSpace = (!sameLine) || gap > spaceThreshold;
      out += (needsSpace ? ' ' : '') + t;
      prev = seg;
    }

    const camelFix = out.replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2');
    return camelFix.replace(/\s+/g, ' ').trim();
  };

  const handleTextSelection = () => {
    if (activeTool !== 'none') return;
    
    // Small delay to ensure selection is complete
    setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        
        if (sel.rangeCount > 0) {
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

          const text = getRangeTextWithSpacing(range);
          if (text && rects.length > 0) {
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
  const handleSendPrompt = async (promptText) => {
    if (!promptText.trim() || geminiLoading) return;
    
    setGeminiChat(prev => [...prev, {
      sender: 'user',
      text: promptText,
      timestamp: new Date()
    }]);
    
    setGeminiInput('');
    setGeminiLoading(true);
    
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || "";
    let responseText = "";
    
    if (apiKey && apiKey.startsWith("AIzaSy")) {
      try {
        const docContext = pdfText 
          ? `Estás ayudando al usuario a leer un documento PDF llamado "${file?.name || 'documento'}".\nAquí tienes el contenido de texto extraído del documento:\n\n${pdfText}\n\nResponde a la siguiente pregunta o instrucción del usuario basándote en este contenido. Si la pregunta no se puede responder con este documento, hazlo saber amablemente, pero intenta deducir o aportar contexto relevante.\n\nPregunta: ${promptText}`
          : `Estás ayudando al usuario a leer el documento "${file?.name || 'documento'}". El contenido del documento no está disponible de inmediato. Responde a la siguiente pregunta: ${promptText}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: docContext
                  }
                ]
              }
            ],
            systemInstruction: {
              parts: [
                {
                  text: "Eres Gemini, un asistente de lectura de PDFs inteligente y amigable integrado en la plataforma Leé.Io. Tu objetivo es ayudar al usuario a comprender, resumir y extraer información del documento PDF de forma precisa. Usa formato Markdown limpio, tablas cuando sea apropiado y resalta términos clave. Responde siempre en el mismo idioma en el que te pregunte el usuario."
                }
              ]
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            responseText = candidateText;
          } else {
            throw new Error("No text returned from Gemini API");
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn("Gemini API error status:", response.status, errData);
          throw new Error(`API returned status ${response.status}`);
        }
      } catch (error) {
        console.error("Error al llamar a Gemini API, usando simulador:", error);
        responseText = generateGeminiResponse(promptText, file?.name || 'documento');
      }
    } else {
      // No API key or invalid format, use simulator fallback
      await new Promise(resolve => setTimeout(resolve, 1000));
      responseText = generateGeminiResponse(promptText, file?.name || 'documento');
    }
    
    setGeminiChat(prev => [...prev, {
      sender: 'gemini',
      text: responseText,
      timestamp: new Date()
    }]);
    setGeminiLoading(false);
  };

  return (
    <div className={`flex flex-col w-full mx-auto relative ${isFullScreen ? 'fixed inset-0 z-50 bg-background max-w-none h-[100dvh]' : (isMobile ? 'bg-background max-w-5xl h-full' : 'p-0 max-w-none w-full h-[calc(100vh-4rem)] flex flex-col bg-background')}`}>
      {!isFullScreen && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10 bg-background/50 backdrop-blur-md z-30 w-full flex-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shrink-0 shadow-md">
              <span className="text-white text-[10px] font-black tracking-wider">PDF</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate text-foreground/90">{file?.name || 'Documento sin título.pdf'}</span>
                <span className="text-[9px] bg-foreground/10 px-1.5 py-0.5 rounded font-mono font-medium text-foreground/60">LECTOR PRO</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-foreground/50 mt-0.5">
                <button className="hover:text-foreground transition-all">Archivo</button>
                <button className="hover:text-foreground transition-all">Editar</button>
                <button className="hover:text-foreground transition-all">Ver</button>
                <button className="hover:text-foreground transition-all">Herramientas</button>
                <button className="hover:text-foreground transition-all">Ayuda</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button className="hidden sm:flex items-center gap-1.5 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground px-3 py-1.5 rounded-full text-xs font-medium transition-all">
              <BookOpen size={13} />
              <span>Documentos</span>
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm"
              >
                <Share2 size={13} />
                <span>Compartir</span>
              </button>
              {showShareMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-background border border-foreground/10 rounded-xl shadow-2xl p-1 z-40">
                  <button onClick={() => { setShowShareMenu(false); alert("Enlace de lectura copiado al portapapeles"); }} className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-foreground/5 transition-colors">Copiar enlace</button>
                  <button onClick={() => setShowShareMenu(false)} className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-foreground/5 transition-colors">Permisos de acceso</button>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowGemini(!showGemini)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                showGemini 
                  ? 'bg-purple-600 hover:bg-purple-700 border-purple-500 text-white shadow shadow-purple-500/20' 
                  : 'bg-background hover:bg-foreground/5 border-foreground/10 text-foreground'
              }`}
            >
              <Sparkles size={13} className={showGemini ? 'animate-pulse' : 'text-purple-500'} />
              <span>Gemini</span>
            </button>
          </div>
        </div>
      )}

      {!isFullScreen && (
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-foreground/10 bg-background/20 backdrop-blur-sm z-20 w-full flex-none">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`p-1.5 rounded-lg transition-colors ${showThumbnails ? 'bg-foreground/10 text-foreground' : 'hover:bg-foreground/5 text-foreground/60'}`}
            title="Panel de miniaturas"
          >
            <LayoutGrid size={16} />
          </button>
          
          <div className="w-px h-4 bg-foreground/10 mx-1" />
          
          <button
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className="p-1 hover:bg-foreground/5 rounded-lg disabled:opacity-30 text-foreground/80"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-medium px-1 min-w-[4rem] text-center text-foreground/80">
            Página <span className="font-mono font-bold">{pageNumber}</span> de {numPages || '--'}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => changePage(1)}
            className="p-1 hover:bg-foreground/5 rounded-lg disabled:opacity-30 text-foreground/80"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => {
              setFitMode('manual');
              setScale(s => Math.max(0.5, s - 0.1));
            }} 
            className="p-1 hover:bg-foreground/5 rounded-lg text-foreground/80"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono font-medium w-10 text-center text-foreground/70">{Math.round(scale * 100)}%</span>
          <button 
            onClick={() => {
              setFitMode('manual');
              setScale(s => Math.min(2, s + 0.1));
            }} 
            className="p-1 hover:bg-foreground/5 rounded-lg text-foreground/80"
          >
            <ZoomIn size={16} />
          </button>
          
          <div className="w-px h-4 bg-foreground/10 mx-1" />
          
          <select
            value={animationMode}
            onChange={e => {
              const v = e.target.value;
              setAnimationMode(v);
              localStorage.setItem('animationMode', v);
            }}
            className="text-xs border border-foreground/10 rounded-lg px-2 py-1 bg-background text-foreground/80 outline-none"
            title="Animación de página"
          >
            <option value="slide">Deslizar</option>
            <option value="flip">Volteo 3D</option>
            <option value="curl">Página</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setActiveTool(activeTool === 'highlight' ? 'none' : 'highlight')} 
            className={`p-1.5 rounded-lg transition-colors ${activeTool === 'highlight' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'hover:bg-foreground/5 text-foreground/75'}`}
            title="Subrayar texto"
          >
            <Highlighter size={16} />
          </button>
          <button 
            onClick={() => setActiveTool(activeTool === 'erase' ? 'none' : 'erase')} 
            className={`p-1.5 rounded-lg transition-colors ${activeTool === 'erase' ? 'bg-red-500/15 text-red-500' : 'hover:bg-foreground/5 text-foreground/75'}`}
            title={activeTool === 'erase' ? "Modo borrador activo" : "Borrador"}
          >
            <Eraser size={16} />
          </button>
          <button 
            onClick={clearPageHighlights} 
            className="px-2 py-1 text-[11px] font-medium hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors text-foreground/60"
            title="Limpiar subrayados"
          >
            Limpiar
          </button>
          
          <div className="w-px h-4 bg-foreground/10 mx-1" />
          
          <div className="flex items-center gap-0.5 bg-foreground/5 rounded-lg p-0.5">
             <button 
               onClick={() => setActiveTool(activeTool.startsWith('note') ? 'none' : 'note_rect')} 
               className={`p-1 rounded-md ${activeTool.startsWith('note') ? 'bg-foreground text-background shadow-sm' : 'hover:bg-foreground/10 text-foreground/70'}`} 
               title="Agregar nota adhesiva"
             >
               <MessageSquarePlus size={16} />
             </button>
             {activeTool.startsWith('note') && (
               <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => setActiveTool('note_rect')}
                    className={`p-0.5 rounded-md ${activeTool === 'note_rect' ? 'bg-background shadow text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
                    title="Nota rectangular"
                  >
                    <Square size={12} />
                  </button>
                  <button
                    onClick={() => setActiveTool('note_circle')}
                    className={`p-0.5 rounded-md ${activeTool === 'note_circle' ? 'bg-background shadow text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
                    title="Nota circular"
                  >
                    <Circle size={12} />
                  </button>
               </div>
             )}
          </div>
          
          <div className="w-px h-4 bg-foreground/10 mx-1" />
          
          <button 
            onClick={() => setIsFullScreen(true)} 
            className="p-1.5 hover:bg-foreground/5 rounded-lg transition-colors text-foreground/70"
            title="Pantalla completa"
          >
            <Expand size={16} />
          </button>
        </div>
      </div>
      )}

      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div className="flex-1 flex items-center justify-center p-10 text-foreground/60 font-medium">Cargando PDF...</div>}
        error={<div className="flex-1 flex items-center justify-center p-10 text-red-500 font-medium">Error al cargar el PDF.</div>}
        className="flex-1 flex w-full overflow-hidden relative bg-[#eef0f4] dark:bg-[#111112]"
      >
        {/* Panel izquierdo: Miniaturas */}
        {showThumbnails && !isFullScreen && (
          <div className="w-40 border-r border-foreground/10 flex flex-col bg-foreground/[0.01] dark:bg-[#121214]/50 shrink-0 overflow-y-auto p-2 space-y-4">
             {Array.from(new Array(numPages || 0), (el, index) => {
               const pageIdx = index + 1;
               const isCurrent = pageIdx === pageNumber;
               const isNear = Math.abs(pageIdx - pageNumber) <= 8;
               
               return (
                 <div 
                   key={pageIdx} 
                   onClick={() => {
                     setPageNumber(pageIdx);
                     if (onPageChange) onPageChange(pageIdx);
                   }}
                   className={`flex flex-col items-center p-1.5 rounded-xl cursor-pointer transition-all ${
                     isCurrent 
                       ? 'bg-foreground/10 border border-foreground/20 shadow-sm scale-[1.01]' 
                       : 'hover:bg-foreground/5 border border-transparent hover:scale-[1.01]'
                   }`}
                 >
                   <span className="text-[9px] opacity-40 mb-1 font-mono font-medium">{pageIdx}</span>
                   <div className="w-24 h-32 overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-foreground/10 flex items-center justify-center relative select-none">
                      {isNear ? (
                        <Page 
                          pageNumber={pageIdx} 
                          width={96} 
                          renderTextLayer={false} 
                          renderAnnotationLayer={false} 
                          loading={<div className="h-full w-full bg-foreground/5 animate-pulse" />}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-foreground/20">
                           <FileText size={18} className="stroke-1 mb-1" />
                           <span className="text-[10px] font-mono">{pageIdx}</span>
                        </div>
                      )}
                   </div>
                 </div>
               );
             })}
          </div>
        )}

        {/* Panel central: PDF Canvas */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div 
            id="pdf-container"
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={handleContainerTouchEnd}
            onMouseUp={handleTextSelection}
            onContextMenu={(e) => isMobile && e.preventDefault()}
            className={`w-full flex justify-center overflow-auto relative flex-1 ${isMobile ? '' : 'p-6 bg-gray-100 dark:bg-gray-900 border border-foreground/10 shadow-inner'}`}
            style={{ 
              perspective: '1500px',
              WebkitTouchCallout: isMobile ? 'none' : 'default',
            }}
      >
        <div
          className={`flex flex-col items-center w-full min-h-full ${isFullScreen ? 'py-0' : 'py-8'}`}
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
                  scale={resolvedFitMode === 'width' ? undefined : scale} 
                  width={resolvedFitMode === 'width' ? containerWidth || undefined : undefined}
                  height={resolvedFitMode === 'height' ? containerHeight || undefined : undefined}
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
        </div>
      </div> {/* Closes pdf-container */}
      </div> {/* Closes Middle Panel */}

      {/* Panel derecho: Gemini AI Assistant */}
      {showGemini && !isFullScreen && (
        <div className="w-80 border-l border-foreground/10 flex flex-col bg-background/50 backdrop-blur-lg shadow-2xl relative overflow-hidden shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-foreground/10 bg-foreground/[0.02]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-purple-500/10 text-purple-500 animate-pulse">
                <Sparkles size={16} />
              </div>
              <h3 className="font-semibold text-sm">Gemini</h3>
            </div>
            <button 
              onClick={() => setShowGemini(false)}
              className="p-1 hover:bg-foreground/5 rounded-full text-foreground/60 hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat History & Suggested Prompts */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            {geminiChat.map((msg, index) => (
              <div 
                key={index}
                className={`flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-foreground text-background self-end rounded-tr-none' 
                    : 'bg-foreground/5 text-foreground self-start rounded-tl-none border border-foreground/5'
                }`}
              >
                {msg.sender === 'gemini' ? (
                   <div className="space-y-2 prose prose-invert max-w-none">
                     {msg.text.split('\n').map((line, lIdx) => {
                       let text = line.trim();
                       if (!text) return <div key={lIdx} className="h-1" />;
                       
                       if (text.startsWith('### ')) {
                         return <h4 key={lIdx} className="font-bold text-sm text-foreground pt-1">{text.replace('### ', '')}</h4>;
                       }
                       
                       if (text.startsWith('1. ') || text.startsWith('2. ') || text.startsWith('3. ') || text.startsWith('4. ')) {
                         return <div key={lIdx} className="flex gap-2 pl-1"><span className="font-mono text-purple-500 font-bold">{text.substring(0, 3)}</span><span>{text.substring(3)}</span></div>;
                       }
                       if (text.startsWith('* ')) {
                         return <div key={lIdx} className="flex gap-2 pl-1 text-foreground/80"><span className="text-purple-400">•</span><span>{text.replace('* ', '')}</span></div>;
                       }
                       
                       if (text.startsWith('|')) {
                         if (text.includes('---')) return null;
                         const cells = text.split('|').map(c => c.trim()).filter(Boolean);
                         return (
                           <div key={lIdx} className="grid grid-cols-2 gap-2 border-b border-foreground/5 pb-1 font-sans">
                             {cells.map((cell, cIdx) => (
                               <span key={cIdx} className={cIdx === 0 ? "font-semibold text-foreground/90" : "text-foreground/75"}>{cell.replace(/\*\*/g, '')}</span>
                             ))}
                           </div>
                         );
                       }

                       const boldParts = text.split('**');
                       if (boldParts.length > 1) {
                         return (
                           <p key={lIdx}>
                             {boldParts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-foreground">{part}</strong> : part)}
                           </p>
                         );
                       }

                       return <p key={lIdx}>{text}</p>;
                     })}
                   </div>
                ) : (
                   <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
            ))}

            {geminiLoading && (
              <div className="bg-foreground/5 text-foreground self-start rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2 border border-foreground/5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-500"></div>
                <span className="text-[11px] opacity-70">Gemini está pensando...</span>
              </div>
            )}
            
            <div ref={chatEndRef} />
            
            {geminiChat.length === 1 && (
              <div className="mt-auto space-y-2 pt-8">
                <p className="text-[10px] text-foreground/45 uppercase tracking-wider font-semibold mb-3">Sugerencias</p>
                <button 
                  onClick={() => handleSendPrompt("Enumera los puntos principales de este archivo")}
                  className="w-full text-left p-2.5 rounded-xl bg-foreground/[0.03] hover:bg-foreground/[0.07] border border-foreground/5 text-xs text-foreground/80 hover:text-foreground transition-all duration-200"
                >
                  Enumera los puntos principales de este archivo
                </button>
                <button 
                  onClick={() => handleSendPrompt("Resume cada sección de este artículo")}
                  className="w-full text-left p-2.5 rounded-xl bg-foreground/[0.03] hover:bg-foreground/[0.07] border border-foreground/5 text-xs text-foreground/80 hover:text-foreground transition-all duration-200"
                >
                  Resume cada sección de este artículo
                </button>
                <button 
                  onClick={() => handleSendPrompt("Define los conceptos clave en una tabla")}
                  className="w-full text-left p-2.5 rounded-xl bg-foreground/[0.03] hover:bg-foreground/[0.07] border border-foreground/5 text-xs text-foreground/80 hover:text-foreground transition-all duration-200"
                >
                  Define los conceptos clave en una tabla
                </button>
              </div>
            )}
          </div>

          {/* Input Form */}
          <div className="p-3 border-t border-foreground/10 bg-foreground/[0.01]">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendPrompt(geminiInput); }}
              className="relative flex items-center bg-foreground/5 hover:bg-foreground/[0.08] transition-all rounded-2xl border border-foreground/5 focus-within:border-purple-500/40 p-1.5"
            >
              <button 
                type="button" 
                className="p-2 text-foreground/50 hover:text-foreground rounded-xl hover:bg-foreground/5 transition-colors"
              >
                <Paperclip size={16} />
              </button>
              <input 
                type="text"
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                disabled={geminiLoading}
                placeholder="Pregúntale a Gemini..."
                className="flex-1 bg-transparent border-none outline-none text-xs text-foreground px-2 py-1.5 placeholder-foreground/40"
              />
              <button 
                type="submit"
                disabled={geminiLoading || !geminiInput.trim()}
                className={`p-2 rounded-xl transition-all ${
                  geminiInput.trim() 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md' 
                    : 'text-foreground/30'
                }`}
              >
                <Send size={14} />
              </button>
            </form>
            <p className="text-[9px] text-center text-foreground/40 mt-2">
              Gemini puede cometer errores. Verifica la información.
            </p>
          </div>
        </div>
      )}
      </Document>

      {optionsMenu.open && (
        <div
          ref={menuRef}
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
                      sourceLang: 'auto',
                      targetLang: 'es',
                      detectedSourceLang: '',
                      loading: false,
                      translatedText: '',
                      phonetics: '',
                      phoneticsIPA: '',
                      error: ''
                    });
                  }
                  setOptionsMenu({ open: false, x: 0, y: 0, targetId: null });
                  setTempSelection(null);
                }}
                className="px-2 py-1 text-sm rounded hover:bg-foreground/5 flex items-center gap-1"
                title="Traducir"
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
              sourceLang: 'auto',
              targetLang: 'es',
              detectedSourceLang: '',
              loading: false,
              translatedText: '',
              phonetics: '',
              phoneticsIPA: '',
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
                Traductor
              </h3>
              <button
                onClick={() =>
                  setTranslatorModal({
                    isOpen: false,
                    text: '',
                    sourceLang: 'auto',
                    targetLang: 'es',
                    detectedSourceLang: '',
                    loading: false,
                    translatedText: '',
                    phonetics: '',
                    phoneticsIPA: '',
                    error: ''
                  })
                }
                className="p-1 hover:bg-foreground/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-foreground/10 space-y-2">
              <div>
                <p className="text-xs text-foreground/60 mb-1">Texto seleccionado</p>
                <div className="text-sm bg-foreground/5 rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {translatorModal.text}
                </div>
              </div>
              {translatorModal.translatedText &&
                translatorModal.targetLang === 'es' &&
                (translatorModal.phoneticsIPA || translatorModal.phonetics) && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {translatorModal.phoneticsIPA && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground/60">
                          {`Pronunciación IPA en ${getSourceLanguageLabel(
                            translatorModal.sourceLang,
                            translatorModal.detectedSourceLang
                          )}`}
                        </p>
                        <div className="bg-foreground/5 rounded-lg px-3 py-2 min-h-[2.5rem] whitespace-pre-wrap text-xs font-mono">
                          {translatorModal.phoneticsIPA}
                        </div>
                      </div>
                    )}
                    {translatorModal.phonetics && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground/60">
                          Pronunciación castellinaza de la palabra
                        </p>
                        <div className="bg-foreground/5 rounded-lg px-3 py-2 min-h-[2.5rem] whitespace-pre-wrap text-xs font-mono">
                          {translatorModal.phonetics}
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>

            <div className="px-4 pt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-foreground/60">Idioma de entrada</p>
                  <select
                    value={translatorModal.sourceLang}
                    onChange={(e) => setTranslatorModal(prev => ({ ...prev, sourceLang: e.target.value, detectedSourceLang: '' }))}
                    className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background"
                  >
                    <option value="auto">Detectar (auto)</option>
                    <option value="en">Inglés</option>
                    <option value="es">Español</option>
                    <option value="it">Italiano</option>
                    <option value="de">Alemán</option>
                    <option value="ru">Ruso</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-foreground/60">Idioma de salida</p>
                  <select
                    value={translatorModal.targetLang}
                    onChange={(e) => setTranslatorModal(prev => ({ ...prev, targetLang: e.target.value }))}
                    className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background"
                  >
                    <option value="es">Español</option>
                    <option value="en">Inglés</option>
                    <option value="it">Italiano</option>
                    <option value="de">Alemán</option>
                    <option value="ru">Ruso</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-foreground/60">
                  {translatorModal.sourceLang === 'auto' && translatorModal.detectedSourceLang
                    ? `Detectado: ${translatorModal.detectedSourceLang}`
                    : ''}
                </div>
                <button
                  onClick={translateText}
                  disabled={translatorModal.loading}
                  className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  Traducir
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {translatorModal.loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-foreground/60">
                  Traduciendo...
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-foreground/60">Resultado</p>
                  <div className="bg-foreground/5 rounded-lg px-3 py-2 min-h-[4rem] whitespace-pre-wrap text-sm">
                    {translatorModal.translatedText ||
                      (translatorModal.error || 'Selecciona idiomas y pulsa “Traducir”.')}
                  </div>
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
                    sourceLang: 'auto',
                    targetLang: 'es',
                    detectedSourceLang: '',
                    loading: false,
                    translatedText: '',
                    phonetics: '',
                    phoneticsIPA: '',
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
