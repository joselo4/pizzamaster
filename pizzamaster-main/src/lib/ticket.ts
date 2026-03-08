import jsPDF from 'jspdf';
import type { Order, TicketSettings } from '../types';

export const generateTicketPDF = async (order: Order, settings: TicketSettings, title: string = '--- Ticket ---'): Promise<Blob> => {
  const width = settings.paper_width === '80' ? 80 : 58;
  const margin = 2; 
  const centerX = width / 2;
  
  // CÁLCULO DE ALTURA MÁS SEGURO (Base 320mm para evitar cortes)
  let socialLines = [settings.facebook, settings.instagram, settings.tiktok, settings.wifi_pass, settings.website].filter(Boolean).length;
  
  // Contar líneas extra
  let extraSocialsList: { platform: string, handle: string }[] = [];
  try {
      if (settings.extra_socials) {
          extraSocialsList = JSON.parse(settings.extra_socials);
          socialLines += extraSocialsList.length;
      }
  } catch (e) {}

  const estimatedHeight = 320 + (order.items.length * 10) + (socialLines * 5);
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [width, estimatedHeight]
  });

  let y = 4;

  // 1. LOGO
  if (settings.show_logo && settings.logo_url) {
    try {
        const imgProps = doc.getImageProperties(settings.logo_url);
        const imgWidth = width * 0.6; 
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        doc.addImage(settings.logo_url, 'PNG', centerX - (imgWidth / 2), y, imgWidth, imgHeight);
        y += imgHeight + 5; 
    } catch (e) { 
        console.error("Error logo", e);
    }
  }

  // 2. ENCABEZADO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(width === 80 ? 12 : 10);
  
  if (settings.business_name) {
    doc.text(settings.business_name.toUpperCase(), centerX, y, { align: 'center' });
    y += 5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  if (settings.business_address) {
      const splitAddr = doc.splitTextToSize(settings.business_address, width - 6);
      doc.text(splitAddr, centerX, y, { align: 'center' });
      y += (splitAddr.length * 3.5) + 1;
  }
  
  if (settings.business_phone) {
      doc.text(`Tel: ${settings.business_phone}`, centerX, y, { align: 'center' });
      y += 5;
  }

  // TÍTULO
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, centerX, y, { align: 'center' });
  y += 6;

  // 3. DATOS ORDEN
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`ORDEN: #${order.id}`, margin, y);
  
  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  doc.text(`${dateStr} ${timeStr}`, width - margin, y, { align: 'right' });
  y += 5;

  if (order.service_type === 'Local' && order.table_number) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`MESA: ${order.table_number}`, centerX, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      y += 6;
  }

  if (settings.show_client !== false) { 
      doc.text(`CLIENTE: ${order.client_name.substring(0, 25)}`, margin, y);
      y += 5;
      if (order.service_type === 'Delivery' && order.client_address) {
        doc.setFontSize(8);
        const splitDir = doc.splitTextToSize(`DIR: ${order.client_address}`, width - 4);
        doc.text(splitDir, margin, y);
        y += (splitDir.length * 3.5);
      }
  }

  doc.text('-'.repeat(width), centerX, y, { align: 'center' });
  y += 4;

  // 4. ITEMS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CANT', margin, y);
  doc.text('PRODUCTO', margin + 8, y);
  doc.text('TOT', width - margin, y, { align: 'right' });
  y += 4;
  doc.setFont('helvetica', 'normal');

  order.items.forEach(item => {
    const totalItem = (item.price * item.qty).toFixed(2);
    const maxNameWidth = width - margin - 22; 
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.qty}`, margin, y);
    doc.setFont('helvetica', 'normal');
    
    const splitName = doc.splitTextToSize(item.name, maxNameWidth);
    doc.text(splitName, margin + 8, y);
    
    doc.text(totalItem, width - margin, y, { align: 'right' });
    y += (splitName.length * 4);
  });

  y += 2;
  doc.text('-'.repeat(width), centerX, y, { align: 'center' });
  y += 4;

  // 5. NOTAS
  if (order.notes && settings.show_notes !== false) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const splitNote = doc.splitTextToSize(`NOTA: ${order.notes}`, width - 4);
      doc.text(splitNote, margin, y);
      doc.setFont('helvetica', 'normal');
      y += (splitNote.length * 4) + 2;
  }

  // 6. TOTALES
  if (order.delivery_cost > 0) {
    doc.setFontSize(9);
    doc.text('Envío:', width - 25, y, { align: 'right' });
    doc.text(order.delivery_cost.toFixed(2), width - margin, y, { align: 'right' });
    y += 5;
  }

  doc.setFontSize(14); 
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: S/ ${order.total.toFixed(2)}`, width - margin, y, { align: 'right' });
  y += 7;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const payDetail = order.payment_method === 'Por definir' && order.pay_on_delivery ? 'Contraentrega' : order.payment_method;
  doc.text(`Pago: ${payDetail}`, margin, y);
  y += 6;

  // 7. SECCIÓN REDES SOCIALES Y EXTRAS (ACTUALIZADO)
  if (socialLines > 0) {
      y += 2;
      doc.text('-'.repeat(width), centerX, y, { align: 'center' });
      y += 5;
      doc.setFontSize(8);
      
      if(settings.wifi_pass) {
          doc.setFont('helvetica', 'bold');
          doc.text(`WIFI: ${settings.wifi_pass}`, centerX, y, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          y += 4;
      }
      
      if(settings.facebook) { doc.text(`FB: ${settings.facebook}`, centerX, y, { align: 'center' }); y += 4; }
      if(settings.instagram) { doc.text(`IG: ${settings.instagram}`, centerX, y, { align: 'center' }); y += 4; }
      if(settings.tiktok) { doc.text(`TikTok: ${settings.tiktok}`, centerX, y, { align: 'center' }); y += 4; }
      if(settings.website) { doc.text(settings.website, centerX, y, { align: 'center' }); y += 4; }
      
      // Redes Extra
      extraSocialsList.forEach(social => {
          doc.text(`${social.platform}: ${social.handle}`, centerX, y, { align: 'center' });
          y += 4;
      });
  }

  // 8. PIE DE PÁGINA (Footer)
  if (settings.footer_text) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const splitFooter = doc.splitTextToSize(settings.footer_text, width - 6);
    doc.text(splitFooter, centerX, y, { align: 'center' });
    y += (splitFooter.length * 4);
  }
  
  y += 5;
  doc.setFontSize(7);
  doc.text('.', centerX, y, { align: 'center' }); 

  return doc.output('blob');
};