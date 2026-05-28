import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePecosaPDF = (center: any, movements: any[], days: number) => {
  const doc = new jsPDF();

  // Encabezado
  doc.setFontSize(16);
  doc.text('MUNICIPALIDAD PROVINCIAL DE ANDAHUAYLAS', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text('NOTA DE PEDIDO DE COMPROBANTE DE SALIDA (PECOSA)', 105, 25, { align: 'center' });

  // Datos del Comedor
  doc.setFontSize(10);
  doc.text(`DESTINO: ${center.name}`, 14, 40);
  doc.text(`RESPONSABLE: ${center.president_name || '---'}`, 14, 46);
  doc.text(`DÍAS ATENCIÓN: ${days}`, 140, 40);
  doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 140, 46);

  // Tabla de Productos
  const tableBody = movements.map((m, index) => [
    index + 1,
    m.product_id, // Idealmente pasar el nombre del producto, no el ID
    'UNIDAD', // Aquí deberías pasar la unidad real
    m.quantity.toFixed(2),
    // El precio unitario se captura del snapshot en BD, aquí es estimado para el PDF inmediato
    'S/. ---', 
    'S/. ---'
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['N°', 'DESCRIPCIÓN', 'UNIDAD', 'CANTIDAD', 'P. UNIT', 'VALOR TOTAL']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 9 },
  });

  // Pie de página (Firmas)
  const finalY = (doc as any).lastAutoTable.finalY + 40;
  
  doc.line(20, finalY, 80, finalY);
  doc.text('ALMACENERO', 35, finalY + 5);

  doc.line(120, finalY, 180, finalY);
  doc.text('RECIBÍ CONFORME (PRESIDENTA)', 125, finalY + 5);

  doc.setFontSize(8);
  doc.text('DOCUMENTO GENERADO DESDE SISTEMA MUNICIPAL PCA/PANTBC', 14, 285);

  doc.save(`PECOSA_${center.name}_${Date.now()}.pdf`);
};