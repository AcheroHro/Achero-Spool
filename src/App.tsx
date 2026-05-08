import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  motion,
  AnimatePresence
} from 'motion/react';
import {
  Layout,
  PenTool,
  Layers,
  Database,
  LogOut,
  Save,
  Menu,
  X,
  FileDown,
  FileUp,
  Plus,
  AlertCircle,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize,
  Image
} from 'lucide-react';
import { useStore, DEFAULT_LAYER_ID, COTAS_LAYER_ID, DrawingElement } from './store/useStore';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbox } from './components/Toolbox';
import { BOM } from './components/BOM';
import { SpoolManager } from './components/SpoolManager';
import { useModal } from './components/PromptModal';
import {
  AppUser,
  clearStoredUser,
  createLocalUser,
  getStoredUser,
  saveLocalBackup,
  sheetsApi,
  SpoolRecord,
  storeUser
} from './lib/sheetsApi';

import { exportToPDF, exportToDXF, exportToPNG } from './services/exportService';
import { importFromDXF } from './services/importService';

type ViewMode = 'home' | 'draw' | 'bom';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [activeView, setActiveView] = useState<ViewMode>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDirtyRef = useRef(false);

  const {
    elements, setDrawing, activeSpoolId, activeSpoolName, activeProjectId, activeProjectName,
    viewPos, scale, setElements, setNotification, notification,
    layers, activeLayerId
  } = useStore();

  const { modal, showPrompt, showConfirm } = useModal();

  // ─── Dirty tracking ──────────────────────────────────────────────────────
  const prevSpoolIdRef = useRef<string | null>(null);
  useEffect(() => {
    // reset dirty flag when spool changes
    if (prevSpoolIdRef.current !== activeSpoolId) {
      prevSpoolIdRef.current = activeSpoolId;
      setIsDirty(false);
      isDirtyRef.current = false;
      return;
    }
    if (activeSpoolId) {
      setIsDirty(true);
      isDirtyRef.current = true;
    }
  }, [elements, activeSpoolId]);

  // ─── Notification helper ─────────────────────────────────────────────────
  const showNotif = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    const timer = setTimeout(() => setNotification(null), 4000);
    return timer;
  }, [setNotification]);

  // ─── Restore user from localStorage ─────────────────────────────────────
  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) setUser(storedUser);
  }, []);

  // ─── Autosave every 60s ──────────────────────────────────────────────────
  const saveSpool = useCallback(async (silent = false) => {
    if (!user || !activeSpoolId || !activeProjectId) {
      if (!silent) showNotif('Seleccione un spool para guardar', 'error');
      return;
    }
    try {
      if (!silent) setNotification({ message: 'Guardando dibujo...', type: 'success' });
      const stats = calculateBOM(elements);
      const drawingData = { elements, viewPos, scale, layers, activeLayerId };
      await sheetsApi.updateSpool(user, {
        id: activeSpoolId,
        projectId: activeProjectId,
        drawingData,
        bom: stats
      });
      // Backup local tras guardado exitoso
      saveLocalBackup(activeSpoolId, drawingData);
      setIsDirty(false);
      isDirtyRef.current = false;
      if (!silent) showNotif('Dibujo guardado con éxito', 'success');
    } catch (error) {
      console.error('Error in saveSpool:', error);
      if (!silent) showNotif('Error al guardar el dibujo: ' + error, 'error');
    }
  }, [user, activeSpoolId, activeProjectId, elements, viewPos, scale, layers, activeLayerId, setNotification, showNotif]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirtyRef.current && activeSpoolId) {
        saveSpool(true); // silent autosave
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [saveSpool, activeSpoolId]);

  // ─── beforeunload guard ──────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, []);

  // ─── Auth ────────────────────────────────────────────────────────────────
  const login = (event: React.FormEvent) => {
    event.preventDefault();
    if (!loginEmail.includes('@')) {
      showNotif('Ingrese un email valido', 'error');
      return;
    }
    const nextUser = createLocalUser(loginEmail);
    storeUser(nextUser);
    setUser(nextUser);
  };

  const logout = () => {
    clearStoredUser();
    setUser(null);
    setActiveView('home');
    setIsDirty(false);
    isDirtyRef.current = false;
    useStore.setState({
      activeSpoolId: null,
      activeSpoolName: null,
      activeProjectId: null,
      activeProjectName: null
    });
  };

  // ─── Spool selection (with unsaved check) ────────────────────────────────
  const handleSelectSpool = async (spool: SpoolRecord & { projectName?: string }) => {
    if (isDirtyRef.current) {
      const res = await showConfirm({
        title: 'Cambios sin guardar',
        message: 'Tienes cambios sin guardar en el spool actual. ¿Descartar y continuar?',
        confirmLabel: 'Descartar'
      });
      if (res === null) return; // user cancelled
    }
    setDrawing(spool.drawingData);
    useStore.setState({
      activeSpoolId: spool.id,
      activeSpoolName: spool.name,
      activeProjectId: spool.projectId,
      activeProjectName: spool.projectName || 'Proyecto'
    });
    setActiveView('draw');
  };

  // ─── DXF Import ─────────────────────────────────────────────────────────
  const handleImportDXF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importFromDXF(file);
      setElements(imported);
      showNotif('DXF importado correctamente', 'success');
    } catch (err) {
      showNotif('Error importando DXF: ' + err);
    }
  };

  // ─── BOM calculation ─────────────────────────────────────────────────────
  const calculateBOM = (els: DrawingElement[]) => {
    const counts: Record<string, number> = {};
    let pipeLength = 0;
    els.forEach(el => {
      if (el.type === 'pipe') {
        let lengthUnits = el.length || 0;
        if (el.customLabels?.main) {
          const parsed = parseFloat(el.customLabels.main);
          if (!isNaN(parsed) && parsed > 0) lengthUnits = parsed / 50;
        }
        pipeLength += lengthUnits;
      } else if (el.type === 'accessory' && el.accessoryType) {
        counts[el.accessoryType] = (counts[el.accessoryType] || 0) + 1;
      } else if (el.type === 'support' && el.supportType) {
        counts[el.supportType] = (counts[el.supportType] || 0) + 1;
      }
    });
    return { pipeLength, counts };
  };

  // ─── New drawing ─────────────────────────────────────────────────────────
  const handleNewDrawing = async () => {
    if (!user) {
      showNotif('Inicie sesión para crear dibujos', 'error');
      return;
    }

    if (isDirtyRef.current) {
      const res = await showConfirm({
        title: 'Cambios sin guardar',
        message: 'Tienes cambios sin guardar. ¿Descartar y crear un dibujo nuevo?',
        confirmLabel: 'Descartar'
      });
      if (res === null) return;
    }

    let targetProjectId = activeProjectId;
    if (!targetProjectId) {
      try {
        const projects = await sheetsApi.listProjects(user);
        if (projects.length === 0) {
          showNotif('Primero cree un proyecto en la pestaña Proyectos', 'error');
          setActiveView('home');
          setIsSidebarOpen(false);
          return;
        }
        const firstProject = projects[0];
        targetProjectId = firstProject.id;
        useStore.setState({
          activeProjectId: targetProjectId,
          activeProjectName: firstProject.name
        });
      } catch (error) {
        console.error('Error al buscar proyectos:', error);
        showNotif('Error al verificar proyectos', 'error');
        return;
      }
    }

    const name = await showPrompt({
      title: 'Nuevo dibujo',
      placeholder: 'Nombre del spool...',
      confirmLabel: 'Crear',
      validate: (v) => v.trim() ? null : 'El nombre no puede estar vacío'
    });
    if (!name) return;

    try {
      showNotif('Creando nuevo dibujo...', 'success');
      const initialDrawing = {
        elements: [],
        viewPos: { x: 0, y: 0 },
        scale: 1,
        layers: [
          { id: DEFAULT_LAYER_ID, name: 'Capa Base', visible: true, locked: false },
          { id: COTAS_LAYER_ID, name: 'Cotas de Cañerías', visible: true, locked: false }
        ],
        activeLayerId: DEFAULT_LAYER_ID
      };
      const spoolRef = await sheetsApi.createSpool(user, targetProjectId, name, initialDrawing);
      setDrawing(initialDrawing);
      useStore.setState({
        activeSpoolId: spoolRef.id,
        activeSpoolName: name,
        activeProjectId: targetProjectId
      });
      setActiveView('draw');
      setIsSidebarOpen(false);
      showNotif(`Dibujo "${name}" creado con éxito`, 'success');
    } catch (error) {
      console.error('Error al crear spool:', error);
      showNotif('Error al guardar el dibujo: ' + error, 'error');
    }
  };

  // ─── Zoom controls ───────────────────────────────────────────────────────
  const handleZoomIn = () => useStore.setState((s) => ({ scale: Math.min(s.scale * 1.25, 10) }));
  const handleZoomOut = () => useStore.setState((s) => ({ scale: Math.max(s.scale / 1.25, 0.05) }));
  const handleZoomFit = () => useStore.setState({ scale: 1, viewPos: { x: 0, y: 0 } });

  // ─── Login screen ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="h-screen w-screen bg-[#0a0b0d] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#16181d] rounded-3xl p-8 border border-white/5 shadow-2xl text-center flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-900/20">
            <PenTool size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Achero_Spool</h1>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            Diseño profesional de spools de cañerías con precisión milimétrica desde tu móvil.
          </p>
          <form onSubmit={login} className="w-full space-y-3">
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="tu@email.com"
              className="w-full bg-[#0f1115] text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all active:scale-95"
            >
              Ingresar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#0a0b0d] text-white flex flex-col overflow-hidden font-sans">
      {modal}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportDXF}
        accept=".dxf"
        aria-label="Importar archivo DXF"
        className="hidden"
      />

      {/* Header */}
      <header className="h-14 bg-[#16181d] border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-400" title="Abrir menú">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-bold tracking-tight">Achero_Spool</h1>
            {/* Unsaved indicator */}
            {isDirty && activeSpoolId && (
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                title="Cambios sin guardar"
                className="w-2 h-2 rounded-full bg-orange-400 shrink-0"
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeView !== 'home' && (
            <div className="flex gap-1 mr-2">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="p-2 bg-[#2c2e33] rounded-lg text-gray-400 hover:text-white"
                title="Exportar"
              >
                <FileDown size={18} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-[#2c2e33] rounded-lg text-gray-400 hover:text-white"
                title="Importar DXF"
              >
                <FileUp size={18} />
              </button>
            </div>
          )}
          {activeView === 'draw' && (
            <button
              onClick={() => saveSpool(false)}
              className={`flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase font-bold rounded-lg transition-colors ${
                isDirty ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 text-gray-400'
              }`}
              title="Guardar dibujo"
            >
              <Save size={14} />
              {isDirty ? 'Guardar' : 'Guardado'}
            </button>
          )}
          <img src={user.photoURL || ''} alt="profile" className="w-7 h-7 rounded-full border border-gray-700" />
        </div>
      </header>

      {/* Global Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            key={`${notification.message}-${notification.type}`}
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl border shadow-2xl backdrop-blur-md ${
              notification.type === 'error'
                ? 'bg-red-900/90 text-red-100 border-red-500/50'
                : 'bg-emerald-900/90 text-emerald-100 border-emerald-500/50'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle size={20} className="text-red-400" />
            ) : (
              <Check size={20} className="text-emerald-400" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
              title="Cerrar"
            >
              <X size={14} className={notification.type === 'error' ? 'text-red-300' : 'text-emerald-300'} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Menu Overlay */}
      <AnimatePresence>
        {isExportMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="fixed top-16 right-4 z-50 bg-[#1e2024] border border-gray-800 rounded-xl shadow-2xl p-2 w-52"
          >
            <button
              onClick={() => {
                exportToPDF(elements, activeSpoolName || 'Spool', activeProjectName || 'Proyecto');
                setIsExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-xs hover:bg-white/5 rounded-lg flex items-center gap-3"
            >
              <FileDown size={14} className="text-red-500" />
              Exportar a PDF
            </button>
            <button
              onClick={() => { exportToDXF(elements, activeSpoolName || 'Spool'); setIsExportMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-xs hover:bg-white/5 rounded-lg flex items-center gap-3"
            >
              <FileDown size={14} className="text-blue-500" />
              Exportar a DXF
            </button>
            <button
              onClick={() => {
                exportToPNG(activeSpoolName || 'Spool', activeProjectName || 'Proyecto');
                setIsExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-xs hover:bg-white/5 rounded-lg flex items-center gap-3"
            >
              <Image size={14} className="text-green-500" />
              Exportar a PNG
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 z-10"
            >
              <SpoolManager user={user} onSelect={handleSelectSpool} />
            </motion.div>
          )}

          {activeView === 'draw' && (
            <motion.div
              key="draw"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 flex flex-row"
            >
              <div className="flex-1 relative overflow-hidden">
                <DrawingCanvas />

                {/* Zoom controls */}
                <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-20">
                  <button
                    onClick={handleZoomIn}
                    title="Acercar"
                    className="w-9 h-9 bg-[#1e2024]/90 border border-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2c2e33] transition-all backdrop-blur-sm active:scale-95"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={handleZoomFit}
                    title="Ajustar vista"
                    className="w-9 h-9 bg-[#1e2024]/90 border border-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2c2e33] transition-all backdrop-blur-sm active:scale-95"
                  >
                    <Maximize size={16} />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    title="Alejar"
                    className="w-9 h-9 bg-[#1e2024]/90 border border-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2c2e33] transition-all backdrop-blur-sm active:scale-95"
                  >
                    <ZoomOut size={16} />
                  </button>
                  {/* Scale indicator */}
                  <div className="w-9 h-7 bg-[#1e2024]/80 border border-gray-800 rounded-md flex items-center justify-center">
                    <span className="text-[8px] text-gray-500 font-mono">{Math.round(scale * 100)}%</span>
                  </div>
                </div>
              </div>
              <div className="w-20 h-full shrink-0 border-l border-gray-800 bg-[#16181d] z-20">
                <Toolbox />
              </div>
            </motion.div>
          )}

          {activeView === 'bom' && (
            <motion.div
              key="bom"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 z-10"
            >
              <BOM />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="h-16 bg-[#16181d] border-t border-gray-800 flex items-center justify-around shrink-0 pb-safe">
        <button
          onClick={() => setActiveView('home')}
          className={`flex flex-col items-center gap-1 ${activeView === 'home' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          <Database size={20} />
          <span className="text-[10px]">Proyectos</span>
        </button>
        <button
          onClick={() => setActiveView('draw')}
          disabled={!activeSpoolId}
          className={`flex flex-col items-center gap-1 ${activeView === 'draw' ? 'text-blue-500' : 'text-gray-500'} disabled:opacity-30`}
        >
          <PenTool size={20} />
          <span className="text-[10px]">Diseño Unifilar</span>
        </button>
        <button
          onClick={() => setActiveView('bom')}
          disabled={!activeSpoolId}
          className={`flex flex-col items-center gap-1 ${activeView === 'bom' ? 'text-blue-500' : 'text-gray-500'} disabled:opacity-30`}
        >
          <Layers size={20} />
          <span className="text-[10px]">Materiales (BOM)</span>
        </button>
      </nav>

      {/* Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-64 bg-[#16181d] z-50 border-r border-gray-800 flex flex-col"
            >
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <PenTool size={18} />
                  </div>
                  <span className="font-bold text-sm">Achero_Spool</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} title="Cerrar">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Active spool info */}
              {activeSpoolName && (
                <div className="mx-4 mt-4 p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                  <p className="text-[9px] text-blue-400 uppercase tracking-widest font-bold mb-0.5">Spool activo</p>
                  <p className="text-xs text-white font-medium truncate">{activeSpoolName}</p>
                  {activeProjectName && (
                    <p className="text-[10px] text-gray-500 truncate">{activeProjectName}</p>
                  )}
                  {isDirty && (
                    <p className="text-[9px] text-orange-400 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                      Cambios sin guardar
                    </p>
                  )}
                </div>
              )}

              <div className="flex-1 p-4 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Espacio de Trabajo</p>
                    {activeProjectId && (
                      <span className="text-[10px] text-blue-400 font-medium">Proyecto Activo</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleNewDrawing}
                    className="flex items-center gap-3 text-sm text-gray-300 w-full p-3 hover:bg-gray-800 rounded-lg text-left transition-colors border border-transparent hover:border-blue-500/30"
                  >
                    <Plus size={18} className="text-gray-500" />
                    Dibujo Nuevo
                  </button>
                  {activeView === 'draw' && activeSpoolId && (
                    <button
                      type="button"
                      onClick={() => { saveSpool(false); setIsSidebarOpen(false); }}
                      className="flex items-center gap-3 text-sm text-gray-300 w-full p-3 hover:bg-gray-800 rounded-lg text-left transition-colors border border-transparent hover:border-emerald-500/30"
                    >
                      <Save size={18} className="text-gray-500" />
                      Guardar Dibujo
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-800">
                <button
                  onClick={logout}
                  className="flex items-center gap-3 text-sm text-red-400 w-full p-2 hover:bg-red-900/10 rounded-lg"
                >
                  <LogOut size={18} />
                  Cerrar Sesión
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
