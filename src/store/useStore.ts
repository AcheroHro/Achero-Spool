import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type ElementType = 'pipe' | 'accessory' | 'support';
export type AccessoryType = 'elbow' | 'elbow45' | 'tee' | 'teered' | 'flange' | 'valve' | 'reducer' | 'reducexc';
export type SupportType = 'fixed' | 'sliding' | 'guide';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingElement {
  id: string;
  type: ElementType;
  accessoryType?: AccessoryType;
  supportType?: SupportType;
  points?: number[]; // [x1, y1, x2, y2] for pipes
  position?: Point; // for accessories and supports
  rotation?: number;
  size?: number;
  diameter?: number; // Added diameter
  length?: number;
  label?: string;
  labelOffset?: Point;
  labelOffsets?: Record<string, Point>;
  groupId?: string;
  layerId?: string;
  customLabels?: Record<string, string>;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface DrawingState {
  elements: DrawingElement[];
  viewPos: Point;
  scale: number;
  layers: Layer[];
  activeLayerId: string;
}

interface AppState {
  activeSpoolId: string | null;
  activeSpoolName: string | null;
  activeProjectId: string | null;
  activeProjectName: string | null;
  currentTool: 'select' | 'pipe' | 'accessory' | 'support';
  selectedAccessory: AccessoryType | null;
  selectedSupport: SupportType | null;
  currentDiameter: number;
  availableDiameters: number[];
  selectedId: string | null;
  selectedIds: string[];
  history: DrawingState[];
  historyIndex: number;
  
  // Elements state
  elements: DrawingElement[];
  viewPos: Point;
  scale: number;
  notification: { message: string, type: 'error' | 'success' } | null;

  // Layers state
  layers: Layer[];
  activeLayerId: string;

  // Snapping state
  snapEnabled: boolean;

  // Actions
  setNotification: (notif: { message: string, type: 'error' | 'success' } | null) => void;
  setTool: (tool: 'select' | 'pipe' | 'accessory' | 'support', type?: AccessoryType | SupportType) => void;
  setDiameter: (diameter: number) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  groupElements: (ids: string[]) => void;
  ungroupElements: (ids: string[]) => void;
  addDiameter: (diameter: number) => void;
  addElement: (element: DrawingElement) => void;
  updateElement: (id: string, updates: Partial<DrawingElement>) => void;
  moveElements: (ids: string[], dx: number, dy: number, shouldSave?: boolean) => void;
  rotateElements: (ids: string[], angleDeg: number, shouldSave?: boolean) => void;
  updatePipeLength: (id: string, newLengthMeters: number) => void;
  updateLabelOffset: (id: string, offset: Point) => void;
  updateElementLabelOffset: (id: string, key: string, offset: Point) => void;
  deleteElement: (id: string) => void;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  clearDrawing: () => void;
  setElements: (elements: DrawingElement[]) => void;
  setDrawing: (state: DrawingState) => void;

  // Layer Actions
  addLayer: (name: string) => void;
  renameLayer: (id: string, name: string) => void;
  deleteLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  setActiveLayer: (id: string) => void;
  updateCustomLabel: (elementId: string, labelKey: string, value: string) => void;
  toggleSnap: () => void;
}

export const DEFAULT_LAYER_ID = 'default-layer';
export const COTAS_LAYER_ID = 'cotas-layer';

export const useStore = create<AppState>((set, get) => ({
  activeSpoolId: null,
  activeSpoolName: null,
  activeProjectId: null,
  activeProjectName: null,
  currentTool: 'select',
  selectedAccessory: null,
  selectedSupport: 'fixed',
  currentDiameter: 2,
  availableDiameters: [0.5, 1, 2, 3, 4, 6, 8, 10, 12],
  selectedId: null,
  selectedIds: [],
  history: [],
  historyIndex: -1,
  
  elements: [],
  viewPos: { x: 0, y: 0 },
  scale: 1,
  notification: null,

  layers: [
    { id: DEFAULT_LAYER_ID, name: 'Capa Base', visible: true, locked: false },
    { id: COTAS_LAYER_ID, name: 'Cotas de Cañerías', visible: true, locked: false }
  ],
  activeLayerId: DEFAULT_LAYER_ID,
  snapEnabled: false,

  setNotification: (notif) => set({ notification: notif }),

  // Layer Actions
  addLayer: (name) => {
    const newLayer = { id: nanoid(), name, visible: true, locked: false };
    set((state) => ({ layers: [...state.layers, newLayer] }));
    get().saveToHistory();
  },

  renameLayer: (id, name) => {
    set((state) => ({
      layers: state.layers.map(l => l.id === id ? { ...l, name } : l)
    }));
    get().saveToHistory();
  },

  deleteLayer: (id) => {
    if (id === DEFAULT_LAYER_ID || id === COTAS_LAYER_ID) return;
    set((state) => {
      const newActiveLayerId = state.activeLayerId === id ? DEFAULT_LAYER_ID : state.activeLayerId;
      return {
        layers: state.layers.filter(l => l.id !== id),
        activeLayerId: newActiveLayerId,
        elements: state.elements.map(el => el.layerId === id ? { ...el, layerId: DEFAULT_LAYER_ID } : el)
      };
    });
    get().saveToHistory();
  },

  toggleLayerVisibility: (id) => {
    set((state) => ({
      layers: state.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
    }));
    get().saveToHistory();
  },

  toggleLayerLock: (id) => {
    set((state) => ({
      layers: state.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l)
    }));
    get().saveToHistory();
  },

  setActiveLayer: (id) => set({ activeLayerId: id }),
  
  updateCustomLabel: (elementId, labelKey, value) => {
    set((state) => ({
      elements: state.elements.map(el => 
        el.id === elementId 
          ? { ...el, customLabels: { ...(el.customLabels || {}), [labelKey]: value } } 
          : el
      )
    }));
    get().saveToHistory();
  },

  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  setTool: (tool, type) => {
    if (tool === 'accessory') {
      set({ currentTool: tool, selectedAccessory: (type as AccessoryType) || 'elbow' });
    } else if (tool === 'support') {
      set({ currentTool: tool, selectedSupport: (type as SupportType) || 'fixed' });
    } else {
      set({ currentTool: tool, selectedAccessory: null, selectedSupport: null });
    }
  },

  setDiameter: (diameter) => set({ currentDiameter: diameter }),

  setSelectedId: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  setSelectedIds: (ids) => set({ selectedIds: ids, selectedId: ids.length === 1 ? ids[0] : null }),

  groupElements: (ids) => {
    if (ids.length < 2) return;
    const groupId = nanoid();
    set((state) => ({
      elements: state.elements.map(el => ids.includes(el.id) ? { ...el, groupId } : el)
    }));
    get().saveToHistory();
  },

  ungroupElements: (ids) => {
    // Ungroup either by specific element IDs or a conceptual group.
    // For now, let's just clear groupId for all requested elements.
    set((state) => ({
      elements: state.elements.map(el => ids.includes(el.id) ? { ...el, groupId: undefined } : el)
    }));
    get().saveToHistory();
  },

  addDiameter: (diameter) => set((state) => ({ 
    availableDiameters: Array.from(new Set([...state.availableDiameters, diameter])).sort((a, b) => a - b) 
  })),

  addElement: (element) => {
    const { activeLayerId } = get();
    set((state) => ({ elements: [...state.elements, { ...element, layerId: element.layerId || activeLayerId }] }));
    get().saveToHistory();
  },

  updateElement: (id, updates) => {
    set((state) => ({
      elements: state.elements.map(el => el.id === id ? { ...el, ...updates } : el)
    }));
    get().saveToHistory();
  },

  moveElements: (ids, dx, dy, shouldSave = true) => {
    set((state) => ({
      elements: state.elements.map(el => {
        if (ids.includes(el.id)) {
          if (el.type === 'pipe' && el.points) {
            return {
              ...el,
              points: [
                el.points[0] + dx,
                el.points[1] + dy,
                el.points[2] + dx,
                el.points[3] + dy
              ]
            };
          } else if ((el.type === 'accessory' || el.type === 'support') && el.position) {
            return {
              ...el,
              position: { x: el.position.x + dx, y: el.position.y + dy }
            };
          }
        }
        return el;
      })
    }));
    if (shouldSave) get().saveToHistory();
  },

  rotateElements: (ids, angleDeg, shouldSave = true) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const elements = get().elements.filter(el => ids.includes(el.id));
    if (elements.length === 0) return;

    // Calculate center of selection
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      if (el.type === 'pipe' && el.points) {
        minX = Math.min(minX, el.points[0], el.points[2]);
        maxX = Math.max(maxX, el.points[0], el.points[2]);
        minY = Math.min(minY, el.points[1], el.points[3]);
        maxY = Math.max(maxY, el.points[1], el.points[3]);
      } else if (el.position) {
        minX = Math.min(minX, el.position.x);
        maxX = Math.max(maxX, el.position.x);
        minY = Math.min(minY, el.position.y);
        maxY = Math.max(maxY, el.position.y);
      }
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    set((state) => ({
      elements: state.elements.map(el => {
        if (ids.includes(el.id)) {
          if (el.type === 'pipe' && el.points) {
            const rotatePoint = (x: number, y: number) => ({
              x: centerX + (x - centerX) * cos - (y - centerY) * sin,
              y: centerY + (x - centerX) * sin + (y - centerY) * cos
            });
            const p1 = rotatePoint(el.points[0], el.points[1]);
            const p2 = rotatePoint(el.points[2], el.points[3]);
            const newPoints = [p1.x, p1.y, p2.x, p2.y];
            return {
              ...el,
              points: newPoints,
              label: `${(Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) * 50).toFixed(0)}mm (${el.diameter}")`
            };
          } else if ((el.type === 'accessory' || el.type === 'support') && el.position) {
            const rx = centerX + (el.position.x - centerX) * cos - (el.position.y - centerY) * sin;
            const ry = centerY + (el.position.x - centerX) * sin + (el.position.y - centerY) * cos;
            return {
              ...el,
              position: { x: rx, y: ry },
              rotation: (el.rotation || 0) + angleDeg
            };
          }
        }
        return el;
      })
    }));
    if (shouldSave) get().saveToHistory();
  },

  updatePipeLength: (id, newLengthMm) => {
    const SCALE = 20; // 20px = 1000mm
    const newLengthPixels = (newLengthMm / 1000) * SCALE;
    
    set((state) => ({
      elements: state.elements.map((el) => {
        if (el.id === id && el.type === 'pipe' && el.points) {
          const [x1, y1, x2, y2] = el.points;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const angle = Math.atan2(dy, dx);
          
          const newX2 = x1 + Math.cos(angle) * newLengthPixels;
          const newY2 = y1 + Math.sin(angle) * newLengthPixels;
          
          return {
            ...el,
            points: [x1, y1, newX2, newY2],
            length: newLengthPixels,
            label: `${newLengthMm.toFixed(0)}mm (${el.diameter}")`
          };
        }
        return el;
      }),
    }));
    get().saveToHistory();
  },

  updateLabelOffset: (id: string, offset) => {
    set((state) => ({
      elements: state.elements.map(el => el.id === id ? { ...el, labelOffset: offset } : el)
    }));
    get().saveToHistory();
  },

  updateElementLabelOffset: (id, key, offset) => {
    set((state) => ({
      elements: state.elements.map(el => 
        el.id === id 
          ? { ...el, labelOffsets: { ...(el.labelOffsets || {}), [key]: offset } } 
          : el
      )
    }));
    get().saveToHistory();
  },

  deleteElement: (id) => {
    set((state) => ({
      elements: state.elements.filter(el => el.id !== id)
    }));
    get().saveToHistory();
  },

  saveToHistory: () => {
    const { elements, viewPos, scale, layers, activeLayerId, history, historyIndex } = get();
    const newState = { elements, viewPos, scale, layers, activeLayerId };
    
    // Remove future history if we were in undo state
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Limit history size
    if (newHistory.length > 50) newHistory.shift();
    
    set({
      history: [...newHistory, JSON.parse(JSON.stringify(newState))],
      historyIndex: Math.min(newHistory.length, 49)
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      set({
        elements: prevState.elements,
        viewPos: prevState.viewPos,
        scale: prevState.scale,
        layers: prevState.layers,
        activeLayerId: prevState.activeLayerId,
        historyIndex: historyIndex - 1
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      set({
        elements: nextState.elements,
        viewPos: nextState.viewPos,
        scale: nextState.scale,
        layers: nextState.layers,
        activeLayerId: nextState.activeLayerId,
        historyIndex: historyIndex + 1
      });
    }
  },

  clearDrawing: () => set({ 
    elements: [], 
    history: [], 
    historyIndex: -1, 
    selectedId: null,
    layers: [
      { id: DEFAULT_LAYER_ID, name: 'Capa Base', visible: true, locked: false },
      { id: COTAS_LAYER_ID, name: 'Cotas de Cañerías', visible: true, locked: false }
    ],
    activeLayerId: DEFAULT_LAYER_ID
  }),
  
  setElements: (elements) => set({ 
    elements,
    selectedId: null,
    history: [{ 
      elements, 
      viewPos: get().viewPos, 
      scale: get().scale,
      layers: get().layers,
      activeLayerId: get().activeLayerId
    }],
    historyIndex: 0
  }),

  setDrawing: (state) => {
    const defaultLayers = [
      { id: DEFAULT_LAYER_ID, name: 'Capa Base', visible: true, locked: false },
      { id: COTAS_LAYER_ID, name: 'Cotas de Cañerías', visible: true, locked: false }
    ];
    const newState = { 
      elements: state.elements || [], 
      viewPos: state.viewPos || { x: 0, y: 0 }, 
      scale: state.scale || 1,
      layers: state.layers || defaultLayers,
      activeLayerId: state.activeLayerId || DEFAULT_LAYER_ID,
    };
    set({ 
      ...newState,
      selectedId: null,
      history: [JSON.parse(JSON.stringify(newState))],
      historyIndex: 0
    });
  }
}));
