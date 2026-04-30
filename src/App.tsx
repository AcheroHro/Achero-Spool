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
  Monitor
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { useStore } from './store/useStore';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbox } from './components/Toolbox';
import { BOM } from './components/BOM';
import { SpoolManager } from './components/SpoolManager';

import { exportToPDF, exportToDXF } from './services/exportService';
import { importFromDXF } from './services/importService';

type ViewMode = 'home' | 'draw' | 'bom';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    elements, setDrawing, activeSpoolId, activeProjectId, 
    viewPos, scale, setElements, setNotification
  } = useStore();

  const showNotif = (message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  const login = () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(err => {
      console.error(err);
    });
  };

  const logout = () => {
    signOut(auth);
    setActiveView('home');
  };

  const handleSelectSpool = (spool: any) => {
    setDrawing(spool.drawingData);
    useStore.setState({ activeSpoolId: spool.id, activeProjectId: spool.projectId });
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
    if (!activeSpoolId || !activeProjectId) return;
    try {
      const spoolRef = doc(db, 'projects', activeProjectId, 'spools', activeSpoolId);
      const stats = calculateBOM(elements);
      await updateDoc(spoolRef, {
        drawingData: { elements, viewPos, scale },
        bom: stats,
        updatedAt: serverTimestamp()
      });
      showNotif('Spool guardado correctamente', 'success');
    } catch (error) {
      showNotif('Error al guardar spool');
      handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProjectId}/spools/${activeSpoolId}`);
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
          <button
            onClick={login}
            className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" alt="google" className="w-5 h-5 rounded-full" />
            Ingresar con Google
          </button>
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
              onClick={() => { exportToPDF(elements, 'Spool'); setIsExportMenuOpen(false); }}
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
              <SpoolManager onSelect={handleSelectSpool} />
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
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Espacio de Trabajo</p>
                  <button className="flex items-center gap-3 text-sm text-gray-300 w-full p-2 hover:bg-gray-800 rounded-lg">
                    <Info size={18} className="text-gray-500" />
                    Ayuda y Tutoriales
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
