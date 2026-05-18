import { DrawingElement, useStore } from '../store/useStore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const accessoryNames: Record<string, string> = {
  elbow: 'Codo 90°',
  elbow45: 'Codo 45°',
  tee: 'Tee Proceso',
  teered: 'Te Reducción',
  flange: 'Brida SO',
  valve: 'Válvula Esférica',
  reducer: 'Reducción Concéntrica',
  reducexc: 'Reducción Excéntrica'
};

const supportNames: Record<string, string> = {
  fixed: 'Soporte Fijo',
  sliding: 'Soporte Deslizante',
  guide: 'Soporte Guía'
};

export const exportToPDF = (elements: DrawingElement[], spoolName: string, projectName: string) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // ── Page geometry (landscape A4 = 297 × 210 mm) ───────────────────────────
  const PAGE_W   = 297;
  const PAGE_H   = 210;
  const MARGIN   = 10;
  const HEADER_H = 22; // reserved for title + subtitle

  const areaX = MARGIN;
  const areaY = MARGIN + HEADER_H;
  const areaW = PAGE_W - MARGIN * 2;
  const areaH = PAGE_H - areaY - MARGIN;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(`${projectName}  ·  ${spoolName}`, MARGIN, MARGIN + 7);
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Achero_Spool  —  ${new Date().toLocaleDateString('es-AR')}`, MARGIN, MARGIN + 13);

  // Drawing-area border
  doc.setDrawColor(180);
  doc.setLineWidth(0.15);
  doc.rect(areaX, areaY, areaW, areaH);

  // ── Bounding box of all elements ───────────────────────────────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  elements.forEach(el => {
    if (el.type === 'pipe' && el.points) {
      minX = Math.min(minX, el.points[0], el.points[2]);
      maxX = Math.max(maxX, el.points[0], el.points[2]);
      minY = Math.min(minY, el.points[1], el.points[3]);
      maxY = Math.max(maxY, el.points[1], el.points[3]);
    } else if ((el.type === 'accessory' || el.type === 'support') && el.position) {
      minX = Math.min(minX, el.position.x);
      maxX = Math.max(maxX, el.position.x);
      minY = Math.min(minY, el.position.y);
      maxY = Math.max(maxY, el.position.y);
    }
  });

  // ── Fit-to-page scale + centering offset ──────────────────────────────────
  let scale: number;
  let offsetX: number;
  let offsetY: number;

  const hasElements = isFinite(minX) && elements.length > 0;

  if (!hasElements) {
    scale   = 0.4;
    offsetX = areaX + areaW / 2;
    offsetY = areaY + areaH / 2;
  } else {
    // Padding around the bounding box (canvas pixels) so edge elements aren't clipped
    const PAD = 30;
    minX -= PAD;  minY -= PAD;
    maxX += PAD;  maxY += PAD;

    const drawingW = maxX - minX;
    const drawingH = maxY - minY;

    // Fit preserving aspect ratio
    scale = Math.min(areaW / drawingW, areaH / drawingH);

    // Center inside the available area
    offsetX = areaX + (areaW - drawingW * scale) / 2 - minX * scale;
    offsetY = areaY + (areaH - drawingH * scale) / 2 - minY * scale;
  }

  // Helpers: canvas px → PDF mm
  const tx = (x: number) => offsetX + x * scale;
  const ty = (y: number) => offsetY + y * scale;

  // ── Draw elements ──────────────────────────────────────────────────────────
  let weldCounter = 0;

  elements.forEach(el => {
    if (el.type === 'pipe' && el.points) {
      doc.setLineWidth(Math.max(0.3, 1.2 * scale));
      doc.setDrawColor(0, 100, 220);
      doc.line(tx(el.points[0]), ty(el.points[1]), tx(el.points[2]), ty(el.points[3]));

      const displayLabel = el.customLabels?.main || el.label;
      if (displayLabel) {
        doc.setFontSize(Math.max(4, 5.5 * scale * 6));
        doc.setTextColor(80);
        doc.text(
          displayLabel,
          tx((el.points[0] + el.points[2]) / 2),
          ty((el.points[1] + el.points[3]) / 2) - 1,
          { align: 'center' }
        );
      }

    } else if (el.type === 'accessory' && el.position) {
      if (el.accessoryType === 'weld') {
        weldCounter++;
        const weldLabel = el.customLabels?.weld || String(weldCounter);
        doc.setDrawColor(0);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.2);
        const r = Math.max(1.5, 3.5 * scale);
        doc.circle(tx(el.position.x), ty(el.position.y), r, 'FD');
        doc.setFontSize(Math.max(4, 4.5 * scale * 6));
        doc.setTextColor(0);
        doc.text(weldLabel, tx(el.position.x), ty(el.position.y) + 0.8, { align: 'center' });
      } else {
        doc.setDrawColor(220, 90, 0);
        doc.setLineWidth(0.4);
        const r = Math.max(1.2, 3 * scale);
        doc.circle(tx(el.position.x), ty(el.position.y), r, 'S');
        const name = accessoryNames[el.accessoryType || ''];
        if (name) {
          doc.setFontSize(Math.max(4, 4 * scale * 6));
          doc.setTextColor(180, 60, 0);
          doc.text(name, tx(el.position.x) + r + 0.5, ty(el.position.y) + 0.8);
        }
      }

    } else if (el.type === 'support' && el.position) {
      doc.setDrawColor(20, 180, 90);
      doc.setLineWidth(0.4);
      const sz = Math.max(1.5, 3 * scale);
      doc.rect(tx(el.position.x) - sz / 2, ty(el.position.y) - sz / 2, sz, sz, 'S');
      const sname = supportNames[el.supportType || ''] || 'SUP';
      doc.setFontSize(Math.max(4, 4 * scale * 6));
      doc.setTextColor(20, 130, 60);
      doc.text(sname, tx(el.position.x) + sz / 2 + 0.5, ty(el.position.y) + 0.8);
    }
  });

  // ── Page 2: BOM ────────────────────────────────────────────────────────────
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`Listado de Materiales (BOM)  ·  ${spoolName}`, 10, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Proyecto: ${projectName}`, 10, 21);

  const pipeStats: string[][]   = [];
  const pipeDetailRows: string[][] = [];
  const accessoryStats: string[][] = [];
  const supportStats: string[][]   = [];

  const pipesByDiameter: Record<number, { total: number; count: number }> = {};
  const pipeCountByDiameter: Record<number, number> = {};
  const accessories: Record<string, Record<number, number>> = {};
  const supports: Record<string, Record<number, number>> = {};

  elements.forEach((el) => {
    const diameter = el.diameter || 2;
    if (el.type === 'pipe') {
      if (!pipesByDiameter[diameter]) pipesByDiameter[diameter] = { total: 0, count: 0 };

      let lengthMm = (el.length || 0) * 50;
      if (el.customLabels?.main) {
        const parsed = parseFloat(el.customLabels.main);
        if (!isNaN(parsed) && parsed > 0) lengthMm = parsed;
      }
      pipesByDiameter[diameter].total += lengthMm;
      pipesByDiameter[diameter].count += 1;
      pipeCountByDiameter[diameter] = (pipeCountByDiameter[diameter] || 0) + 1;
      pipeDetailRows.push([
        `Niple #${pipeCountByDiameter[diameter]}`,
        `Ø ${diameter}"`,
        `${lengthMm.toFixed(0)} mm`
      ]);
    } else if (el.type === 'accessory' && el.accessoryType) {
      if (!accessories[el.accessoryType]) accessories[el.accessoryType] = {};
      accessories[el.accessoryType][diameter] = (accessories[el.accessoryType][diameter] || 0) + 1;
    } else if (el.type === 'support' && el.supportType) {
      if (!supports[el.supportType]) supports[el.supportType] = {};
      supports[el.supportType][diameter] = (supports[el.supportType][diameter] || 0) + 1;
    }
  });

  Object.entries(pipesByDiameter).forEach(([diameter, data]) => {
    pipeStats.push([`Cañería Ø ${diameter}"`, `${data.count} pcs`, `${data.total.toFixed(0)} mm`]);
  });
  Object.entries(accessories).forEach(([type, diameters]) => {
    Object.entries(diameters).forEach(([diameter, count]) => {
      accessoryStats.push([`${accessoryNames[type] || type} Ø ${diameter}"`, `${count} pcs`, '-']);
    });
  });
  Object.entries(supports).forEach(([type, diameters]) => {
    Object.entries(diameters).forEach(([diameter, count]) => {
      supportStats.push([`${supportNames[type] || type} Ø ${diameter}"`, `${count} pcs`, '-']);
    });
  });

  autoTable(doc, {
    startY: 28,
    head: [['Descripción / Item', 'Cantidad', 'Longitud Total']],
    body: [...pipeStats, ...accessoryStats, ...supportStats],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    styles: { fontSize: 9 }
  });

  if (pipeDetailRows.length > 0) {
    const summaryTable = (doc as any).lastAutoTable;
    const startY = (summaryTable?.finalY || 28) + 12;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Detalle de Niples', 10, startY - 3);
    autoTable(doc, {
      startY,
      head: [['Niple', 'Diámetro', 'Medida']],
      body: pipeDetailRows,
      theme: 'grid',
      headStyles: { fillColor: [22, 163, 74], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35 }, 2: { cellWidth: 45 } }
    });
  }

  const safeFilename = `${projectName}_${spoolName}`.replace(/[<>:"/\\|?*]/g, '_');
  doc.save(`${safeFilename}.pdf`);
};

export const exportToDXF = (elements: DrawingElement[], spoolName: string) => {
  let dxf = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nTABLES\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  elements.forEach(el => {
    if (el.type === 'pipe' && el.points) {
      dxf += `0\nLINE\n8\nPIPES\n`;
      dxf += `10\n${el.points[0]}\n20\n${-el.points[1]}\n30\n0.0\n`;
      dxf += `11\n${el.points[2]}\n21\n${-el.points[3]}\n31\n0.0\n`;
    } else if (el.type === 'accessory' && el.position) {
      dxf += `0\nCIRCLE\n8\nFITTINGS\n`;
      dxf += `10\n${el.position.x}\n20\n${-el.position.y}\n30\n0.0\n40\n10.0\n`;
    }
  });

  dxf += `0\nENDSEC\n0\nEOF\n`;

  const blob = new Blob([dxf], { type: 'application/dxf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${spoolName}.dxf`;
  link.click();
};

export const exportToPNG = (spoolName: string, projectName: string): void => {
  const { setIsExporting, theme } = useStore.getState();

  setIsExporting(true);

  setTimeout(() => {
    const container = document.querySelector('.konvajs-content');
    const canvases = container?.querySelectorAll('canvas');
    if (!canvases || canvases.length === 0) {
      alert('No se encontró el contenido del dibujo para exportar.');
      setIsExporting(false);
      return;
    }

    const firstCanvas = canvases[0];
    const offscreen = document.createElement('canvas');
    offscreen.width  = firstCanvas.width;
    offscreen.height = firstCanvas.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) { setIsExporting(false); return; }

    ctx.fillStyle = theme === 'dark' ? '#0a0b0d' : '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    canvases.forEach(canvas => { ctx.drawImage(canvas, 0, 0); });

    const safeFilename = `${projectName}_${spoolName}`.replace(/[<>:"/\\|?*]/g, '_');
    offscreen.toBlob((blob) => {
      setIsExporting(false);
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${safeFilename}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    }, 'image/png');
  }, 50);
};
