import React, { useState } from 'react';
import { 
  Type, 
  MousePointer2, 
  Minus, 
  Plus, 
  Trash2, 
  Undo2, 
  Redo2, 
  Box, 
  Circle, 
  Square, 
  Triangle,
  Disc,
  Settings2,
  Maximize2,
  PlusCircle,
  Magnet
} from 'lucide-react';
import { useStore, AccessoryType, SupportType } from '../store/useStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Toolbox: React.FC = () => {
  const { 
    currentTool, 
    selectedAccessory, 
    selectedSupport,
    currentDiameter, 
    availableDiameters,
    selectedId,
    setTool, 
    setDiameter, 
    addDiameter,
    setSelectedId,
    deleteElement,
    undo, 
    redo, 
    clearDrawing,
    snapEnabled,
    toggleSnap
  } = useStore();

  const [isAddingDiameter, setIsAddingDiameter] = useState(false);
  const [newDiameter, setNewDiameter] = useState('');

  const handleDelete = () => {
    if (selectedId) {
      deleteElement(selectedId);
      setSelectedId(null);
    } else {
      clearDrawing();
    }
  };

  const handleAddDiameter = () => {
    const val = parseFloat(newDiameter);
    if (!isNaN(val) && val > 0) {
      addDiameter(val);
      setDiameter(val);
      setNewDiameter('');
      setIsAddingDiameter(false);
    }
  };

  const centerView = () => {
    useStore.setState({ viewPos: { x: 0, y: 0 }, scale: 1 });
  };

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Puntero' },
    { id: 'pipe', icon: Minus, label: 'Cañería' },
  ] as const;

  const accessories: { type: AccessoryType; icon: any; label: string }[] = [
    { type: 'elbow', icon: CornerIcon, label: 'Codo' },
    { type: 'elbow45', icon: CornerIcon, label: 'Codo 45' },
    { type: 'tee', icon: Plus, label: 'Tee' },
    { type: 'teered', icon: Plus, label: 'Te Red.' },
    { type: 'flange', icon: BridaIconWrapper, label: 'Brida' },
    { type: 'valve', icon: Settings2, label: 'Válvula' },
    { type: 'reducer', icon: ReducerIconWrapper, label: 'Reducción' },
    { type: 'reducexc', icon: ReducerIconWrapper, label: 'Red. Exc.' },
  ];

  const supports: { type: SupportType; icon: any; label: string }[] = [
    { type: 'fixed', icon: FixedSupportIcon, label: 'Fijo' },
  ];

  return (
    <div className="flex flex-col gap-4 p-2 h-full bg-[#16181d] border-l border-white/5 overflow-y-auto">
      <div className="space-y-1">
        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-1 text-center">Diámetro</p>
        <div className="flex flex-col gap-1">
          <select 
            title="Seleccionar diámetro"
            value={currentDiameter}
            onChange={(e) => setDiameter(Number(e.target.value))}
            className="w-full bg-[#2c2e33] text-white text-[10px] p-2 rounded-lg border border-gray-700 outline-none focus:border-blue-500 appearance-none text-center cursor-pointer"
          >
            {availableDiameters.map(d => (
              <option key={d} value={d}>{d}"</option>
            ))}
          </select>
          
          {isAddingDiameter ? (
            <div className="flex flex-col gap-1 mt-1">
              <input 
                type="number"
                value={newDiameter}
                onChange={(e) => setNewDiameter(e.target.value)}
                placeholder='Ø "'
                className="w-full bg-black/40 text-white text-[10px] p-2 rounded-lg border border-blue-500/50 outline-none"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddDiameter()}
              />
              <div className="flex gap-1">
                <button 
                  onClick={handleAddDiameter}
                  className="flex-1 text-[8px] bg-blue-600 font-bold py-1 rounded text-white"
                >
                  OK
                </button>
                <button 
                  onClick={() => setIsAddingDiameter(false)}
                  className="flex-1 text-[8px] bg-gray-700 font-bold py-1 rounded text-gray-400"
                >
                  X
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingDiameter(true)}
              className="flex items-center justify-center gap-1 text-[8px] text-gray-500 hover:text-white transition-colors py-1"
            >
              <PlusCircle size={10} />
              NUEVO
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-1 text-center">Dibujo</p>
        <div className="flex flex-col gap-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={cn(
                "p-2 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border relative overflow-hidden group min-h-[64px]",
                currentTool === t.id 
                  ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40" 
                  : "bg-[#2c2e33] border-transparent text-gray-400 hover:bg-[#40444b]"
              )}
            >
              {t.id === 'pipe' ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img 
                      src="/niple-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Cañería" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      currentTool === t.id
                        ? "bg-blue-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : (
                <>
                  <t.icon size={20} className="mb-0.5" />
                  <span className="text-[9px] uppercase font-bold tracking-tight">{t.label}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-1 text-center">Accesorios</p>
        <div className="flex flex-col gap-2">
          {accessories.map((a) => (
            <button
              key={a.type}
              onClick={() => setTool('accessory', a.type)}
              className={cn(
                "p-2 py-4 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border relative overflow-hidden group min-h-[64px]",
                (currentTool === 'accessory' && selectedAccessory === a.type) 
                  ? "bg-yellow-600 border-yellow-400 text-white shadow-lg shadow-yellow-900/40" 
                  : "bg-[#2c2e33] border-transparent text-gray-400 hover:bg-[#40444b]"
              )}
            >
              {a.type === 'elbow' ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img 
                      src="/codo90-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Codo" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : a.type === 'elbow45' ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img 
                      src="/codo45-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Codo 45" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : a.type === 'teered' ? (
                <>
                  <div className="absolute inset-0 z-0 text-center">
                    <img 
                      src="/tered-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Te Reducción" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : a.type === 'tee' ? (
                <>
                  <div className="absolute inset-0 z-0 text-center">
                    <img 
                      src="/te-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Tee" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : a.type === 'flange' ? (
                <>
                  <div className="absolute inset-0 z-0 text-center">
                    <img 
                      src="/brida-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Brida" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : a.type === 'reducer' ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img 
                      src="/reducer-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Reducción" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : a.type === 'reducexc' ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img 
                      src="/reducexc-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Red. Exc." 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : a.type === 'valve' ? (
                <>
                  <div className="absolute inset-0 z-0 text-center">
                    <img 
                      src="/valvula-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Válvula" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'accessory' && selectedAccessory === a.type)
                        ? "bg-yellow-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : (
                <>
                  <a.icon size={20} className="mb-0.5" />
                  <span className="text-[9px] uppercase font-bold tracking-tight">{a.label}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-1 text-center">Soportes</p>
        <div className="flex flex-col gap-2">
          {supports.map((s) => (
            <button
              key={s.type}
              onClick={() => setTool('support', s.type)}
              className={cn(
                "p-2 py-4 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border relative overflow-hidden group min-h-[64px]",
                (currentTool === 'support' && selectedSupport === s.type) 
                  ? "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/40" 
                  : "bg-[#2c2e33] border-transparent text-gray-400 hover:bg-[#40444b]"
              )}
            >
              {s.type === 'fixed' ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img 
                      src="/soporte-icon.png" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      alt="Soporte Fijo" 
                    />
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      (currentTool === 'support' && selectedSupport === s.type)
                        ? "bg-emerald-600/40"
                        : "bg-black/40 group-hover:bg-black/20"
                    )} />
                  </div>
                </>
              ) : (
                <>
                  <s.icon size={20} className="mb-0.5" />
                  <span className="text-[9px] uppercase font-bold tracking-tight">{s.label}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2 border-t border-gray-800 pt-4 px-1">
        <div className="grid grid-cols-2 gap-1 mb-2">
          <button 
            onClick={centerView}
            className="flex flex-col items-center justify-center p-2 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600/20 transition-colors border border-blue-600/30"
          >
            <Maximize2 size={16} />
            <span className="text-[8px] uppercase font-bold mt-1">Centrar</span>
          </button>
          <button 
            onClick={toggleSnap}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-xl transition-colors border",
              snapEnabled 
                ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30 hover:bg-yellow-600/30" 
                : "bg-[#2c2e33] text-gray-400 border-transparent hover:bg-[#343a40]"
            )}
          >
            <Magnet size={16} />
            <span className="text-[8px] uppercase font-bold mt-1">Imán {snapEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={undo} title="Deshacer" className="p-2 bg-[#2c2e33] text-gray-400 rounded-lg hover:bg-[#343a40] active:scale-90 transition-transform">
            <Undo2 size={16} className="mx-auto" />
          </button>
          <button onClick={redo} title="Rehacer" className="p-2 bg-[#2c2e33] text-gray-400 rounded-lg hover:bg-[#343a40] active:scale-90 transition-transform">
            <Redo2 size={16} className="mx-auto" />
          </button>
        </div>
        <button 
          onClick={handleDelete}
          className={cn(
            "w-full flex flex-col items-center justify-center p-2 rounded-xl transition-colors border",
            selectedId 
              ? "bg-red-600 text-white border-red-400 shadow-lg shadow-red-900/40" 
              : "bg-red-900/10 text-red-500 border-red-900/30 hover:bg-red-900/20"
          )}
        >
          <Trash2 size={16} />
          <span className="text-[8px] uppercase font-bold mt-1">
            {selectedId ? 'Borrar Seleccion' : 'Borrar Todo'}
          </span>
        </button>
      </div>
    </div>
  );
};

const CornerIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17v-10h10" />
  </svg>
);

const ReducerIcon = ({ size }: { size: number }) => (
  <img 
    src="/reducer-icon.png" 
    alt="Reductor" 
    width={size}
    height={size}
    className="rounded object-cover"
    onError={(e) => {
      // Fallback a SVG si la imagen no existe
      e.currentTarget.style.display = 'none';
      if (e.currentTarget.nextElementSibling) {
        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
      }
    }}
  />
);

const ReducerSvgFallback = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden">
    <path d="M6 8 L18 10 L18 14 L6 16 Z" />
  </svg>
);

const ReducerIconWrapper = ({ size }: { size: number }) => (
  <div className="relative" style={{ width: size, height: size }}>
    <ReducerIcon size={size} />
    <ReducerSvgFallback size={size} />
  </div>
);

const BridaIcon = ({ size }: { size: number }) => (
  <img 
    src="/brida-icon.png" 
    alt="Brida" 
    width={size}
    height={size}
    className="rounded object-cover"
    onError={(e) => {
      e.currentTarget.style.display = 'none';
      if (e.currentTarget.nextElementSibling) {
        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
      }
    }}
  />
);

const BridaSvgFallback = ({ size }: { size: number }) => (
  <Disc size={size} className="hidden" />
);

const BridaIconWrapper = ({ size }: { size: number }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    <BridaIcon size={size} />
    <BridaSvgFallback size={size} />
  </div>
);

const FixedSupportIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v12" />
    <path d="M8 16h8" />
    <path d="M6 20h12" />
    <circle cx="12" cy="16" r="2" />
  </svg>
);

const SlidingSupportIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v12" />
    <path d="M8 20h8" />
    <path d="M7 16 L17 16" />
    <path d="M9 16l-2 4" />
    <path d="M15 16l2 4" />
  </svg>
);

const GuideSupportIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v12" />
    <path d="M7 8 L7 16" />
    <path d="M17 8 L17 16" />
    <path d="M7 12h10" />
    <path d="M12 16l-2 4" />
    <path d="M12 16l2 4" />
  </svg>
);
