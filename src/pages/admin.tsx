import { useState, useEffect, useMemo } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sendBackupToTelegram } from '../lib/telegram';
import { generateTicketPDF } from '../lib/ticket'; // Importado para reimprimir
import { 
  Trash2, Edit, Save, Plus, RefreshCw, RotateCcw, GripVertical, 
  Upload, Sparkles, AlertTriangle, DollarSign, Image as ImageIcon,
  ShoppingBag, Bike, Store, TrendingUp, FileText, MessageCircle, CheckSquare, Square,
  Shield, User as UserIcon, Users, Calendar, Search, Eye, X, Wifi, Globe, Instagram, Facebook, Video, Printer, Hash
} from 'lucide-react';
import PromoCampaignsManager from '../components/promo/PromoCampaignsManager';
import AdminPedidoSettings from './AdminPedidoSettings';
import AdminPromoToday from './AdminPromoToday';
import { refreshConfigCache } from '../lib/configCache';
import DangerZoneDbTools from '../components/DangerZoneDbTools';

import AdminMetrics from './AdminMetrics';

// ✅ Defaults visibles para Plantillas SMS (editable).
// Nota: se guardan cuando presionas GUARDAR CAMBIOS.
const DEFAULT_SMS_SALUDO = "Hola {cliente} 👋";
const DEFAULT_SMS_FIRMA = "🍕 {tienda}";
const DEFAULT_SMS_TEMPLATES = {
  sms_tpl_pendiente: DEFAULT_SMS_SALUDO + "\n\n✅ Recibimos tu pedido #{pedido}. Ya lo estamos preparando." +
    "\n🔎 Seguimiento: {track}\n\n" + DEFAULT_SMS_FIRMA,
  sms_tpl_horno: DEFAULT_SMS_SALUDO + "\n\n🔥 Tu pedido #{pedido} ya está en preparación." +
    "\n🔎 Seguimiento: {track}\n\n" + DEFAULT_SMS_FIRMA,
  sms_tpl_listo: DEFAULT_SMS_SALUDO + "\n\n🎉 Tu pedido #{pedido} está LISTO." +
    "\n🔎 Seguimiento: {track}\n\n" + DEFAULT_SMS_FIRMA,
  sms_tpl_en_transporte: DEFAULT_SMS_SALUDO + "\n\n🚚 Tu pedido #{pedido} va en camino." +
    "\n🔎 Seguimiento: {track}\n\n" + DEFAULT_SMS_FIRMA,
  sms_tpl_entregado: DEFAULT_SMS_SALUDO + "\n\n✅ Pedido #{pedido} entregado. ¡Gracias por elegirnos!" +
    "\n🔎 Seguimiento: {track}\n\n" + DEFAULT_SMS_FIRMA,
};

export default function Admin() {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState('dash');
  const [data, setData] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA')); 
  const [filterService, setFilterService] = useState('Ambos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // LOGS FILTER
  const [logLimit, setLogLimit] = useState(50); // Nuevo estado para límite de logs

  const [isModal, setIsModal] = useState(false);
  const [isClientModal, setIsClientModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null); 
  
  const [editItem, setEditItem] = useState<any>({});
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [config, setConfig] = useState<any>({});
  const [configError, setConfigError] = useState<string>('');
  const [loadingData, setLoadingData] = useState(false);
  const [stats, setStats] = useState({ total: 0, cash: 0, contra: 0, delivery: 0, local: 0, count: 0 });
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const [extraSocials, setExtraSocials] = useState<{platform: string, handle: string}[]>([]);
  const [newSocial, setNewSocial] = useState({platform: '', handle: ''});
  const [pedidoCategories, setPedidoCategories] = useState<string[]>(['Promo', 'Pizzas', 'Bebidas', 'Extras']);
  const [newPedidoCategory, setNewPedidoCategory] = useState('');
  
  // RESET ID
  const [newOrderId, setNewOrderId] = useState('');

  // --- ESTADOS PARA CHATBOT DE SOPORTE ---
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [supportChatsError, setSupportChatsError] = useState<string>('');

  // --- ORDEN DE PRODUCTOS (drag & drop) ---
  const [dragProdId, setDragProdId] = useState<string | null>(null);
  const [dragPedidoCategory, setDragPedidoCategory] = useState<string | null>(null);
  const [savingProdOrder, setSavingProdOrder] = useState(false);

  const reorderProducts = (fromId: any, toId: any) => {
    setData(prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const from = arr.findIndex((x:any) => String(x.id) === String(fromId));
      const to = arr.findIndex((x:any) => String(x.id) === String(toId));
      if (from < 0 || to < 0 || from === to) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const reorderPedidoCategories = async (fromCat: string, toCat: string) => {
    const arr = Array.isArray(pedidoCategories) ? [...pedidoCategories] : [];
    const from = arr.findIndex(c => c.toLowerCase() === fromCat.toLowerCase());
    const to = arr.findIndex(c => c.toLowerCase() === toCat.toLowerCase());
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setPedidoCategories(arr);
    try { await savePedidoCategories(arr, false); } catch (e:any) { console.warn('No se pudo auto-guardar orden de tags', e); }
  };

  const movePedidoCategory = async (cat: string, direction: -1 | 1) => {
    const arr = Array.isArray(pedidoCategories) ? [...pedidoCategories] : [];
    const index = arr.findIndex(c => c.toLowerCase() === cat.toLowerCase());
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= arr.length) return;
    const [moved] = arr.splice(index, 1);
    arr.splice(nextIndex, 0, moved);
    setPedidoCategories(arr);
    try { await savePedidoCategories(arr, false); } catch (e:any) { console.warn('No se pudo guardar orden de tags', e); }
  };

  const saveProductOrder = async () => {
    if (savingProdOrder) return;
    try {
      setSavingProdOrder(true);
      await savePedidoCategories(pedidoCategories, false);
      const arr:any[] = Array.isArray(data) ? data : [];
      const payload = arr.map((p:any, idx:number) => ({ id: p.id, index: idx + 1 }));
      const { error } = await supabase.rpc('rpc_set_product_order', { p_items: payload });
      if (error) throw error;
      setData(arr.map((p:any, idx:number) => ({ ...p, sort_index: idx + 1 })));
      await logAction(user?.username || 'Admin', 'SET_PROD_AND_TAG_ORDER', `Productos: ${payload.length}; tags: ${pedidoCategories.join(', ')}`);
      alert('✅ Orden de productos y tags guardado');
    } catch (e:any) {
      alert('❌ Error guardando orden: ' + (e?.message || e));
    } finally {
      setSavingProdOrder(false);
    }
  };

  const productsView = useMemo(() => {
    const arr:any[] = Array.isArray(data) ? data : [];
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return arr;
    return arr.filter((p:any) => String(p.name || '').toLowerCase().includes(q));
  }, [data, searchTerm, tab]);

  const productCategories = useMemo(() => {
    const base = ['Promo', 'Pizzas', 'Bebidas', 'Extras'];
    const fromProducts = (Array.isArray(data) ? data : []).map((p:any) => String(p.category || '').trim()).filter(Boolean);
    const merged = [...pedidoCategories, ...base, ...fromProducts];
    return merged.filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);
  }, [data, pedidoCategories]);

  const parsePedidoCategories = (raw: any) => {
    try {
      const value = String(raw || '').trim();
      const parsed = value.startsWith('[') ? JSON.parse(value) : value.split(/[\n,;|]+/);
      const clean = (Array.isArray(parsed) ? parsed : []).map((c:any) => String(c || '').trim()).filter(Boolean);
      return clean.length ? clean.filter((c:string, idx:number, arr:string[]) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx) : ['Promo', 'Pizzas', 'Bebidas', 'Extras'];
    } catch { return ['Promo', 'Pizzas', 'Bebidas', 'Extras']; }
  };

  const savePedidoCategories = async (next?: string[], showAlert = true) => {
    const clean = (next || pedidoCategories)
      .map(c => String(c || '').trim())
      .filter(Boolean)
      .filter(c => c.toLowerCase() !== 'todos')
      .filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);
    const finalList = clean.length ? clean : ['Promo', 'Pizzas', 'Bebidas', 'Extras'];
    try { localStorage.setItem('pedido_categories_order_v1', JSON.stringify(finalList)); } catch {}
    const { error } = await supabase
      .from('config')
      .upsert([{ key: 'pedido_categories', text_value: JSON.stringify(finalList), numeric_value: null }], { onConflict: 'key' });
    if (error) {
      if (showAlert) alert('No se pudieron guardar los tags: ' + (error.message || error));
      throw error;
    }
    setPedidoCategories(finalList);
    if (showAlert) alert('✅ Orden de tags de /pedidos guardado');
  };

  const addPedidoCategory = async () => {
    const name = newPedidoCategory.trim();
    if (!name) return;
    const next = [...pedidoCategories, name].filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);
    setNewPedidoCategory('');
    await savePedidoCategories(next);
  };

  const removePedidoCategory = async (cat: string) => {
    if (!confirm(`¿Ocultar el tag "${cat}" de /pedidos? Los productos no se eliminan.`)) return;
    await savePedidoCategories(pedidoCategories.filter(c => c.toLowerCase() !== cat.toLowerCase()));
  };

  const toggleProductActive = async (p: any) => {
    const next = !(p.active !== false);
    const { error } = await supabase.from('products').update({ active: next }).eq('id', p.id);
    if (error) return alert('No se pudo actualizar visibilidad: ' + (error.message || error));
    await logAction(user?.username || 'Admin', next ? 'SHOW_PROD' : 'HIDE_PROD', p.name);
    load();
  };


  const availablePermissions = [
      { id: 'access_pos', label: 'Toma de Pedidos' },
      { id: 'access_kitchen', label: 'Pantalla Cocina' },
      { id: 'access_delivery', label: 'Pantalla Reparto' },
      { id: 'access_cashier', label: 'Módulo Caja' },
      { id: 'access_validation', label: 'Validación' },
      { id: 'access_admin', label: 'Administración' },
  ];

  const getDayRange = (dateStr: string) => {
    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(`${dateStr}T23:59:59.999`);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const load = async () => {
    setLoadingData(true);
    const { start, end } = getDayRange(date);
    
    try {
        if (tab === 'dash') {
            const { data: orders } = await supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end).neq('status', 'Cancelado');
            if (orders) {
                const s = { total:0, cash:0, contra:0, delivery:0, local:0, count: orders.length };
                const prodCounts: any = {};
                orders.forEach(o => {
                    s.total += o.total;
                    if (o.payment_status === 'Pagado') s.cash += o.total; else s.contra += o.total;
                    if (o.service_type === 'Delivery') s.delivery++; else s.local++;
                    if (Array.isArray(o.items)) o.items.forEach((i: any) => { if (!prodCounts[i.name]) prodCounts[i.name] = 0; prodCounts[i.name] += i.qty; });
                });
                setStats(s);
                setTopProducts(Object.entries(prodCounts).sort(([,a]:any, [,b]:any) => b - a).slice(0, 5).map(([name, qty]) => ({ name, qty })));
            }
        }
        else if (tab === 'gestion') {
          let query = supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end).order('created_at', {ascending:false});
          if (filterService !== 'Ambos') query = query.eq('service_type', filterService);
          const { data } = await query; 
          setData(data || []);
        }
        else if (tab === 'logs') { 
            // NUEVO: Logs con límite dinámico y filtro de fecha
            const { data } = await supabase
                .from('system_logs')
                .select('*')
                .gte('created_at', start)
                .lte('created_at', end)
                .order('created_at', {ascending:false})
                .limit(logLimit); 
            setData(data || []); 
        }
        else if (tab === 'usuarios') { const { data } = await supabase.from('users').select('*').order('username'); setData(data || []); }
        else if (tab === 'clientes') { const { data } = await supabase.from('customers').select('*').limit(100); setData(data || []); }
        else if (tab === 'productos') {
          const [{ data }, cfgRes] = await Promise.all([
            supabase.from('products').select('*').order('name'),
            supabase.from('config').select('*').eq('key', 'pedido_categories').maybeSingle()
          ]);
          setData(data || []);
          setPedidoCategories(parsePedidoCategories((cfgRes as any)?.data?.text_value));
        }
        else if (tab === 'soporte_chats') {
          setSupportChatsError('');
          supabase.from('config').select('*').in('key', ['support_assistant_name', 'support_assistant_welcome'])
            .then(({ data: cfgData }) => {
              if (cfgData) {
                const c = { ...config };
                cfgData.forEach((r: any) => c[r.key] = r.text_value);
                setConfig(c);
              }
            });
          try {
            const { data, error } = await supabase
              .from('support_chats')
              .select('*')
              .order('created_at', { ascending: false });
            if (error) throw error;
            setSupportChats(data || []);
          } catch (e: any) {
            setSupportChatsError(e?.message || 'Error de conexión');
            try {
              const localLogs = JSON.parse(localStorage.getItem('local_support_chats_log') || '[]');
              localLogs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              setSupportChats(localLogs);
            } catch {
              setSupportChats([]);
            }
          }
        }
        else if (tab === 'config' || tab === 'promo') {
          const { data, error } = await supabase.from('config').select('*');
          setConfigError('');
          if (error) { setConfigError(error.message || 'No se pudo leer config'); return; }
          if (data) { 
              const c:any={}; 
              data.forEach((r:any) => c[r.key] = (r.text_value ?? r.numeric_value ?? r.num_value ?? r.number_value ?? r.bool_value ?? r.value)); 
              c.show_logo = c.show_logo === 'true'; c.show_notes = c.show_notes !== 'false'; c.show_client = c.show_client !== 'false';
              c.customer_notice_enabled = String(c.customer_notice_enabled) === 'true';
              
// QUIRÚRGICO: compatibilidad con claves antiguas (si existen)
if (!c.promo_cta_label && c.promo_cta) c.promo_cta_label = c.promo_cta;
if (!c.promo_detail_text && c.promo_detail) c.promo_detail_text = c.promo_detail;
if (!c.promo_price_text && (c.promo_price || c.promo_price === 0)) c.promo_price_text = `S/ ${c.promo_price}`;
if (!c.promo_wa_number && c.promo_whatsapp) c.promo_wa_number = String(c.promo_whatsapp).replace(/\D/g,'');
setConfig(c);
              try { setExtraSocials(c.extra_socials ? JSON.parse(c.extra_socials) : []); } catch(e) {}
              if (!data || data.length===0) {
                setConfigError('Config vacío o bloqueado por RLS. Ejecuta supabase_sql/06_rls_policies_hardening.sql y 09_update_config_public_policy.sql en Supabase.');
              }
          }
        }
    } catch (err) { console.error("Error loading:", err); } finally { setLoadingData(false); }
  };

  // Recargar cuando cambie el límite de logs
  useEffect(() => { if (isLoading || !user) return; load(); }, [tab, date, filterService, logLimit, isLoading, user]);

  // --- FUNCIONES AUXILIARES ---

  // NUEVO: Ver Ticket desde Historial
  const handlePrintTicket = async () => {
      if (!detailOrder) return;
      
      // Obtener config fresca para el ticket
      const { data, error } = await supabase.from('config').select('*');
          setConfigError('');
          if (error) { setConfigError(error.message || 'No se pudo leer config'); return; }
      const c: any = {};
      data?.forEach((r:any) => c[r.key] = (r.numeric_value ?? r.text_value));

      const settings = {
        business_name: c.nombre_tienda,
        business_address: c.direccion_tienda, 
        business_phone: c.telefono_tienda,    
        footer_text: c.footer_ticket,         
        paper_width: c.ancho_papel || '58',
        show_logo: String(c.show_logo) === 'true',
        show_notes: String(c.show_notes) !== 'false',
        show_client: String(c.show_client) !== 'false',
        logo_url: c.logo_url,
        facebook: c.facebook,
        instagram: c.instagram,
        tiktok: c.tiktok,
        wifi_pass: c.wifi_pass,
        website: c.website,
        extra_socials: c.extra_socials
      };

      const blob = await generateTicketPDF(detailOrder, settings, '--- Reimpresión ---');
      window.open(URL.createObjectURL(blob), '_blank');
  };

  // NUEVO: Resetear ID de pedido
  const handleResetSequence = async () => {
      const val = parseInt(newOrderId);
      if (isNaN(val) || val < 0) return alert("Ingrese un número válido");
      if (!confirm(`⚠️ ¿Seguro que quieres que el PRÓXIMO pedido sea el #${val}?`)) return;

      const { error } = await supabase.rpc('reset_order_sequence', { new_val: val });
      if (error) alert("Error: " + error.message);
      else {
          alert(`Secuencia actualizada. El próximo pedido será #${val}`);
          setNewOrderId('');
          logAction(user?.username || 'Admin', 'RESET_SEQ', `Nuevo ID: ${val}`);
      }
  };

  const openUserModal = (u: any = {}) => { setEditItem(u); setSelectedPerms(u.permissions || []); setIsModal(true); };
  const togglePermission = (pid: string) => { setSelectedPerms(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]); };
  
  const saveUser = async (e: any) => { 
      e.preventDefault(); 
      const p = { username: editItem.username, pin: editItem.pin, role: editItem.role || 'Personal', permissions: selectedPerms, active: true }; 
      if (editItem.id) await supabase.from('users').update(p).eq('id', editItem.id); else await supabase.from('users').insert([p]); 
      logAction(user?.username || 'Admin', editItem.id ? 'EDIT_USER' : 'NEW_USER', p.username); 
      setIsModal(false); load(); 
  };

  const openClientModal = (c: any = {}) => { setEditItem(c); setIsClientModal(true); };
  const saveClient = async (e: any) => {
      e.preventDefault();
      const p = { phone: editItem.phone, name: editItem.name, address: editItem.address || '' };
      await supabase.from('customers').upsert(p);
      logAction(user?.username || 'Admin', 'SAVE_CLIENT', p.name);
      setIsClientModal(false); load(); 
  };

  const saveProd = async (e: any) => { 
      e.preventDefault(); 
      const p = { name: editItem.name, price: Number(editItem.price), category: editItem.category || 'Pizzas', sort_index: (editItem.sort_index === '' || editItem.sort_index === undefined) ? null : Number(editItem.sort_index), active: editItem.active !== false, is_promo: !!editItem.is_promo }; 
      if (editItem.id) await supabase.from('products').update(p).eq('id', editItem.id); else await supabase.from('products').insert(p); 
      logAction(user?.username || 'Admin', 'SAVE_PROD', p.name);
      setIsModal(false); load(); 
  };

  const del = async (table: string, id: any) => { 
      if (confirm('¿Eliminar?')) { 
          await supabase.from(table).delete().eq(table === 'customers' ? 'phone' : 'id', id); 
          logAction(user?.username || 'Admin', 'DELETE', `${table} ${id}`);
          load(); 
      } 
  };

  const revert = async (id: number) => { 
      if (confirm('¿Regresar a Pendiente?')) { 
          await supabase.from('orders').update({status: 'Pendiente', payment_status: 'Pendiente'}).eq('id', id); 
          logAction(user?.username || 'Admin', 'REVERT_ORDER', `ID: ${id}`);
          load(); 
      } 
  };

  const handleLogoUpload = (e: any) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setConfig({ ...config, logo_url: reader.result }); }; reader.readAsDataURL(file); } };
  
  const saveConf = async () => { 
      const updates = [ 
          {key: 'costo_cerca', numeric_value: config.costo_cerca}, 
          {key: 'costo_lejos', numeric_value: config.costo_lejos}, 
          {key: 'nombre_tienda', text_value: config.nombre_tienda}, 
          {key: 'logo_url', text_value: config.logo_url}, 
          {key: 'direccion_tienda', text_value: config.direccion_tienda}, 
          {key: 'telefono_tienda', text_value: config.telefono_tienda}, 
          {key: 'footer_ticket', text_value: config.footer_ticket}, 
          {key: 'ancho_papel', text_value: config.ancho_papel}, 
          {key: 'tg_token', text_value: config.tg_token}, 
          {key: 'tg_chat_id', text_value: config.tg_chat_id}, 
          {key: 'show_logo', text_value: String(config.show_logo)}, 
          {key: 'show_notes', text_value: String(config.show_notes)}, 
          {key: 'show_client', text_value: String(config.show_client)},
          {key: 'instagram', text_value: config.instagram},
          {key: 'facebook', text_value: config.facebook},
          {key: 'tiktok', text_value: config.tiktok},
          {key: 'wifi_pass', text_value: config.wifi_pass},
          {key: 'website', text_value: config.website},
          {key: 'extra_socials', text_value: JSON.stringify(extraSocials)},
          {key: 'costo_delivery', numeric_value: Number(config.costo_delivery || 0)},
          {key: 'customer_notice_enabled', text_value: String(!!config.customer_notice_enabled)},
          {key: 'customer_notice_text', text_value: String(config.customer_notice_text || '')},
          {key: 'pedido_categories', text_value: JSON.stringify(pedidoCategories)},
      
          // === PROMO LANDING (/promo) ===
          {key: 'promo_active', text_value: String(String(config.promo_active ?? 'true') !== 'false')},
          {key: 'promo_badge', text_value: String(config.promo_badge || '')},
          {key: 'promo_headline', text_value: String(config.promo_headline || '')},
          {key: 'promo_subheadline', text_value: String(config.promo_subheadline || '')},
          {key: 'promo_body', text_value: String(config.promo_body || '')},
          {key: 'promo_price_text', text_value: String(config.promo_price_text || '')},
          {key: 'promo_detail_text', text_value: String(config.promo_detail_text || '')},
          {key: 'promo_cta_label', text_value: String(config.promo_cta_label || '')},
          {key: 'promo_cta_code', text_value: String(config.promo_cta_code || '')},
          {key: 'promo_phone', text_value: String(config.promo_phone || '')},
          {key: 'promo_wa_number', text_value: String(config.promo_wa_number || '')},
          {key: 'promo_wa_message', text_value: String(config.promo_wa_message || '')},
          {key: 'promo_promos', text_value: String(config.promo_promos || '')},
          
          // === SMS Plantillas ===
          {key: 'sms_saludo', text_value: String(config.sms_saludo || DEFAULT_SMS_SALUDO)},
          {key: 'sms_firma', text_value: String(config.sms_firma || DEFAULT_SMS_FIRMA)},
          {key: 'sms_tpl_pendiente', text_value: String(config.sms_tpl_pendiente || DEFAULT_SMS_TEMPLATES.sms_tpl_pendiente)},
          {key: 'sms_tpl_horno', text_value: String(config.sms_tpl_horno || DEFAULT_SMS_TEMPLATES.sms_tpl_horno)},
          {key: 'sms_tpl_listo', text_value: String(config.sms_tpl_listo || DEFAULT_SMS_TEMPLATES.sms_tpl_listo)},
          {key: 'sms_tpl_en_transporte', text_value: String(config.sms_tpl_en_transporte || DEFAULT_SMS_TEMPLATES.sms_tpl_en_transporte)},
          {key: 'sms_tpl_entregado', text_value: String(config.sms_tpl_entregado || DEFAULT_SMS_TEMPLATES.sms_tpl_entregado)},
]; 
      const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' });
      if (error) { console.error(error); return alert('Error guardando configuración: ' + (error.message || error)); }
      logAction(user?.username || 'Admin', 'SAVE_CONFIG', 'Update');
      await refreshConfigCache();
      
      // NUEVO: Actualizar título y favicon inmediatamente
      if (config.nombre_tienda) document.title = config.nombre_tienda;
      if (config.logo_url) {
          let link: any = document.querySelector("link[rel~='icon']");
          if (link) link.href = config.logo_url;
      }

      alert('Configuración Guardada Correctamente'); 
  };

  const addSocial = () => { if(newSocial.platform && newSocial.handle) { setExtraSocials([...extraSocials, newSocial]); setNewSocial({platform: '', handle: ''}); } };
  const removeSocial = (idx: number) => { setExtraSocials(extraSocials.filter((_, i) => i !== idx)); };
  const testTelegramBackup = async () => { if (!config.tg_token) return alert("Faltan datos"); const ok = await sendBackupToTelegram(supabase, config.tg_token, config.tg_chat_id); alert(ok ? "Enviado" : "Error"); };
  const nukeDb = async () => { if(prompt('CONFIRMAR: ELIMINAR TODO') === 'ELIMINAR TODO') { await supabase.from('orders').delete().neq('id', 0); await supabase.from('system_logs').delete().neq('id', 0); logAction(user?.username || 'Admin', 'NUKE', 'Reset DB'); load(); } };

  const filteredData = data.filter((item: any) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (item.name?.toLowerCase().includes(search)) || (item.username?.toLowerCase().includes(search)) || (item.client_name?.toLowerCase().includes(search)) || (String(item.id).includes(search));
  });

  const chatGroups = useMemo(() => {
    const groups: Record<string, {
      session_id: string;
      customer_name: string;
      customer_phone: string;
      messages: any[];
      last_message_at: string;
    }> = {};

    supportChats.forEach(c => {
      if (!groups[c.session_id]) {
        groups[c.session_id] = {
          session_id: c.session_id,
          customer_name: c.customer_name || 'Cliente Anónimo',
          customer_phone: c.customer_phone || 'Sin teléfono',
          messages: [],
          last_message_at: c.created_at
        };
      }
      groups[c.session_id].messages.push(c);
      if (new Date(c.created_at) > new Date(groups[c.session_id].last_message_at)) {
        groups[c.session_id].last_message_at = c.created_at;
      }
    });

    Object.values(groups).forEach(g => {
      g.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    const groupsList = Object.values(groups).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    if (groupsList.length === 0) {
      const mockTime = new Date();
      return [
        {
          session_id: 'sess-mock1',
          customer_name: 'Carlos Fuentes',
          customer_phone: '987654321',
          last_message_at: new Date(mockTime.getTime() - 500000).toISOString(),
          messages: [
            { sender: 'customer', message: 'Hola, ¿qué tal? ¿Tienen delivery?', created_at: new Date(mockTime.getTime() - 600000).toISOString() },
            { sender: 'assistant', message: '¡Hola! Claro que sí 🍕. Llegamos volando en 25 a 35 minutos. El costo de delivery es S/2.00 para zonas cercanas y S/4.00 si es más lejos. ¿Qué pizza te gustaría probar?', created_at: new Date(mockTime.getTime() - 580000).toISOString() },
            { sender: 'customer', message: 'Buenísimo. ¿Qué pizzas me recomiendas?', created_at: new Date(mockTime.getTime() - 550000).toISOString() },
            { sender: 'assistant', message: 'Te sugiero nuestras pizzas estrella:\n🍕 Pepperoni premium (queso abundante y pepperoni americano)\n🍕 Suprema (con carne, champiñones, pimiento y cebolla)\n🍕 Hawaiana (jamón y piña caramelizada)\n\n¿Te agrada alguna de estas opciones?', created_at: new Date(mockTime.getTime() - 530000).toISOString() }
          ]
        },
        {
          session_id: 'sess-mock2',
          customer_name: 'Maria Paz',
          customer_phone: '999888777',
          last_message_at: new Date(mockTime.getTime() - 100000).toISOString(),
          messages: [
            { sender: 'customer', message: 'Hola, ¿aceptan Yape?', created_at: new Date(mockTime.getTime() - 200000).toISOString() },
            { sender: 'assistant', message: '¡Hola! Sí, aceptamos Yape, Plin y Efectivo ⚡. Además, pagas contra entrega directamente al repartidor cuando llegue tu pizza calientita. ¡Cero riesgos!', created_at: new Date(mockTime.getTime() - 180000).toISOString() },
            { sender: 'customer', message: 'Genial, ya armo mi pedido.', created_at: new Date(mockTime.getTime() - 100000).toISOString() }
          ]
        }
      ];
    }

    return groupsList;
  }, [supportChats]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0b0b0d] text-zinc-900 dark:text-white p-4 pb-20 transition-colors duration-300">
      <div className="flex flex-wrap gap-2 pb-3 mb-3 border-b border-zinc-200 dark:border-white/5 shrink-0">
        {['dash', 'metricas', 'gestion', 'productos', 'usuarios', 'clientes', 'logs', 'config', 'pedido', 'promo','promo-hoy', 'soporte_chats'].map(t => {
            const labelsMap: Record<string, string> = {
              dash: '📊 Dashboard',
              metricas: '📈 Métricas',
              gestion: '🕒 Historial',
              productos: '🍕 Productos',
              usuarios: '👥 Usuarios',
              clientes: '📱 Clientes',
              logs: '📝 Auditoría',
              config: '⚙️ Config',
              pedido: '⚡ Ajustes',
              promo: '🎁 Landing',
              'promo-hoy': '✨ Promo Hoy',
              soporte_chats: '💬 Soporte'
            };
            return (
              <button 
                key={t} 
                onClick={() => { setTab(t); setSearchTerm(''); }} 
                className={`px-4 py-2 rounded-xl font-black text-xs whitespace-nowrap transition-all duration-200 ${
                  tab === t 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 scale-105 shadow-md shadow-orange-500/10' 
                    : 'bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/5 text-zinc-650 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 shadow-xs'
                }`}
              >
                {labelsMap[t] || t}
              </button>
            );
        })}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {tab === 'metricas' && (
          <div className="min-h-[50vh]">
            <AdminMetrics />
          </div>
        )}

        {loadingData && <div className="absolute top-0 left-0 w-full h-1 bg-gray-800"><div className="w-full h-full bg-orange-500 animate-pulse"></div></div>}

{/* QUIRÚRGICO: mostrar errores de Config y estado de carga en Config/Promo */}
{(tab === 'config' || tab === 'promo') && (
  <div className="mb-3">
    {configError && (
      <div className="mb-2 p-3 rounded-xl border border-red-500/30 bg-red-950/40 text-red-200 text-sm">
        {configError}
      </div>
    )}
    <div className="p-2 rounded-xl border border-white/10 bg-gray-900/40 text-xs text-gray-300">
      <span className="font-bold">Debug:</span> tab=<span className="text-orange-300 font-bold">{tab}</span>, 
      keys_config=<span className="font-bold">{Object.keys(config || {}).length}</span>, 
      promo_keys=<span className="font-bold">{Object.keys(config || {}).filter(k => k.startsWith('promo_')).length}</span>,
      build=<span className="font-bold text-emerald-300">INTEGRADO_FIX_v5</span>
    </div>
  </div>
)}


{/* PROMO EDITOR (QUIRÚRGICO): se muestra siempre que tab=promo */}
{tab === 'promo' && (
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Promo (Landing QR)</h2>
          <PromoCampaignsManager />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a href="/promo?ref=carlos" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-gray-800 text-orange-200 font-bold">Vista previa</a>
        <a href="/admin/promos-cards" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold">Editar promos (cards)</a>
        <button onClick={saveConf} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black">Guardar</button>
      </div>
    </div>

    <div className="bg-white dark:bg-card border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Promo activa</div>
          <button
            type="button"
            onClick={() => setConfig({ ...config, promo_active: (String(config.promo_active ?? 'true') !== 'false') ? 'false' : 'true' })}
            className={`w-full px-4 py-3 rounded-xl font-extrabold transition ${
              (String(config.promo_active ?? 'true') !== 'false') 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/10' 
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-white'
            }`}
          >
            {(String(config.promo_active ?? 'true') !== 'false') ? 'ACTIVA' : 'INACTIVA'}
          </button>
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Badge</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_badge || ''}
            onChange={(e) => setConfig({ ...config, promo_badge: e.target.value })}
            placeholder="Publicidad chismosa, promo real." />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Título (línea 1)</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_headline || ''}
            onChange={(e) => setConfig({ ...config, promo_headline: e.target.value })}
            placeholder="Carlos te engaña…" />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Título (línea 2)</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_subheadline || ''}
            onChange={(e) => setConfig({ ...config, promo_subheadline: e.target.value })}
            placeholder="pero con su dieta." />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300 md:col-span-2">
          <div className="font-extrabold mb-1.5">Texto principal</div>
          <textarea className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 min-h-[96px] outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_body || ''}
            onChange={(e) => setConfig({ ...config, promo_body: e.target.value })}
            placeholder="Pizza personal + botellita de chicha por S/10…" />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Precio (texto)</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_price_text || ''}
            onChange={(e) => setConfig({ ...config, promo_price_text: e.target.value })}
            placeholder="S/ 10" />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Detalle (texto)</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_detail_text || ''}
            onChange={(e) => setConfig({ ...config, promo_detail_text: e.target.value })}
            placeholder="Pizza personal + chicha…" />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">CTA (botón)</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_cta_label || ''}
            onChange={(e) => setConfig({ ...config, promo_cta_label: e.target.value })}
            placeholder="Pedir ahora" />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Código promo</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_cta_code || ''}
            onChange={(e) => setConfig({ ...config, promo_cta_code: e.target.value })}
            placeholder="CARLOS10" />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">Teléfono</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_phone || ''}
            onChange={(e) => setConfig({ ...config, promo_phone: e.target.value })}
            placeholder="+51..." />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          <div className="font-extrabold mb-1.5">WhatsApp (número)</div>
          <input className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_wa_number || ''}
            onChange={(e) => setConfig({ ...config, promo_wa_number: e.target.value })}
            placeholder="51999..." />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300 md:col-span-2">
          <div className="font-extrabold mb-1.5">Mensaje WhatsApp</div>
          <textarea className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 min-h-[80px] outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_wa_message || ''}
            onChange={(e) => setConfig({ ...config, promo_wa_message: e.target.value })}
            placeholder="Hola 👋 Quiero la promo..." />
        </label>

        <label className="text-sm text-zinc-700 dark:text-zinc-300 md:col-span-2">
          <div className="font-extrabold mb-1.5">Promos (JSON opcional)</div>
          <textarea className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-3 min-h-[120px] font-mono text-xs outline-none focus:border-orange-500/50 shadow-xs"
            value={config.promo_promos || ''}
            onChange={(e) => setConfig({ ...config, promo_promos: e.target.value })}
            placeholder='[{"tag":"TOP","title":"Promo CARLOS","price":"S/ 10","note":"Pizza personal + chicha","promo":"CARLOS10","bullets":["Delivery gratis hoy"]}]' />
        </label>
      </div>
    </div>
  </div>
)}
        {/* Filtros Globales */}
        {(tab === 'dash' || tab === 'gestion' || tab === 'logs') && (
            <div className="flex flex-wrap gap-2 mb-4 bg-white dark:bg-card p-3 rounded-xl items-center sticky top-0 z-10 shadow-sm border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/30 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <Calendar size={16} className="text-zinc-400 dark:text-zinc-500"/>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-zinc-800 dark:text-white text-sm outline-none w-full" />
                </div>
                {tab === 'gestion' && (
                    <select value={filterService} onChange={e => setFilterService(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900/30 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm flex-1 text-zinc-800 dark:text-white outline-none">
                        <option value="Ambos" className="bg-white dark:bg-[#1E1E1E]">Todos</option>
                        <option value="Delivery" className="bg-white dark:bg-[#1E1E1E]">Delivery</option>
                        <option value="Local" className="bg-white dark:bg-[#1E1E1E]">Local</option>
                    </select>
                )}
                {/* NUEVO: Selector de Cantidad para Logs */}
                {tab === 'logs' && (
                    <select value={logLimit} onChange={e => setLogLimit(Number(e.target.value))} className="bg-zinc-50 dark:bg-zinc-900/30 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm w-24 text-zinc-800 dark:text-white outline-none">
                        <option value="50" className="bg-white dark:bg-[#1E1E1E]">50</option>
                        <option value="75" className="bg-white dark:bg-[#1E1E1E]">75</option>
                        <option value="100" className="bg-white dark:bg-[#1E1E1E]">100</option>
                        <option value="125" className="bg-white dark:bg-[#1E1E1E]">125</option>
                        <option value="150" className="bg-white dark:bg-[#1E1E1E]">150</option>
                        <option value="200" className="bg-white dark:bg-[#1E1E1E]">200</option>
                    </select>
                )}
                <button onClick={load} className="bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-750 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 p-2 rounded-lg transition-colors"><RefreshCw size={18}/></button>
            </div>
        )}

        {(tab === 'usuarios' || tab === 'clientes' || tab === 'productos') && (
            <div className="mb-4 relative">
                <Search className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-500" size={18} />
                <input className="w-full bg-white dark:bg-card p-3 pl-10 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-white focus:border-orange-500 outline-none shadow-xs placeholder-zinc-400 dark:placeholder-white/35" placeholder={`Buscar en ${tab}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        )}

        {tab === 'dash' && (
          <div className="space-y-4 animate-in fade-in">
             <div className="grid grid-cols-2 gap-3">
               <div className="bg-gradient-to-br from-green-600 to-green-900 p-4 rounded-2xl shadow-lg col-span-2 flex items-center justify-between">
                 <div>
                   <h3 className="text-green-100 font-black text-xs uppercase tracking-wider opacity-90">VENTA TOTAL</h3>
                   <div className="text-4xl font-black text-white">S/ {stats.total.toFixed(2)}</div>
                 </div>
                 <DollarSign size={40} className="text-green-300 opacity-40"/>
               </div>
               <div className="bg-white dark:bg-card p-4 rounded-xl border border-zinc-200 dark:border-white/10 border-l-4 border-l-blue-500 dark:border-l-4 dark:border-l-blue-500 shadow-xs">
                 <h3 className="text-zinc-400 dark:text-zinc-550 text-xs font-black uppercase tracking-wider">PAGADO</h3>
                 <div className="text-2xl font-black text-zinc-800 dark:text-white mt-1">S/ {stats.cash.toFixed(2)}</div>
               </div>
               <div className="bg-white dark:bg-card p-4 rounded-xl border border-zinc-200 dark:border-white/10 border-l-4 border-l-orange-500 dark:border-l-4 dark:border-l-orange-500 shadow-xs">
                 <h3 className="text-zinc-400 dark:text-zinc-550 text-xs font-black uppercase tracking-wider">POR COBRAR</h3>
                 <div className="text-2xl font-black text-orange-650 dark:text-orange-500 mt-1">S/ {stats.contra.toFixed(2)}</div>
               </div>
             </div>
             <div className="grid grid-cols-3 gap-3 text-center">
               <div className="bg-white dark:bg-card p-3 rounded-xl border border-zinc-200 dark:border-white/10 shadow-xs">
                 <h3 className="text-zinc-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1">PEDIDOS</h3>
                 <div className="text-xl font-black text-zinc-800 dark:text-white flex justify-center items-center gap-1"><ShoppingBag size={15}/> {stats.count}</div>
               </div>
               <div className="bg-white dark:bg-card p-3 rounded-xl border border-zinc-200 dark:border-white/10 shadow-xs">
                 <h3 className="text-zinc-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1">DELIVERY</h3>
                 <div className="text-xl font-black text-zinc-800 dark:text-white flex justify-center items-center gap-1"><Bike size={15}/> {stats.delivery}</div>
               </div>
               <div className="bg-white dark:bg-card p-3 rounded-xl border border-zinc-200 dark:border-white/10 shadow-xs">
                 <h3 className="text-zinc-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1">LOCAL</h3>
                 <div className="text-xl font-black text-zinc-800 dark:text-white flex justify-center items-center gap-1"><Store size={15}/> {stats.local}</div>
               </div>
             </div>
             <div className="bg-white dark:bg-card rounded-2xl p-4 border border-zinc-200 dark:border-white/10 shadow-sm leading-snug">
               <h3 className="text-orange-600 dark:text-orange-400 font-black mb-3 flex items-center gap-2"><TrendingUp size={18}/> TOP PRODUCTOS HOY</h3>
               <div className="space-y-2">
                 {topProducts.map((p, idx) => (
                   <div key={idx} className="flex justify-between items-center border-b border-zinc-150 dark:border-white/5 pb-1 last:border-0">
                     <span className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100">#{idx+1} {p.name}</span>
                     <span className="bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 px-2.5 py-0.5 rounded-full text-xs font-black">{p.qty} un.</span>
                   </div>
                 ))}
                 {!topProducts.length && (
                   <div className="text-zinc-450 text-xs italic py-2">No se han registrado ventas hoy.</div>
                 )}
               </div>
             </div>
          </div>
        )}

        {tab === 'soporte_chats' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <span>💬 Monitoreo de Asistente de Soporte</span>
                </h2>
                <p className="text-xs text-zinc-550 dark:text-white/60">
                  Visualiza en tiempo real las interacciones y respuestas automáticas brindadas por el asistente virtual.
                </p>
              </div>
              <button 
                onClick={load} 
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-955 font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
              >
                <RefreshCw size={15}/> Actualizar Mensajes
              </button>
            </div>

            {/* PERSONALIZACIÓN DEL ASISTENTE */}
            <div className="bg-white dark:bg-card border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-zinc-800 dark:text-white flex items-center gap-2 border-b border-zinc-150 dark:border-white/5 pb-2">
                <Sparkles size={16} className="text-orange-500" />
                <span>Personalización del Asistente Virtual</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase">Nombre del Asistente</label>
                  <input 
                    type="text" 
                    value={config.support_assistant_name || 'Doña Pizzita - Asistente'} 
                    onChange={e => setConfig({ ...config, support_assistant_name: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-orange-500/50" 
                    placeholder="Ej: Doña Pizzita - Asistente" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase">Mensaje de Saludo Inicial</label>
                  <input 
                    type="text" 
                    value={config.support_assistant_welcome || '¡Hola! 🍕 Soy Doña Pizzita - Asistente, tu experta pizzera virtual. ¿Qué pizza se te antoja hoy? Puedo recomendarte sabores, darte precios, detalles de delivery o métodos de pago. ¡Pregúntame lo que gustes!'} 
                    onChange={e => setConfig({ ...config, support_assistant_welcome: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-orange-500/50" 
                    placeholder="Ej: ¡Hola! Soy el asistente..." 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase.from('config').upsert([
                      { key: 'support_assistant_name', text_value: config.support_assistant_name || 'Doña Pizzita - Asistente' },
                      { key: 'support_assistant_welcome', text_value: config.support_assistant_welcome || '' }
                    ], { onConflict: 'key' });
                    if (error) alert('❌ Error al guardar configuración: ' + error.message);
                    else {
                      alert('✅ Configuración del Asistente guardada con éxito.');
                      try { await refreshConfigCache(); } catch {}
                    }
                  }}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95"
                >
                  Guardar Configuración del Asistente
                </button>
              </div>
            </div>

            {supportChatsError && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                <div className="font-bold flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Modo Local Resiliente Activo (Auditoría Local)
                </div>
                <div className="mt-1 text-xs">
                  La tabla <code>support_chats</code> no está creada en Supabase o no tiene políticas. Las conversaciones se guardan localmente. Ejecuta este código SQL en la consola SQL de tu Supabase para activar el Monitoreo Centralizado de Chats:
                </div>
                <div className="mt-3 relative bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono text-xs text-amber-300 overflow-x-auto max-h-40">
                  <pre>{`-- Asegurar la existencia de la función session_role() para RLS
CREATE OR REPLACE FUNCTION public.session_role()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_token_text text;
  v_token uuid;
  v_role text;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operator_sessions') THEN
    BEGIN
      v_token_text := nullif(current_setting('request.headers', true)::jsonb ->> 'x-session-token', '');
      IF v_token_text IS NULL THEN
        RETURN NULL;
      END IF;
      v_token := v_token_text::uuid;
      SELECT role INTO v_role FROM public.operator_sessions 
      WHERE token = v_token AND revoked = false AND now() < expires_at LIMIT 1;
      RETURN v_role;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.support_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert for support_chats" ON public.support_chats;
CREATE POLICY "Allow public insert for support_chats" ON public.support_chats FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select for support_chats" ON public.support_chats;
CREATE POLICY "Allow select for support_chats" ON public.support_chats FOR SELECT TO public USING (public.session_role() IS NOT NULL);`}</pre>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`-- Asegurar la existencia de la función session_role() para RLS
CREATE OR REPLACE FUNCTION public.session_role()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_token_text text;
  v_token uuid;
  v_role text;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operator_sessions') THEN
    BEGIN
      v_token_text := nullif(current_setting('request.headers', true)::jsonb ->> 'x-session-token', '');
      IF v_token_text IS NULL THEN
        RETURN NULL;
      END IF;
      v_token := v_token_text::uuid;
      SELECT role INTO v_role FROM public.operator_sessions 
      WHERE token = v_token AND revoked = false AND now() < expires_at LIMIT 1;
      RETURN v_role;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.support_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert for support_chats" ON public.support_chats;
CREATE POLICY "Allow public insert for support_chats" ON public.support_chats FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select for support_chats" ON public.support_chats;
CREATE POLICY "Allow select for support_chats" ON public.support_chats FOR SELECT TO public USING (public.session_role() IS NOT NULL);`);
                      alert('📋 Código SQL copiado al portapapeles');
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-amber-500 text-zinc-955 font-black rounded-lg text-[10px] hover:bg-amber-400 active:scale-95 transition-all"
                  >
                    Copiar SQL
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LISTA DE CHATS */}
              <div className="lg:col-span-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-card p-4 shadow-sm dark:shadow-md max-h-[60vh] overflow-y-auto no-scrollbar">
                <h3 className="text-sm font-black text-zinc-800 dark:text-white mb-3">Sesiones Activas</h3>
                <div className="space-y-2">
                  {chatGroups.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400 text-xs italic">
                      No hay conversaciones activas. Realiza pruebas interactuando con el widget de chat en la landing de promociones.
                    </div>
                  ) : (
                    chatGroups.map(g => {
                      const isActive = selectedSessionId === g.session_id;
                      const lastMsg = g.messages[g.messages.length - 1];
                      return (
                        <div 
                          key={g.session_id} 
                          onClick={() => setSelectedSessionId(g.session_id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isActive 
                              ? 'border-orange-500/50 bg-orange-500/5 dark:bg-orange-500/10' 
                              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-orange-300/30'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-extrabold text-xs text-zinc-800 dark:text-white truncate">
                              {g.customer_name}
                            </span>
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              {new Date(g.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-550 dark:text-white/60 truncate mt-0.5">
                            {g.customer_phone}
                          </div>
                          <p className="text-[11px] text-zinc-600 dark:text-white/70 truncate mt-1 italic">
                            {lastMsg ? `Último: ${lastMsg.message}` : ''}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* DETALLE DEL CHAT */}
              <div className="lg:col-span-8 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-card p-4 shadow-sm dark:shadow-md flex flex-col h-[60vh]">
                {selectedSessionId ? (
                  (() => {
                    const session = chatGroups.find(g => g.session_id === selectedSessionId);
                    if (!session) return <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs italic">Selecciona una conversación del panel de la izquierda</div>;
                    return (
                      <>
                        <div className="pb-3 border-b border-zinc-150 dark:border-white/5 flex justify-between items-center shrink-0">
                          <div>
                            <div className="font-black text-sm text-zinc-850 dark:text-white">{session.customer_name}</div>
                            <div className="text-[10px] text-zinc-500 dark:text-white/60">{session.customer_phone} • ID: {session.session_id}</div>
                          </div>
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300/30 text-emerald-800 dark:text-emerald-300 px-3 py-1 text-[10px] font-black uppercase">
                            Monitoreado
                          </span>
                        </div>

                        <div className="flex-1 overflow-y-auto py-4 space-y-3 no-scrollbar">
                          {session.messages.map((m, idx) => {
                            const isAssistant = m.sender === 'assistant';
                            return (
                              <div key={idx} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line shadow-xs ${
                                  isAssistant 
                                    ? 'rounded-tl-none bg-zinc-100 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5 text-zinc-850 dark:text-zinc-200' 
                                    : 'rounded-tr-none bg-gradient-to-r from-orange-500 to-amber-500 text-white dark:text-slate-955 font-semibold'
                                }`}>
                                  <div className="text-[9px] opacity-75 font-bold uppercase mb-0.5">
                                    {isAssistant ? 'Doña Pizzita - Asistente 🍕' : 'Cliente 👤'}
                                  </div>
                                  <div>{m.message}</div>
                                  <div className="text-[8px] opacity-60 text-right mt-1">
                                    {new Date(m.created_at).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs italic">
                    <MessageCircle size={36} className="mb-2 opacity-25" />
                    Selecciona una conversación del panel lateral para inspeccionar el diálogo
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'gestion' && (
          <div className="pb-10">
             <div className="space-y-2">
                 {data.map((o: any) => (
                    <div key={o.id} onClick={() => setDetailOrder(o)} className="bg-white dark:bg-card border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs active:bg-zinc-100 dark:active:bg-zinc-850 transition-colors cursor-pointer flex justify-between items-center group text-zinc-800 dark:text-zinc-100">
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${o.service_type === 'Delivery' ? 'bg-blue-600' : 'bg-orange-600'}`}>{o.service_type === 'Delivery' ? <Bike size={20}/> : <Store size={20}/>}</div>
                          <div className="flex-1 min-w-0">
                              <div className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">#{o.id} - {o.client_name}</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-col">
                                <span>{new Date(o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {o.payment_status} • {(o.final_payment_method || o.payment_method || '—')}</span>
                                {o.service_type === 'Delivery' && o.client_address && (<span className="text-blue-600 dark:text-blue-300 truncate max-w-[200px] block mt-0.5">{o.client_address}</span>)}
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="text-right shrink-0">
                            <div className="text-lg font-black text-green-600 dark:text-green-455">S/ {Number(o.total || 0).toFixed(2)}</div>
                            {o.delivery_cost > 0 && <div className="text-[9px] text-blue-500 dark:text-blue-400 font-bold">+S/{o.delivery_cost} env</div>}
                          </div>
                          <Eye size={20} className="text-zinc-400 group-hover:text-zinc-650 dark:group-hover:text-white transition-colors"/> 
                      </div>
                    </div>
                 ))}
             </div>
             
             {/* MODAL DETALLE CON BOTÓN DE TICKET */}
             {detailOrder && (
               <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200" onClick={() => setDetailOrder(null)}>
                 <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 bg-zinc-55 dark:bg-gray-900 border-b border-zinc-200 dark:border-white/5 flex justify-between items-center">
                      <h3 className="font-black text-zinc-850 dark:text-white">Detalle Orden #{detailOrder.id}</h3>
                      <button onClick={() => setDetailOrder(null)} className="text-zinc-400 hover:text-zinc-600 dark:text-white/60 dark:hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="p-4 overflow-y-auto space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-zinc-450 dark:text-zinc-500 font-bold">Fecha:</div>
                        <div className="text-zinc-800 dark:text-white text-right">{new Date(detailOrder.created_at).toLocaleString()}</div>
                        <div className="text-zinc-450 dark:text-zinc-500 font-bold">Cliente:</div>
                        <div className="text-zinc-800 dark:text-white text-right font-black">{detailOrder.client_name}</div>
                        <div className="text-zinc-450 dark:text-zinc-500 font-bold whitespace-normal break-words max-w-full leading-snug">Pagó con:</div>
                        <div className="text-zinc-800 dark:text-white text-right">{detailOrder.final_payment_method || detailOrder.payment_method || '—'}</div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-black/35 rounded-2xl p-3 border border-zinc-150 dark:border-white/5">
                        {detailOrder.items.map((i:any, idx:number) => (
                          <div key={(i.id || i.name || 'item') + '-' + idx} className="flex justify-between py-1.5 border-b border-zinc-200/50 dark:border-white/5 last:border-0 text-sm">
                            <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{i.qty} x {i.name}</span>
                            <span className="text-zinc-500 dark:text-white/45">S/ {Number((i.price || 0) * (i.qty || 0)).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-2 font-black text-xl text-green-605 dark:text-green-500 border-t border-zinc-200/60 dark:border-white/5 mt-2">
                          <span>TOTAL</span>
                          <span>S/ {Number(detailOrder.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* NUEVO BOTÓN VER TICKET */}
                    <div className="p-3.5 bg-zinc-50 dark:bg-gray-900 border-t border-zinc-200 dark:border-white/5 flex flex-col gap-2">
                        <button onClick={handlePrintTicket} className="w-full bg-yellow-600 hover:bg-yellow-500 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-sm transition"><Printer size={16}/> VER TICKET</button>
                        <div className="flex gap-2">
                           <button onClick={() => revert(detailOrder.id)} className="flex-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-200 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-blue-200 dark:border-blue-800 transition"><RotateCcw size={14}/> REABRIR</button>
                           <button onClick={() => { del('orders', detailOrder.id); setDetailOrder(null); }} className="flex-1 bg-red-50 dark:bg-red-900/30 text-red-650 dark:text-red-200 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-red-200 dark:border-red-800 transition"><Trash2 size={14}/> ELIMINAR</button>
                        </div>
                    </div>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* LOGS DETALLADOS */}
        {tab === 'logs' && (
             <div className="space-y-2 pb-10">
                {data.length === 0 ? <div className="text-center text-zinc-400 dark:text-gray-500 py-10">Sin registros en esta fecha</div> : data.map(l => (
                    <div key={l.id} className="bg-white dark:bg-card p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs flex gap-3 items-start shadow-xs">
                        <div className="mt-1 text-zinc-500 dark:text-gray-500 font-mono text-[10px]">{new Date(l.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</div>
                        <div className="flex-1">
                            <div className="flex justify-between mb-1">
                                <span className="text-orange-655 dark:text-orange-500 font-black">{l.user_name}</span>
                                <span className="text-zinc-500 dark:text-gray-400 bg-zinc-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md text-[9px] font-bold">{l.action}</span>
                            </div>
                            <div className="text-zinc-700 dark:text-gray-300 break-words font-medium">{l.details}</div>
                        </div>
                    </div>
                ))}
             </div>
        )}

        {tab === 'usuarios' && (
            <div>
                <button onClick={() => openUserModal({})} className="mb-4 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2.5 rounded-xl font-bold flex gap-2 shadow-sm transition"><Plus size={18} /> Nuevo Usuario</button>
                <div className="grid gap-2">{filteredData.map((i: any, idx: number) => (
                    <div key={i.id} className="bg-white dark:bg-card p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center shadow-xs">
                      <div>
                        <div className="font-extrabold text-zinc-850 dark:text-white flex items-center gap-2">
                          <UserIcon size={16} className="text-orange-500"/> {i.username} {i.role === 'Admin' && <span className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] px-2.5 py-0.5 rounded-full font-black">ADMIN</span>}
                        </div>
                        <div className="text-xs text-zinc-450 dark:text-gray-400 mt-1.5 flex flex-wrap gap-1">
                          {(i.permissions || []).map((p:string) => (<span key={p} className="bg-zinc-100 dark:bg-gray-700 text-zinc-600 dark:text-zinc-200 px-1.5 rounded">{p.replace('access_', '').toUpperCase()}</span>))}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => openUserModal(i)} className="text-blue-500 hover:text-blue-650 transition" title="Editar"><Edit size={18} /></button>
                        <button onClick={() => del('users', i.id)} className="text-red-500 hover:text-red-650 transition" title="Eliminar"><Trash2 size={18} /></button>
                      </div>
                    </div>
                ))}</div>
                {isModal && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setIsModal(false)}>
                    <form onSubmit={saveUser} className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-850 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                      <h3 className="text-xl font-black mb-4 text-zinc-900 dark:text-white">{editItem.id ? 'Editar' : 'Nuevo'} Usuario</h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="user_username" className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Nombre de usuario</label>
                          <input id="user_username" name="username" autoComplete="username" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl outline-none focus:border-orange-500/50" value={editItem.username || ''} onChange={e => setEditItem({...editItem, username: e.target.value})} />
                        </div>
                        <div>
                          <label htmlFor="user_pin" className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">PIN (4 dígitos)</label>
                          <input id="user_pin" name="pin" autoComplete="one-time-code" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl outline-none focus:border-orange-500/50" type="tel" maxLength={4} value={editItem.pin || ''} onChange={e => setEditItem({...editItem, pin: e.target.value})} />
                        </div>
                        <div className="bg-zinc-50 dark:bg-black/35 p-4 rounded-2xl border border-zinc-150 dark:border-white/5">
                          <label className="text-xs font-black text-orange-600 dark:text-orange-500 block mb-3.5 flex items-center gap-1.5"><Shield size={13}/> PERMISOS DE ACCESO</label>
                          <div className="space-y-2.5">
                            {availablePermissions.map(p => (
                              <label key={p.id} className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-zinc-200/40 dark:hover:bg-white/5 rounded-xl transition-colors select-none text-zinc-700 dark:text-zinc-300">
                                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${selectedPerms.includes(p.id) ? 'bg-green-600 border-green-500' : 'border-zinc-300 dark:border-zinc-650'}`}>
                                  {selectedPerms.includes(p.id) && <CheckSquare size={14} className="text-white"/>}
                                </div>
                                <input id={`perm_${p.id}`} name={`perm_${p.id}`} type="checkbox" className="hidden" checked={selectedPerms.includes(p.id)} onChange={() => togglePermission(p.id)} />
                                <span className="text-sm font-semibold">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button type="button" onClick={() => setIsModal(false)} className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 p-3 rounded-xl text-sm font-bold text-zinc-700 dark:text-white transition">Cancelar</button>
                        <button className="flex-1 bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl text-sm font-black shadow-md transition">Guardar</button>
                      </div>
                    </form>
                  </div>
                )}
            </div>
        )}

        {tab === 'clientes' && (
             <div>
                 <button onClick={() => openClientModal({})} className="mb-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold flex gap-2 shadow-sm transition"><Plus size={18} /> Nuevo Cliente</button>
                 <div className="grid gap-2 whitespace-normal break-words max-w-full leading-snug">
                   {filteredData.map((i: any, idx: number) => (
                     <div key={`${String(i.phone || '')}-${idx}`} className="bg-white dark:bg-card p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center shadow-xs">
                       <div>
                         <div className="font-extrabold text-zinc-850 dark:text-white flex items-center gap-2">
                           <Users size={16} className="text-blue-500"/> {i.name}
                         </div>
                         <div className="text-xs text-zinc-500 dark:text-gray-400 mt-1">
                           {i.phone} {i.address && <span className="text-zinc-450 dark:text-zinc-500">({i.address})</span>}
                         </div>
                       </div>
                       <div className="flex gap-3">
                         <button onClick={() => openClientModal(i)} className="text-blue-500 hover:text-blue-650 transition"><Edit size={18}/></button>
                         <button onClick={() => del('customers', i.phone)} className="text-red-500 hover:text-red-650 transition"><Trash2 size={18}/></button>
                       </div>
                     </div>
                   ))}
                 </div>
                 {isClientModal && (
                   <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setIsClientModal(false)}>
                     <form onSubmit={saveClient} className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
                       <h3 className="text-xl font-black mb-4 text-zinc-900 dark:text-white">{editItem.phone ? 'Editar' : 'Nuevo'} Cliente</h3>
                       <label htmlFor="client_phone" className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Teléfono</label>
                       <input id="client_phone" name="client_phone" autoComplete="tel" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mb-3.5 outline-none focus:border-orange-500/50" placeholder="Teléfono" value={editItem.phone || ''} onChange={e => setEditItem({...editItem, phone: e.target.value})} disabled={!!editItem.phone && !!data.find(c => c.phone === editItem.phone)} />
                       <label htmlFor="client_name" className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Nombre</label>
                       <input id="client_name" name="client_name" autoComplete="name" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mb-3.5 outline-none focus:border-orange-500/50" placeholder="Nombre" value={editItem.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} />
                       <label htmlFor="client_address" className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Dirección</label>
                       <input id="client_address" name="client_address" autoComplete="street-address" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mb-4.5 outline-none focus:border-orange-500/50" placeholder="Dirección" value={editItem.address || ''} onChange={e => setEditItem({...editItem, address: e.target.value})} />
                       <div className="flex gap-3">
                         <button type="button" onClick={() => setIsClientModal(false)} className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 p-3 rounded-xl text-sm font-bold text-zinc-750 dark:text-white transition">Cancelar</button>
                         <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-black shadow-md transition">Guardar</button>
                       </div>
                     </form>
                   </div>
                 )}
             </div>
        )}

        
{tab === 'productos' && (
  <div className="space-y-4 text-zinc-850 dark:text-white">
    <div className="rounded-2xl border border-zinc-200 dark:border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-white dark:via-card to-white dark:to-card p-5 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Productos y tags de /pedidos</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-gray-400">Crea tags nuevos, asigna productos existentes o nuevos, y organiza su orden de visualización.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setSelectedPerms([]); setEditItem({ active: true, category: productCategories.find(c => c !== 'Promo') || 'Pizzas' }); setIsModal(true); }} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold flex gap-2 items-center shadow-md transition">
            <Plus size={18}/> Nuevo producto
          </button>
          <button onClick={saveProductOrder} disabled={savingProdOrder || !Array.isArray(data) || data.length === 0}
            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2.5 rounded-xl font-bold flex gap-2 items-center shadow-md transition disabled:opacity-60">
            <Save size={18}/> {savingProdOrder ? 'Guardando...' : 'Guardar orden'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-355">Tags visibles en /pedidos</div>
          <div className="flex flex-wrap gap-2">
            {pedidoCategories.map((cat, idx) => (
              <span
                key={cat}
                draggable
                onDragStart={() => setDragPedidoCategory(cat)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragPedidoCategory) void reorderPedidoCategories(dragPedidoCategory, cat); setDragPedidoCategory(null); }}
                onDragEnd={() => setDragPedidoCategory(null)}
                className="inline-flex cursor-move items-center gap-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/10 px-3 py-1.5 text-xs font-extrabold text-zinc-800 dark:text-zinc-200 shadow-xs"
                title="Arrastra para ordenar o usa las flechas. Se auto-guarda al cambiar."
              >
                <GripVertical size={14} className="text-zinc-450 dark:text-gray-300" />
                <button type="button" disabled={idx === 0} onClick={() => movePedidoCategory(cat, -1)} className="rounded-full bg-zinc-200 dark:bg-black/25 px-1.5 text-zinc-700 dark:text-white/80 disabled:opacity-30" title="Mover a la izquierda">←</button>
                <span className="px-1 text-zinc-900 dark:text-white">{cat}</span>
                <button type="button" disabled={idx === pedidoCategories.length - 1} onClick={() => movePedidoCategory(cat, 1)} className="rounded-full bg-zinc-200 dark:bg-black/25 px-1.5 text-zinc-700 dark:text-white/80 disabled:opacity-30" title="Mover a la derecha">→</button>
                <button type="button" onClick={() => removePedidoCategory(cat)} className="rounded-full bg-zinc-200 dark:bg-black/25 p-1 text-red-655 dark:text-red-200 hover:bg-red-500/20" title="Ocultar tag"><X size={13}/></button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <input list="pedido-category-options" className="bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 px-3.5 py-2.5 rounded-xl w-full sm:w-64 outline-none focus:border-orange-500/50 shadow-xs" placeholder="Nuevo tag: Hamburguesas" value={newPedidoCategory} onChange={e => setNewPedidoCategory(e.target.value)} />
          <button type="button" onClick={addPedidoCategory} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold transition">Agregar tag</button>
        </div>
      </div>
      <datalist id="pedido-category-options">
        {productCategories.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      <div className="text-xs text-zinc-500 dark:text-gray-400 font-medium">
        Tip: ordena los tags arrastrando o usando las flechas ← →. El orden de los productos se puede guardar con <b>Guardar orden</b>.
      </div>
      <div className="flex items-center gap-2">
        <input className="bg-white dark:bg-card text-zinc-900 dark:text-white px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-72 outline-none focus:border-orange-500/50" placeholder="Buscar producto..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <button onClick={() => setSearchTerm('')} className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-gray-300 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 transition" title="Limpiar">
          <X size={18}/>
        </button>
      </div>
    </div>

    <div className="grid gap-2">
      {(productsView as any[]).map((p: any, idx: number) => {
        const visible = p.active !== false;
        return (
        <div key={p.id} draggable onDragStart={() => setDragProdId(String(p.id))} onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragProdId) reorderProducts(dragProdId, p.id); setDragProdId(null); }}
          className={`bg-white dark:bg-card p-3.5 rounded-2xl border flex justify-between items-center gap-3 shadow-xs ${visible ? 'border-zinc-200 dark:border-zinc-800' : 'border-red-500/20 dark:border-red-500/30 opacity-70'} ${dragProdId === String(p.id) ? 'ring-2 ring-orange-500/60' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-zinc-400 dark:text-zinc-550 cursor-grab active:cursor-grabbing p-1 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg" title="Arrastrar"><GripVertical size={18}/></div>
            <div className="min-w-0">
              <div className="font-extrabold text-zinc-850 dark:text-white whitespace-normal break-words max-w-full leading-snug">{p.name}</div>
              <div className="text-sm text-orange-605 dark:text-orange-500 font-black">S/ {Number(p.price || 0).toFixed(2)}</div>
              <div className="text-[11px] text-zinc-500 dark:text-gray-400 mt-0.5">Orden: <b>{p.sort_index ?? (idx + 1)}</b> • Tag: {p.category || '—'}{p.is_promo ? ' • Promo' : ''} • {visible ? 'Visible' : 'Oculto'}</div>
            </div>
          </div>
          <div className="flex gap-3 shrink-0 items-center">
            <button onClick={() => toggleProductActive(p)} className={visible ? 'text-amber-500 dark:text-yellow-300' : 'text-emerald-600 dark:text-emerald-400'} title={visible ? 'Ocultar en /pedidos' : 'Mostrar en /pedidos'}>
              {visible ? <Eye size={18}/> : <CheckSquare size={18}/>} 
            </button>
            <button onClick={() => { setSelectedPerms([]); setEditItem({ ...p, active: p.active !== false }); setIsModal(true); }} className="text-blue-500 hover:text-blue-600" title="Editar"><Edit size={18}/></button>
            <button onClick={() => del('products', p.id)} className="text-red-500 hover:text-red-650" title="Eliminar definitivamente"><Trash2 size={18}/></button>
          </div>
        </div>
      );})}
    </div>

    {isModal && !selectedPerms.length && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setIsModal(false)}>
        <form onSubmit={saveProd} className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-black mb-4 text-zinc-900 dark:text-white">{editItem.id ? 'Editar' : 'Nuevo'} producto</h3>
          <label className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Nombre</label>
          <input className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-850 p-3 rounded-xl mb-3.5 outline-none focus:border-orange-500/50 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30" placeholder="Ej: Pizza americana familiar" value={editItem.name || ''} onChange={e => setEditItem({ ...editItem, name: e.target.value })} />
          
          <label className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Precio (S/)</label>
          <input type="number" step="0.01" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-850 p-3 rounded-xl mb-3.5 outline-none focus:border-orange-500/50 text-zinc-900 dark:text-white" placeholder="Precio" value={editItem.price || ''} onChange={e => setEditItem({ ...editItem, price: e.target.value })} />
          
          <label className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Orden de visualización (sort index)</label>
          <input type="number" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-850 p-3 rounded-xl mb-3.5 outline-none focus:border-orange-500/50 text-zinc-900 dark:text-white" placeholder="Orden (opcional)" value={editItem.sort_index || ''} onChange={e => setEditItem({ ...editItem, sort_index: e.target.value })} />
          
          <label className="text-xs font-bold text-zinc-500 dark:text-gray-400 block mb-1">Tag/Categoría de destino</label>
          <input list="pedido-category-options" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-850 p-3 rounded-xl mb-3.5 outline-none focus:border-orange-500/50 text-zinc-900 dark:text-white" placeholder="Pizzas, Bebidas, Extras u otro" value={editItem.category || ''} onChange={e => setEditItem({ ...editItem, category: e.target.value })} />
          
          <label className="flex items-center gap-3 text-sm mb-3 select-none rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={editItem.active !== false} onChange={(e) => setEditItem({ ...editItem, active: e.target.checked })} />
            <span className="font-semibold">Visible en la carta de /pedidos</span>
          </label>
          <label className="flex items-center gap-3 text-sm mb-4 select-none rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={!!editItem.is_promo} onChange={(e) => setEditItem({ ...editItem, is_promo: e.target.checked })} />
            <span className="font-semibold">Destacar en la pestaña <b>Promo</b></span>
          </label>
          <button className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-black flex justify-center gap-2 items-center shadow-md transition"><Save size={18}/> Guardar Producto</button>
          <button type="button" onClick={() => setIsModal(false)} className="mt-3.5 w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white py-3 rounded-xl font-bold transition">Cancelar</button>
        </form>
      </div>
    )}
  </div>
)}
{tab === 'pedido' && (
  <AdminPedidoSettings />
)}

{tab === 'promo-hoy' && (
  <AdminPromoToday />
)}

{tab === 'config' && (
             <div className="space-y-6 max-w-6xl mx-auto pb-10">{configError && (
  <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-xl text-sm">
    <b>Config no visible:</b> {configError}
  </div>
)}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-1 space-y-6">
                   <div className="bg-white dark:bg-card p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                     <h3 className="font-extrabold text-lg mb-4 text-orange-655 dark:text-orange-500 flex items-center gap-2 border-b border-zinc-150 dark:border-white/5 pb-2"><Store/> Identidad</h3>
                     <div className="space-y-4">
                       <div>
                         <label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase">Nombre de la tienda</label>
                         <input className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg text-zinc-900 dark:text-white outline-none" value={config.nombre_tienda || ''} onChange={e => setConfig({...config, nombre_tienda: e.target.value})}/>
                       </div>
                       <div>
                         <label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase mb-2 block">Logo</label>
                         <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-750 rounded-xl p-4 relative bg-zinc-50/50 dark:bg-black/5">
                           {config.logo_url ? (
                             <div className="relative group">
                               <img src={config.logo_url} alt="Preview" className="h-32 object-contain mb-2 rounded-lg"/>
                               <button onClick={() => setConfig({...config, logo_url: ''})} className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-full shadow-md"><Trash2 size={13}/></button>
                             </div>
                           ) : (
                             <div className="text-zinc-400 dark:text-zinc-550 py-4 text-center text-xs flex flex-col items-center">
                               <ImageIcon size={36} className="mb-1.5 opacity-40"/>
                               Sin logo establecido
                             </div>
                           )}
                           <label className="cursor-pointer bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white text-xs font-bold py-2 px-4 rounded-xl mt-2.5 flex items-center gap-2 shadow-xs transition">
                             <Upload size={13}/> Subir imagen
                             <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                           </label>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
               
                 <div className="lg:col-span-2 space-y-6">
                    {/* NUEVO: NUMERACIÓN DE PEDIDOS */}
                    <div className="bg-white dark:bg-card p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="font-extrabold text-lg mb-4 text-zinc-900 dark:text-white flex items-center gap-2 border-b border-zinc-150 dark:border-white/5 pb-2"><Hash size={20}/> Numeración de Pedidos</h3>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="text-xs text-zinc-550 dark:text-gray-400 font-bold uppercase mb-1 block">Iniciar contador en:</label>
                                <input type="number" placeholder="Ej: 100" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg text-zinc-900 dark:text-white outline-none" value={newOrderId} onChange={e => setNewOrderId(e.target.value)}/>
                            </div>
                            <button onClick={handleResetSequence} className="bg-red-50 hover:bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-200 border border-red-200 dark:border-red-800 px-6 py-3 rounded-lg font-bold text-sm h-[46px] transition shadow-xs">ACTUALIZAR ID</button>
                        </div>
                        <p className="text-[10px] text-zinc-450 dark:text-gray-500 mt-2 italic">* Ten cuidado: Esto cambiará el número del próximo pedido generado.</p>
                    </div>

                    <div className="bg-white dark:bg-card p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="font-extrabold text-lg mb-4 text-purple-605 dark:text-purple-400 flex items-center gap-2 border-b border-zinc-150 dark:border-white/5 pb-2"><Instagram size={20}/> Redes Sociales y Wifi</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase" htmlFor="facebook">Facebook</label><div className="flex items-center gap-2 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white p-3 rounded-xl border border-zinc-250 dark:border-zinc-800 shadow-xs"><Facebook size={14} className="text-blue-500"/><input className="bg-transparent w-full outline-none" value={config.facebook || ''} onChange={e => setConfig({...config, facebook: e.target.value})}/></div></div>
                            <div><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase" htmlFor="instagram">Instagram</label><div className="flex items-center gap-2 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white p-3 rounded-xl border border-zinc-250 dark:border-zinc-800 shadow-xs"><Instagram size={14} className="text-purple-500"/><input className="bg-transparent w-full outline-none" value={config.instagram || ''} onChange={e => setConfig({...config, instagram: e.target.value})}/></div></div>
                            <div><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase" htmlFor="tiktok">TikTok</label><div className="flex items-center gap-2 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white p-3 rounded-xl border border-zinc-250 dark:border-zinc-800 shadow-xs"><Video size={14} className="text-pink-500"/><input className="bg-transparent w-full outline-none" value={config.tiktok || ''} onChange={e => setConfig({...config, tiktok: e.target.value})}/></div></div>
                            <div><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase">Clave Wifi</label><div className="flex items-center gap-2 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white p-3 rounded-xl border border-zinc-250 dark:border-zinc-800 shadow-xs"><Wifi size={14} className="text-blue-500"/><input className="bg-transparent w-full outline-none" value={config.wifi_pass || ''} onChange={e => setConfig({...config, wifi_pass: e.target.value})}/></div></div>
                            <div className="md:col-span-2"><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase">Sitio Web</label><div className="flex items-center gap-2 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white p-3 rounded-xl border border-zinc-250 dark:border-zinc-800 shadow-xs"><Globe size={14} className="text-green-550"/><input className="bg-transparent w-full outline-none" value={config.website || ''} onChange={e => setConfig({...config, website: e.target.value})}/></div></div>
                        </div>
                        
                        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                            <label className="text-xs text-zinc-550 dark:text-gray-400 font-bold uppercase block mb-2">Otras Redes</label>
                            <div className="space-y-2 mb-2">
                                {extraSocials.map((s, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-200 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm">
                                        <span className="font-extrabold">{s.platform}:</span>
                                        <span className="flex-1 truncate">{s.handle}</span>
                                        <button onClick={() => removeSocial(idx)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input placeholder="Plataforma (ej: Twitter)" className="bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs flex-1 outline-none" value={newSocial.platform} onChange={e => setNewSocial({...newSocial, platform: e.target.value})}/>
                                <input placeholder="Usuario/Link" className="bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs flex-1 outline-none" value={newSocial.handle} onChange={e => setNewSocial({...newSocial, handle: e.target.value})}/>
                                <button onClick={addSocial} className="bg-purple-600 hover:bg-purple-550 p-2 px-4 rounded-xl text-white shadow-xs transition"><Plus size={16}/></button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-card p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <h3 className="font-extrabold text-lg mb-4 text-yellow-605 dark:text-yellow-500 flex items-center gap-2 border-b border-zinc-150 dark:border-white/5 pb-2"><FileText/> Diseño Básico Ticket</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2"><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase">Dirección Local</label><input className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-850 p-3 rounded-lg text-zinc-900 dark:text-white outline-none" value={config.direccion_tienda || ''} onChange={e => setConfig({...config, direccion_tienda: e.target.value})}/></div>
                        <div><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase">Teléfono Local</label><input className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-850 p-3 rounded-lg text-zinc-900 dark:text-white outline-none" value={config.telefono_tienda || ''} onChange={e => setConfig({...config, telefono_tienda: e.target.value})}/></div>
                        <div>
                          <label className="text-xs text-zinc-550 dark:text-gray-400 font-bold uppercase">Ancho Papel</label>
                          <div className="flex bg-zinc-100 dark:bg-black/35 rounded-xl p-1 border border-zinc-200 dark:border-zinc-800 mt-1">
                            <button onClick={() => setConfig({...config, ancho_papel: '58'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${config.ancho_papel !== '80' ? 'bg-white dark:bg-zinc-700 text-zinc-850 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-gray-400'}`}>58mm</button>
                            <button onClick={() => setConfig({...config, ancho_papel: '80'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${config.ancho_papel === '80' ? 'bg-white dark:bg-zinc-700 text-zinc-850 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-gray-400'}`}>80mm</button>
                          </div>
                        </div>
                        <div className="md:col-span-2"><label className="text-xs text-zinc-500 dark:text-gray-450 font-bold uppercase">Pie de Página (Texto)</label><input className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-850 p-3 rounded-lg text-zinc-900 dark:text-white outline-none" value={config.footer_ticket || ''} onChange={e => setConfig({...config, footer_ticket: e.target.value})}/></div>
                        <div className="md:col-span-2 grid grid-cols-3 gap-2 mt-2">
                          <button onClick={() => setConfig({...config, show_logo: !config.show_logo})} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.show_logo ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400' : 'border-zinc-200 dark:border-zinc-750 text-zinc-400 dark:text-zinc-550'}`}>{config.show_logo ? <CheckSquare size={20}/> : <Square size={20}/>} <span className="text-xs font-bold">Logo</span></button>
                          <button onClick={() => setConfig({...config, show_client: !config.show_client})} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.show_client ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400' : 'border-zinc-200 dark:border-zinc-750 text-zinc-400 dark:text-zinc-550'}`}>{config.show_client ? <CheckSquare size={20}/> : <Square size={20}/>} <span className="text-xs font-bold">Cliente</span></button>
                          <button onClick={() => setConfig({...config, show_notes: !config.show_notes})} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.show_notes ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400' : 'border-zinc-200 dark:border-zinc-750 text-zinc-400 dark:text-zinc-550'}`}>{config.show_notes ? <CheckSquare size={20}/> : <Square size={20}/>} <span className="text-xs font-bold">Notas</span></button>
                        </div>
                      </div>
                    </div>
                 </div>
               </div>
               
               
               <div className="bg-white dark:bg-card p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 className="font-extrabold text-lg mb-4 text-green-655 dark:text-green-400 flex items-center gap-2 border-b border-zinc-150 dark:border-white/5 pb-2"><MessageCircle size={18}/> Plantillas SMS (personalizable)</h3>
                 <p className="text-xs text-zinc-500 dark:text-gray-450 mb-4">Variables disponibles: <span className="text-orange-550">{'{cliente}'}</span>, <span className="text-orange-550">{'{tienda}'}</span>, <span className="text-orange-550">{'{pedido}'}</span>, <span className="text-orange-550">{'{estado}'}</span>, <span className="text-orange-550">{'{track}'}</span>.</p>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Saludo (sms_saludo)</label>
                     <input className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none" value={config.sms_saludo || DEFAULT_SMS_SALUDO} onChange={e=>setConfig({...config, sms_saludo: e.target.value})} placeholder="Hola {cliente} 👋" />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Firma (sms_firma)</label>
                     <input className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none" value={config.sms_firma || DEFAULT_SMS_FIRMA} onChange={e=>setConfig({...config, sms_firma: e.target.value})} placeholder="Con cariño, {tienda} 🍕" />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                   <div>
                     <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Pendiente (sms_tpl_pendiente)</label>
                     <textarea rows={4} className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none font-sans text-xs" value={config.sms_tpl_pendiente || DEFAULT_SMS_TEMPLATES.sms_tpl_pendiente} onChange={e=>setConfig({...config, sms_tpl_pendiente: e.target.value})} />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Horno (sms_tpl_horno)</label>
                     <textarea rows={4} className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none font-sans text-xs" value={config.sms_tpl_horno || DEFAULT_SMS_TEMPLATES.sms_tpl_horno} onChange={e=>setConfig({...config, sms_tpl_horno: e.target.value})} />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Listo (sms_tpl_listo)</label>
                     <textarea rows={4} className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none font-sans text-xs" value={config.sms_tpl_listo || DEFAULT_SMS_TEMPLATES.sms_tpl_listo} onChange={e=>setConfig({...config, sms_tpl_listo: e.target.value})} />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">En Transporte (sms_tpl_en_transporte)</label>
                     <textarea rows={4} className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none font-sans text-xs" value={config.sms_tpl_en_transporte || DEFAULT_SMS_TEMPLATES.sms_tpl_en_transporte} onChange={e=>setConfig({...config, sms_tpl_en_transporte: e.target.value})} />
                   </div>
                   <div className="md:col-span-2">
                     <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Entregado (sms_tpl_entregado)</label>
                     <textarea rows={4} className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none font-sans text-xs" value={config.sms_tpl_entregado || DEFAULT_SMS_TEMPLATES.sms_tpl_entregado} onChange={e=>setConfig({...config, sms_tpl_entregado: e.target.value})} />
                   </div>
                 </div>

                 <div className="mt-3.5 text-xs text-zinc-450 dark:text-zinc-500">Recuerda guardar los cambios con el botón inferior <b>GUARDAR CAMBIOS</b>.</div>
               </div>

               <div className="bg-white dark:bg-card p-5 rounded-xl border border-yellow-500/20 dark:border-yellow-900/30 shadow-sm">
                 <h3 className="font-extrabold text-lg mb-4 text-yellow-605 dark:text-yellow-400 border-b border-zinc-150 dark:border-white/5 pb-2 flex items-center gap-2"><AlertTriangle/> Aviso para clientes</h3>
                 <div className="space-y-3">
                   <label className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-200 select-none">
                     <input type="checkbox" checked={!!config.customer_notice_enabled} onChange={e => setConfig({...config, customer_notice_enabled: e.target.checked})} />
                     <span>Activar aviso en la página de pedidos</span>
                   </label>
                   <textarea rows={3} className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl mt-1 outline-none" placeholder="Mensaje visible para el cliente..." value={config.customer_notice_text || ''} onChange={e=>setConfig({...config, customer_notice_text: e.target.value})} />
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                 <div className="bg-white dark:bg-card p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                   <h3 className="font-extrabold text-lg mb-4 text-blue-600 dark:text-blue-400 border-b border-zinc-150 dark:border-white/5 pb-2 flex items-center gap-2"><Bike/> Costos de Envío por Referencia</h3>
                   <div className="flex gap-4">
                     <div className="flex-1">
                       <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Zonas Cercanas (S/)</label>
                       <input type="number" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-zinc-900 dark:text-white outline-none" value={config.costo_cerca || 0} onChange={e => setConfig({...config, costo_cerca: Number(e.target.value)})}/>
                     </div>
                     <div className="flex-1">
                       <label className="text-xs font-bold text-zinc-500 dark:text-gray-450 uppercase">Zonas Lejanas (S/)</label>
                       <input type="number" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-zinc-900 dark:text-white outline-none" value={config.costo_lejos || 0} onChange={e => setConfig({...config, costo_lejos: Number(e.target.value)})}/>
                     </div>
                   </div>
                 </div>
                 <div className="bg-white dark:bg-card p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                   <h3 className="font-extrabold text-lg mb-4 text-blue-600 dark:text-blue-400 border-b border-zinc-150 dark:border-white/5 pb-2 flex items-center gap-2"><MessageCircle/> Backup Telegram</h3>
                   <div className="space-y-3 relative z-10">
                     <input type="password" placeholder="Telegram Bot Token" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3.5 rounded-xl font-mono text-xs outline-none" value={config.tg_token || ''} onChange={e => setConfig({...config, tg_token: e.target.value})}/>
                     <input placeholder="Chat ID receptor" className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3.5 rounded-xl font-mono text-xs outline-none" value={config.tg_chat_id || ''} onChange={e => setConfig({...config, tg_chat_id: e.target.value})}/>
                     <button onClick={testTelegramBackup} className="text-xs bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-600 transition flex items-center gap-2 font-bold shadow-xs"><Upload size={12}/> Probar Conexión</button>
                   </div>
                 </div>
                 <div className="bg-red-50 dark:bg-red-950/20 p-5 rounded-xl border border-red-200 dark:border-red-900/30 md:col-span-2">
                   <h3 className="font-black text-lg mb-3 text-red-700 dark:text-red-300">Zona de peligro</h3>
                   <p className="text-sm text-zinc-600 dark:text-red-200/80 mb-4 font-semibold">
                     Acciones quirúrgicas de datos: Descargar Backup Full DB, Eliminar Datos Operativos (Wipe) y Restaurar Backup Full DB.
                   </p>
                   <DangerZoneDbTools />
                 </div>
               </div>
               <div className="sticky bottom-4 z-50 flex justify-center mt-6">
                 <button onClick={saveConf} className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-black text-lg shadow-2xl flex items-center gap-3 transition-all transform hover:scale-105">
                   <Save size={24}/> GUARDAR CAMBIOS
                 </button>
               </div>
               <div className="mt-10 pt-10 border-t border-zinc-200 dark:border-zinc-800 text-center opacity-40 hover:opacity-100 transition-opacity">
                 <button onClick={nukeDb} className="text-red-500 text-xs font-bold hover:underline flex items-center justify-center gap-1 mx-auto">
                   <AlertTriangle size={12}/> RESETEAR FÁBRICA
                 </button>
               </div>
             </div>
        )}
      </div>
    </div>
  );
}