import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Folder, FileText, Plus, Trash2, ChevronRight, Layout, Pencil, Search, WifiOff, RefreshCw, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AppUser, ProjectRecord, sheetsApi, SpoolRecord, SpoolMeta,
  saveLocalProjectsCache, getLocalProjectsCache,
  saveLocalSpoolsCache, getLocalSpoolsCache,
  getLocalBackup
} from '../lib/sheetsApi';
import { useModal } from './PromptModal';

export const SpoolManager: React.FC<{ user: AppUser | null; onSelect: (spool: SpoolRecord & { projectName?: string }) => void }> = ({ user, onSelect }) => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const setNotification = useStore((state) => state.setNotification);
  const { modal, showConfirm } = useModal();

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await sheetsApi.listProjects(user);
      setProjects(data);
      saveLocalProjectsCache(user.uid, data); // ← actualizar caché al éxito
      setIsOffline(false);
      setOfflineCachedAt(null);
    } catch (error) {
      // Intentar cargar desde caché local
      const cached = getLocalProjectsCache(user.uid);
      if (cached) {
        setProjects(cached.projects);
        setIsOffline(true);
        setOfflineCachedAt(cached.cachedAt);
      } else {
        setNotification({ message: `Error cargando proyectos: ${error}`, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, [setNotification, user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = async () => {
    if (!newProjectName || !user) return;
    try {
      const created = await sheetsApi.createProject(user, newProjectName);
      const updated = [...projects, created];
      setProjects(updated);
      saveLocalProjectsCache(user.uid, updated);
      setNewProjectName('');
      setNotification({ message: 'Proyecto creado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error creando proyecto: ${error}`, type: 'error' });
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center bg-[#1e2024] h-full flex flex-col justify-center">
        <Layout className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-gray-400">Inicie sesión para administrar proyectos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1c1e] text-white">
      {modal}

      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
          <Folder size={20} className="text-blue-500" />
          Proyectos &amp; Spools
        </h2>
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar spool..."
            className="w-full bg-[#2c2e33] border-none rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-300 placeholder-gray-600"
          />
        </div>
      </div>

      {/* ── Offline banner ────────────────────────────────────── */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mt-3 p-2.5 bg-yellow-900/30 border border-yellow-600/40 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <WifiOff size={14} className="text-yellow-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Sin conexión — Modo Offline</p>
                  {offlineCachedAt && (
                    <p className="text-[9px] text-yellow-700 truncate">
                      Caché: {new Date(offlineCachedAt).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={loadProjects}
                title="Reintentar conexión"
                className="flex items-center gap-1 text-[9px] text-yellow-400 hover:text-yellow-200 border border-yellow-600/50 rounded-lg px-2 py-1 transition-colors shrink-0"
              >
                <RefreshCw size={10} />
                Reintentar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Create Project Input — disabled offline */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createProject()}
            placeholder={isOffline ? 'Sin conexión — no se puede crear' : 'Nuevo Proyecto...'}
            disabled={isOffline}
            className="flex-1 bg-[#2c2e33] border border-transparent rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none text-white disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={createProject}
            disabled={isOffline}
            className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Crear proyecto"
          >
            <Plus size={20} />
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-gray-500 text-center animate-pulse">Cargando proyectos...</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                user={user}
                project={project}
                searchQuery={searchQuery}
                isOffline={isOffline}
                onSelectSpool={onSelect}
                onDeleteProject={(projectId) => setProjects((current) => current.filter((item) => item.id !== projectId))}
                showConfirm={showConfirm}
              />
            ))}
            {projects.length === 0 && (
              <div className="p-4 border border-dashed border-gray-800 rounded-lg text-center">
                <p className="text-xs text-gray-500 italic">
                  {isOffline ? 'Sin caché local disponible.' : 'No hay proyectos. Crea uno arriba.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

type ShowConfirm = (props: { title: string; message?: string; confirmLabel?: string }) => Promise<string | null>;

const ProjectItem: React.FC<{
  user: AppUser;
  project: ProjectRecord;
  searchQuery: string;
  isOffline: boolean;
  onSelectSpool: (spool: SpoolRecord & { projectName?: string }) => void;
  onDeleteProject: (projectId: string) => void;
  showConfirm: ShowConfirm;
}> = ({ user, project, searchQuery, isOffline, onSelectSpool, onDeleteProject, showConfirm }) => {
  const [spools, setSpools] = useState<SpoolMeta[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSpoolName, setNewSpoolName] = useState('');
  const setNotification = useStore((state) => state.setNotification);
  const { modal: itemModal, showPrompt, showConfirm: itemShowConfirm } = useModal();

  // Auto-expand if there's an active search
  useEffect(() => {
    if (searchQuery) setIsExpanded(true);
  }, [searchQuery]);

  useEffect(() => {
    if (!isExpanded) return;

    if (isOffline) {
      // Modo offline: cargar desde caché local
      const cached = getLocalSpoolsCache(project.id);
      if (cached) {
        setSpools(cached);
      } else {
        setSpools([]);
      }
      return;
    }

    // Modo online: cargar desde API y guardar caché
    sheetsApi.listSpools(user, project.id)
      .then(data => {
        setSpools(data);
        saveLocalSpoolsCache(project.id, data); // ← guardar caché al éxito
      })
      .catch((error) => {
        // Fallback a caché local si la API falla
        const cached = getLocalSpoolsCache(project.id);
        if (cached) {
          setSpools(cached);
          setNotification({ message: 'Sin conexión: mostrando spools en caché', type: 'error' });
        } else {
          setNotification({ message: `Error cargando spools: ${error}`, type: 'error' });
        }
      });
  }, [isExpanded, isOffline, project.id, setNotification, user]);

  const filteredSpools = searchQuery
    ? spools.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : spools;

  /** Selecciona un spool: online → usa drawingData del servidor; offline → usa backup local */
  const handleSpoolSelect = (spoolMeta: SpoolMeta) => {
    if (isOffline) {
      const backup = getLocalBackup(spoolMeta.id);
      if (!backup) {
        setNotification({
          message: `Sin respaldo local para "${spoolMeta.name}". Guarda el spool con conexión primero.`,
          type: 'error'
        });
        return;
      }
      // Construimos un SpoolRecord completo usando el backup de drawingData
      const fullSpool: SpoolRecord & { projectName: string } = {
        ...(spoolMeta as SpoolRecord),
        drawingData: backup.data,
        projectName: project.name
      };
      onSelectSpool(fullSpool);
    } else {
      // Online: spoolMeta es en realidad un SpoolRecord completo (tiene drawingData)
      onSelectSpool({ ...(spoolMeta as SpoolRecord), projectName: project.name });
    }
  };

  const createSpool = async () => {
    if (!newSpoolName || isOffline) return;
    try {
      const created = await sheetsApi.createSpool(user, project.id, newSpoolName, {
        elements: [],
        viewPos: { x: 0, y: 0 },
        scale: 1,
        layers: useStore.getState().layers,
        activeLayerId: useStore.getState().activeLayerId,
        labelFontSize: useStore.getState().labelFontSize
      });
      const updated = [...spools, created];
      setSpools(updated);
      saveLocalSpoolsCache(project.id, updated as SpoolRecord[]);
      setNewSpoolName('');
      setNotification({ message: 'Spool creado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error creando spool: ${error}`, type: 'error' });
    }
  };

  const deleteProject = async () => {
    const result = await showConfirm({
      title: 'Eliminar proyecto',
      message: `¿Eliminar "${project.name}" y todos sus spools? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar'
    });
    if (!result && result !== '') return;
    try {
      await sheetsApi.deleteProject(user, project.id);
      onDeleteProject(project.id);
      setNotification({ message: 'Proyecto eliminado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error eliminando proyecto: ${error}`, type: 'error' });
    }
  };

  const deleteSpool = async (spool: SpoolMeta) => {
    const result = await itemShowConfirm({
      title: 'Eliminar spool',
      message: `¿Eliminar "${spool.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar'
    });
    if (!result && result !== '') return;
    try {
      await sheetsApi.deleteSpool(user, spool.id);
      const updated = spools.filter((s) => s.id !== spool.id);
      setSpools(updated);
      saveLocalSpoolsCache(project.id, updated as SpoolRecord[]);
      setNotification({ message: 'Spool eliminado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error eliminando spool: ${error}`, type: 'error' });
    }
  };

  const renameSpool = async (spool: SpoolMeta) => {
    const result = await showPrompt({
      title: 'Renombrar spool',
      initialValue: spool.name,
      placeholder: 'Nuevo nombre...',
      confirmLabel: 'Renombrar',
      validate: (v) => v.trim() ? null : 'El nombre no puede estar vacío'
    });
    if (!result) return;
    try {
      await sheetsApi.renameSpool(user, spool.id, result.trim());
      const updated = spools.map((s) => s.id === spool.id ? { ...s, name: result.trim() } : s);
      setSpools(updated);
      saveLocalSpoolsCache(project.id, updated as SpoolRecord[]);
      setNotification({ message: 'Spool renombrado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error renombrando spool: ${error}`, type: 'error' });
    }
  };

  return (
    <div className="bg-[#2c2e33]/50 rounded-xl border border-gray-800 overflow-hidden">
      {itemModal}
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#2c2e33] transition-colors"
        onClick={() => {
          setIsExpanded(!isExpanded);
          if (!isExpanded) {
            useStore.setState({
              activeProjectId: project.id,
              activeProjectName: project.name
            });
          }
        }}
      >
        <div className="flex items-center gap-3">
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
            <ChevronRight size={16} className="text-gray-500" />
          </motion.div>
          <span className="text-sm font-medium">{project.name}</span>
          {spools.length > 0 && (
            <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">{spools.length}</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); deleteProject(); }}
          disabled={isOffline}
          className="text-gray-600 hover:text-red-500 p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Eliminar proyecto"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-800 bg-[#1e2024]/30"
          >
            <div className="p-3 space-y-1">
              {filteredSpools.length === 0 && searchQuery && (
                <p className="text-[10px] text-gray-500 italic px-2 py-1">Sin resultados para "{searchQuery}"</p>
              )}
              {filteredSpools.length === 0 && !searchQuery && isOffline && (
                <p className="text-[10px] text-yellow-700 italic px-2 py-1">Sin caché de spools para este proyecto.</p>
              )}
              {filteredSpools.map((spool) => {
                const hasLocalBackup = !!getLocalBackup(spool.id);
                const canOpen = !isOffline || hasLocalBackup;
                return (
                  <div
                    key={spool.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-600/10 group transition-colors"
                  >
                    <FileText size={14} className={`shrink-0 ${canOpen ? 'text-gray-500 group-hover:text-blue-400' : 'text-gray-700'}`} />
                    <span
                      className={`text-xs flex-1 ${canOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                      title={!canOpen ? 'Sin respaldo local — guarda este spool con conexión primero' : undefined}
                      onClick={() => canOpen && handleSpoolSelect(spool)}
                    >
                      {spool.name}
                    </span>

                    {/* Indicador de backup local (visible siempre en offline, en hover online) */}
                    {hasLocalBackup && (
                      <span title="Respaldo local disponible" className={`text-emerald-600 ${isOffline ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <HardDrive size={10} />
                      </span>
                    )}

                    {/* Botones de acción — ocultos en offline */}
                    {!isOffline && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          title="Renombrar"
                          onClick={(e) => { e.stopPropagation(); renameSpool(spool); }}
                          className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          title="Eliminar"
                          onClick={(e) => { e.stopPropagation(); deleteSpool(spool); }}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}

                    <ChevronRight
                      size={14}
                      className={`text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${canOpen ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      onClick={() => canOpen && handleSpoolSelect(spool)}
                    />
                  </div>
                );
              })}

              {/* Crear spool — deshabilitado en offline */}
              {!isOffline && (
                <div className="pt-2 flex gap-2">
                  <input
                    type="text"
                    value={newSpoolName}
                    onChange={(e) => setNewSpoolName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createSpool()}
                    placeholder="Nuevo Spool..."
                    className="flex-1 bg-[#1a1c1e] border-none rounded-md px-2 py-1 text-[10px] outline-none text-white"
                  />
                  <button
                    onClick={createSpool}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md text-[10px] font-bold hover:bg-blue-500 transition-colors"
                  >
                    CREAR
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
