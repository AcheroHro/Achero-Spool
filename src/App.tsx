import React, { useState, useEffect, useRef } from 'react';
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
  Info,
  Menu,
  X,
  FileDown,
  FileUp,
  Box,
  Monitor,
  Plus,
  AlertCircle,
  Check
} from 'lucide-react';
import { useStore, DEFAULT_LAYER_ID, COTAS_LAYER_ID } from './store/useStore';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbox } from './components/Toolbox';
import { BOM } from './components/BOM';
import { SpoolManager } from './components/SpoolManager';
import {
  AppUser,
  clearStoredUser,
  createLocalUser,
  getStoredUser,
  sheetsApi,
  storeUser
} from './lib/sheetsApi';

import { exportToPDF, exportToDXF } from './services/exportService';
import { importFromDXF } from './services/importService';

type ViewMode = 'home' | 'draw' | 'bom';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [activeView, setActiveView] = useState<ViewMode>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    elements, setDrawing, activeSpoolId, activeSpoolName, activeProjectId, activeProjectName,
    viewPos, scale, setElements, setNotification, notification,
    layers, activeLayerId
  } = useStore();

  const showNotif = (message: string, type: 'error' | 'success' = 'error') => {
    console.log('Showing notification:', { message, type });
    setNotification({ message, type });
    // Use a unique ID or just rely on the latest call to clear
    const timer = setTimeout(() => {
      setNotification(null);
    }, 4000);
    return timer;
  };

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) setUser(storedUser);
  }, []);

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
    useStore.setState({
      activeSpoolId: null,
      activeSpoolName: null,
      activeProjectId: null,
      activeProjectName: null
    });
  };

  const handleSelectSpool = (spool: any) => {
    setDrawing(spool.drawingData);
    useStore.setState({ 
      activeSpoolId: spool.id, 
      activeSpoolName: spool.name,
      activeProjectId: spool.projectId,
      activeProjectName: spool.projectName || 'Proyecto'
    });
    setActiveView('draw');
  };

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

  const saveSpool = async () => {
    console.log('saveSpool called', { activeSpoolId, activeProjectId });
    if (!user || !activeSpoolId || !activeProjectId) {
      showNotif('Seleccione un spool para guardar', 'error');
      return;
    }

    try {
      // Immediate feedback
      setNotification({ message: 'Guardando dibujo...', type: 'success' });

      const stats = calculateBOM(elements);
      
      await sheetsApi.updateSpool(user, {
        id: activeSpoolId,
        projectId: activeProjectId,
        drawingData: { elements, viewPos, scale, layers, activeLayerId },
        bom: stats
      });
      
      showNotif('Dibujo guardado con éxito', 'success');
    } catch (error) {
      console.error('Error in saveSpool:', error);
      showNotif('Error al guardar el dibujo: ' + error, 'error');
    }
  };

  const calculateBOM = (els: any[]) => {
    const counts: any = {};
    let pipeLength = 0;
    els.forEach(el => {
      if (el.type === 'pipe') {
        let lengthUnits = el.length || 0;
        if (el.customLabels?.main) {
          const parsed = parseFloat(el.customLabels.main);
          if (!isNaN(parsed) && parsed > 0) {
            lengthUnits = parsed / 50;
          }
        }
        pipeLength += lengthUnits;
      }
      else if (el.type === 'accessory' && el.accessoryType) counts[el.accessoryType] = (counts[el.accessoryType] || 0) + 1;
      else if (el.type === 'support' && el.supportType) counts[el.supportType] = (counts[el.supportType] || 0) + 1;
    });
    return { pipeLength, counts };
  };

  const handleNewDrawing = async () => {
    if (!user) {
      showNotif('Inicie sesión para crear dibujos', 'error');
      return;
    }

    let targetProjectId = activeProjectId;
    
    // Si no hay proyecto activo, intentamos buscar uno del usuario
    if (!targetProjectId) {
      try {
        const projects = await sheetsApi.listProjects(user);
        
        if (projects.length === 0) {
          showNotif('Primero cree un proyecto en la pestaña Proyectos', 'error');
          setActiveView('home');
          setIsSidebarOpen(false);
          return;
        }

        // Si hay proyectos, tomamos el primero como predeterminado si no hay uno activo
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

    const name = window.prompt('Nombre del nuevo dibujo:');
    if (!name) return;

    try {
      showNotif('Creando nuevo dibujo...', 'success');
      
      const spoolRef = await sheetsApi.createSpool(user, targetProjectId, name, {
          elements: [],
          viewPos: { x: 0, y: 0 }, 
          scale: 1,
          layers: [
            { id: DEFAULT_LAYER_ID, name: 'Capa Base', visible: true, locked: false },
            { id: COTAS_LAYER_ID, name: 'Cotas de Cañerías', visible: true, locked: false }
          ],
          activeLayerId: DEFAULT_LAYER_ID
      });

      // Limpiar área de trabajo y establecer el nuevo dibujo activo
      setDrawing({ 
        elements: [], 
        viewPos: { x: 0, y: 0 }, 
        scale: 1,
        layers: [
          { id: DEFAULT_LAYER_ID, name: 'Capa Base', visible: true, locked: false },
          { id: COTAS_LAYER_ID, name: 'Cotas de Cañerías', visible: true, locked: false }
        ],
        activeLayerId: DEFAULT_LAYER_ID
      });
      
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

  return (
    <div className="h-screen w-screen bg-[#0a0b0d] text-white flex flex-col overflow-hidden font-sans">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportDXF} 
        accept=".dxf" 
        className="hidden" 
      />
      
      {/* Header */}
      <header className="h-14 bg-[#16181d] border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-400">
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-bold tracking-tight">Achero_Spool</h1>
        </div>

        <div className="flex items-center gap-2">
          {activeView !== 'home' && (
            <div className="flex gap-1 mr-2">
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="p-2 bg-[#2c2e33] rounded-lg text-gray-400 hover:text-white"
              >
                <FileDown size={18} />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-[#2c2e33] rounded-lg text-gray-400 hover:text-white"
              >
                <FileUp size={18} />
              </button>
            </div>
          )}
          {(activeView === 'draw') && (
            <button 
              onClick={saveSpool}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-[10px] uppercase font-bold rounded-lg"
            >
              <Save size={14} />
              Guardar
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
            className="fixed top-16 right-4 z-50 bg-[#1e2024] border border-gray-800 rounded-xl shadow-2xl p-2 w-48"
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
              onClick={() => { exportToDXF(elements, 'Spool'); setIsExportMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-xs hover:bg-white/5 rounded-lg flex items-center gap-3"
            >
              <FileDown size={14} className="text-blue-500" />
              Exportar a DXF
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
                <button onClick={() => setIsSidebarOpen(false)}>
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

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
