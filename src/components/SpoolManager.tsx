import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Folder, FileText, Plus, Trash2, ChevronRight, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, ProjectRecord, sheetsApi, SpoolRecord } from '../lib/sheetsApi';

export const SpoolManager: React.FC<{ user: AppUser | null; onSelect: (spool: SpoolRecord & { projectName?: string }) => void }> = ({ user, onSelect }) => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const setNotification = useStore((state) => state.setNotification);
  
  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await sheetsApi.listProjects(user);
      setProjects(data);
    } catch (error) {
      setNotification({ message: `Error cargando proyectos: ${error}`, type: 'error' });
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
      setProjects((current) => [...current, created]);
      setNewProjectName('');
      setNotification({ message: 'Proyecto creado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error creando proyecto: ${error}`, type: 'error' });
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center bg-[#1e2024] h-full flex flex-col justify-center">
        <Layout className="mx-auto mb-4 text-gray-500" size={48} />
        <p className="text-gray-400">Inicie sesion para administrar proyectos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1c1e] text-white">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Folder size={20} className="text-blue-500" />
          Proyectos & Spools
        </h2>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Create Project Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nuevo Proyecto..."
            className="flex-1 bg-[#2c2e33] border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={createProject}
            className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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
                onSelectSpool={onSelect}
                onDeleteProject={(projectId) => setProjects((current) => current.filter((item) => item.id !== projectId))}
              />
            ))}
            {projects.length === 0 && (
              <div className="p-4 border border-dashed border-gray-800 rounded-lg text-center">
                <p className="text-xs text-gray-500 italic">No hay proyectos. Crea uno arriba.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectItem: React.FC<{
  user: AppUser;
  project: ProjectRecord;
  onSelectSpool: (spool: SpoolRecord & { projectName?: string }) => void;
  onDeleteProject: (projectId: string) => void;
}> = ({ user, project, onSelectSpool, onDeleteProject }) => {
  const [spools, setSpools] = useState<SpoolRecord[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSpoolName, setNewSpoolName] = useState('');
  const setNotification = useStore((state) => state.setNotification);

  useEffect(() => {
    if (!isExpanded) return;
    sheetsApi.listSpools(user, project.id)
      .then(setSpools)
      .catch((error) => setNotification({ message: `Error cargando spools: ${error}`, type: 'error' }));
  }, [isExpanded, project.id, setNotification, user]);

  const createSpool = async () => {
    if (!newSpoolName) return;
    try {
      const created = await sheetsApi.createSpool(user, project.id, newSpoolName, {
        elements: [],
        viewPos: { x: 0, y: 0 },
        scale: 1,
        layers: useStore.getState().layers,
        activeLayerId: useStore.getState().activeLayerId
      });
      setSpools((current) => [...current, created]);
      setNewSpoolName('');
      setNotification({ message: 'Spool creado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error creando spool: ${error}`, type: 'error' });
    }
  };

  const deleteProject = async () => {
    if (!confirm('Eliminar proyecto y todos sus spools?')) return;
    try {
      await sheetsApi.deleteProject(user, project.id);
      onDeleteProject(project.id);
      setNotification({ message: 'Proyecto eliminado', type: 'success' });
    } catch (error) {
      setNotification({ message: `Error eliminando proyecto: ${error}`, type: 'error' });
    }
  };

  return (
    <div className="bg-[#2c2e33]/50 rounded-xl border border-gray-800 overflow-hidden">
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
        </div>
        <button onClick={(e) => { e.stopPropagation(); deleteProject(); }} className="text-gray-600 hover:text-red-500 p-1">
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
            <div className="p-3 space-y-2">
              {spools.map((spool) => (
                <div 
                  key={spool.id}
                  onClick={() => onSelectSpool({ ...spool, projectName: project.name })}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-600/20 cursor-pointer group transition-colors"
                >
                  <FileText size={14} className="text-gray-500 group-hover:text-blue-400" />
                  <span className="text-xs flex-1">{spool.name}</span>
                  <ChevronRight size={14} className="text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
              
              <div className="pt-2 flex gap-2">
                <input
                  type="text"
                  value={newSpoolName}
                  onChange={(e) => setNewSpoolName(e.target.value)}
                  placeholder="Nuevo Spool..."
                  className="flex-1 bg-[#1a1c1e] border-none rounded-md px-2 py-1 text-[10px] outline-none"
                />
                <button
                  onClick={createSpool}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-[10px] font-bold hover:bg-blue-500 transition-colors"
                >
                  CREAR
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
