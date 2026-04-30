import DxfParser from 'dxf-parser';
import { DrawingElement } from '../store/useStore';
import { nanoid } from 'nanoid';

export const importFromDXF = async (file: File): Promise<DrawingElement[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target?.result as string;
      const parser = new DxfParser();
      try {
        const dxf = parser.parseSync(contents);
        const importedElements: DrawingElement[] = [];

        if (dxf.entities) {
          dxf.entities.forEach((entity: any) => {
            if (entity.type === 'LINE') {
              const dx = entity.vertices[1].x - entity.vertices[0].x;
              const dy = entity.vertices[1].y - entity.vertices[0].y;
              const length = Math.sqrt(dx * dx + dy * dy);
              
              importedElements.push({
                id: nanoid(),
                type: 'pipe',
                points: [
                  entity.vertices[0].x,
                  -entity.vertices[0].y, // Invert Y back
                  entity.vertices[1].x,
                  -entity.vertices[1].y
                ],
                length: length,
                label: `${(length / 20).toFixed(1)}m`
              });
            } else if (entity.type === 'CIRCLE') {
               importedElements.push({
                 id: nanoid(),
                 type: 'accessory',
                 accessoryType: 'elbow', // Defaulting circle to elbow for now
                 position: { x: entity.center.x, y: -entity.center.y },
                 rotation: 0,
                 size: entity.radius || 10
               });
            }
          });
        }
        resolve(importedElements);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
