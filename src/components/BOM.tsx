import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Package, Hash, Ruler } from 'lucide-react';

const accessoryNames: Record<string, string> = {
  elbow: 'Codo 90°',
  tee: 'Tee Proceso',
  flange: 'Brida SO',
  valve: 'Válvula Esférica',
  reducer: 'Reducción Concéntrica'
};

const supportNames: Record<string, string> = {
  fixed: 'Soporte Fijo',
  sliding: 'Soporte Deslizante',
  guide: 'Soporte Guía'
};

export const BOM: React.FC = () => {
  const { elements } = useStore();

  const stats = useMemo(() => {
    const pipesByDiameter: Record<number, { total: number, items: { length: number, id: string; num: number }[] }> = {};
    const accessories: Record<string, { diameters: Record<number, number>, total: number }> = {};
    const supports: Record<string, { diameters: Record<number, number>, total: number }> = {};
    
    const pipeCountByDiameter: Record<number, number> = {};

    elements.forEach((el) => {
      const diameter = el.diameter || 2;
      if (el.type === 'pipe') {
        if (!pipesByDiameter[diameter]) {
          pipesByDiameter[diameter] = { total: 0, items: [] };
        }
        pipeCountByDiameter[diameter] = (pipeCountByDiameter[diameter] || 0) + 1;
        
        let lengthMm = (el.length || 0) * 50;
        if (el.customLabels?.main) {
          const parsed = parseFloat(el.customLabels.main);
          if (!isNaN(parsed) && parsed > 0) {
            lengthMm = parsed;
          }
        }
        
        pipesByDiameter[diameter].total += lengthMm;
        pipesByDiameter[diameter].items.push({ 
          length: lengthMm, 
          id: el.id,
          num: pipeCountByDiameter[diameter]
        });
      } else if (el.type === 'accessory' && el.accessoryType) {
        if (!accessories[el.accessoryType]) {
          accessories[el.accessoryType] = { diameters: {}, total: 0 };
        }
        accessories[el.accessoryType].diameters[diameter] = (accessories[el.accessoryType].diameters[diameter] || 0) + 1;
        accessories[el.accessoryType].total += 1;
      } else if (el.type === 'support' && el.supportType) {
        if (!supports[el.supportType]) {
          supports[el.supportType] = { diameters: {}, total: 0 };
        }
        supports[el.supportType].diameters[diameter] = (supports[el.supportType].diameters[diameter] || 0) + 1;
        supports[el.supportType].total += 1;
      }
    });

    return { pipesByDiameter, accessories, supports };
  }, [elements]);

  return (
    <div className="flex flex-col h-full bg-[#1e2024] p-4 font-mono">
      <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-2">
        <Package className="text-blue-500" size={20} />
        <h2 className="text-sm font-bold uppercase tracking-widest text-white">Listado de Materiales (BOM)</h2>
      </div>

      <div className="space-y-6 flex-1 overflow-auto pr-2 custom-scrollbar">
        {/* Pipe Section */}
        <div className="space-y-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Tubería / Piping</p>
          {Object.keys(stats.pipesByDiameter).length > 0 ? (
            Object.entries(stats.pipesByDiameter).sort((a, b) => Number(b[0]) - Number(a[0])).map(([diameter, data]) => (
              <div key={diameter} className="space-y-2">
                <div className="flex items-center justify-between bg-blue-600/10 p-2 rounded border border-blue-600/20">
                  <span className="text-[10px] font-bold text-blue-400">Ø {diameter}"</span>
                  <span className="text-[10px] text-blue-300">Total: {data.total.toFixed(0)}mm</span>
                </div>
                <div className="grid gap-1 pl-2">
                  {data.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-[9px] text-gray-400 bg-black/20 p-1.5 rounded">
                      <span className="font-bold text-gray-300">Caño #{item.num}</span>
                      <span className="font-mono">{item.length.toFixed(0)}mm</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-gray-400 italic">No hay cañerías en el diseño.</p>
          )}
        </div>

        {/* Accessories Section */}
        <div className="space-y-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Accesorios / Fittings</p>
          <div className="grid gap-2">
            {Object.keys(stats.accessories).length > 0 ? (
              Object.entries(stats.accessories).map(([type, data]) => (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-yellow-500 uppercase font-bold px-1 mb-1">
                    <div className="flex items-center gap-2">
                      <Hash size={10} />
                      {accessoryNames[type] || type}
                    </div>
                    <span className="bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-400">Total: {data.total}</span>
                  </div>
                  {Object.entries(data.diameters).map(([diameter, count]) => (
                    <div key={diameter} className="bg-[#2c2e33] p-2 rounded flex items-center justify-between mx-1">
                      <span className="text-[9px] text-gray-300">Ø {diameter}"</span>
                      <span className="text-[10px] font-bold text-white">x{count}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-[10px] text-gray-400 italic">No hay accesorios en el diseño.</p>
            )}
          </div>
        </div>
        {/* Supports Section */}
        <div className="space-y-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Soportación / Supports</p>
          <div className="grid gap-2">
            {Object.keys(stats.supports).length > 0 ? (
              Object.entries(stats.supports).map(([type, data]) => (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-emerald-500 uppercase font-bold px-1 mb-1">
                    <div className="flex items-center gap-2">
                      <Hash size={10} />
                      {supportNames[type] || type}
                    </div>
                    <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400">Total: {data.total}</span>
                  </div>
                  {Object.entries(data.diameters).map(([diameter, count]) => (
                    <div key={diameter} className="bg-[#2c2e33] p-2 rounded flex items-center justify-between mx-1">
                      <span className="text-[9px] text-gray-300">Para Ø {diameter}"</span>
                      <span className="text-[10px] font-bold text-white">x{count}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-[10px] text-gray-400 italic">No hay soportes en el diseño.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800">
        <p className="text-[10px] text-gray-500 italic">
          * Escala: 20px = 1000mm (nominal)
        </p>
      </div>
    </div>
  );
};
