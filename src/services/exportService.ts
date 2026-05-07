import { DrawingElement } from '../store/useStore';
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

  // Page 1: Drawing
  doc.setFontSize(18);
  doc.text(`${projectName} - ${spoolName}`, 10, 15);
  doc.setFontSize(10);
  doc.text(`Generado por Achero Spool - ${new Date().toLocaleDateString()}`, 10, 22);

  // Simple drawing reproduction on PDF
  const scale = 0.4; // mm per pixel roughly
  const offsetX = 10;
  const offsetY = 40;

  doc.setDrawColor(200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 287, 200); // Border

  elements.forEach(el => {
    if (el.type === 'pipe' && el.points) {
      doc.setLineWidth(1);
      doc.setDrawColor(0, 100, 255);
      doc.line(
        offsetX + el.points[0] * scale,
        offsetY + el.points[1] * scale,
        offsetX + el.points[2] * scale,
        offsetY + el.points[3] * scale
      );
      if (el.label) {
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text(el.label, offsetX + (el.points[0] + el.points[2]) / 2 * scale, offsetY + (el.points[1] + el.points[3]) / 2 * scale - 2);
      }
    } else if (el.type === 'accessory' && el.position) {
      doc.setDrawColor(255, 100, 0);
      doc.setLineWidth(0.5);
      doc.circle(offsetX + el.position.x * scale, offsetY + el.position.y * scale, 2, 'S');
      doc.setFontSize(5);
      doc.setTextColor(0);
      doc.text(accessoryNames[el.accessoryType || ''] || 'ACC', offsetX + el.position.x * scale + 2, offsetY + el.position.y * scale);
    } else if (el.type === 'support' && el.position) {
      doc.setDrawColor(46, 213, 115);
      doc.setLineWidth(0.5);
      doc.rect(offsetX + el.position.x * scale - 1.5, offsetY + el.position.y * scale - 1.5, 3, 3, 'S');
      doc.setFontSize(5);
      doc.setTextColor(0);
      doc.text(supportNames[el.supportType || ''] || 'SUP', offsetX + el.position.x * scale + 2, offsetY + el.position.y * scale);
    }
  });

  // Page 2: BOM
  doc.addPage();
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(`Listado de Materiales (BOM) - ${spoolName}`, 10, 15);
  doc.setFontSize(10);
  doc.text(`Proyecto: ${projectName}`, 10, 22);

  // Calculate BOM data
  const pipeStats: any[] = [];
  const accessoryStats: any[] = [];
  const supportStats: any[] = [];

  const pipesByDiameter: Record<number, { total: number, count: number }> = {};
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
    } else if (el.type === 'accessory' && el.accessoryType) {
      if (!accessories[el.accessoryType]) accessories[el.accessoryType] = {};
      accessories[el.accessoryType][diameter] = (accessories[el.accessoryType][diameter] || 0) + 1;
    } else if (el.type === 'support' && el.supportType) {
      if (!supports[el.supportType]) supports[el.supportType] = {};
      supports[el.supportType][diameter] = (supports[el.supportType][diameter] || 0) + 1;
    }
  });

  // Prepare table data
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

  const finalRows = [...pipeStats, ...accessoryStats, ...supportStats];

  autoTable(doc, {
    startY: 30,
    head: [['Descripción / Item', 'Cantidad', 'Longitud Total']],
    body: finalRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    styles: { fontSize: 9 }
  });

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
      dxf += `10\n${el.points[0]}\n20\n${-el.points[1]}\n30\n0.0\n`; // y is inverted in CAD
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
