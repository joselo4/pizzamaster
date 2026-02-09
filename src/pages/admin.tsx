import { useState, useEffect, useMemo } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sendBackupToTelegram } from '../lib/telegram';
import { generateTicketPDF } from '../lib/ticket'; // Importado para reimprimir
import { 
  Trash2, Edit, Save, Plus, RefreshCw, RotateCcw, GripVertical, 
  Upload, AlertTriangle, DollarSign, Image as ImageIcon,
  ShoppingBag, Bike, Store, TrendingUp, FileText, MessageCircle, CheckSquare, Square,
  Shield, User as UserIcon, Users, Calendar, Search, Eye, X, Wifi, Globe, Instagram, Facebook, Video, Printer, Hash
} from 'lucide-react';

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
  
  // RESET ID
  const [newOrderId, setNewOrderId] = useState('');

  // --- ORDEN DE PRODUCTOS (drag & drop) ---
  const [dragProdId, setDragProdId] = useState<string | null>(null);
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

  const saveProductOrder = async () => {
    if (savingProdOrder) return;
    try {
      setSavingProdOrder(true);
      const arr:any[] = Array.isArray(data) ? data : [];
      const payload = arr.map((p:any, idx:number) => ({ id: p.id, index: idx + 1 }));
      const { error } = await supabase.rpc('rpc_set_product_order', { p_items: payload });
      if (error) throw error;
      setData(arr.map((p:any, idx:number) => ({ ...p, sort_index: idx + 1 })));
      await logAction(user?.username || 'Admin', 'SET_PROD_ORDER', `Productos: ${payload.length}`);
      alert('✅ Orden guardado');
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


  const availablePermissions = [
      { id: 'access_pos', label: 'Toma de Pedidos' },
      { id: 'access_kitchen', label: 'Pantalla Cocina' },
      { id: 'access_delivery', label: 'Pantalla Reparto' },
      { id: 'access_cashier', label: 'Módulo Caja' },
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
        else if (tab === 'productos') { const { data } = await supabase.from('products').select('*').order('name'); setData(data || []); }
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
      const p = { name: editItem.name, price: Number(editItem.price), category: editItem.category || 'Pizzas', sort_index: (editItem.sort_index === '' || editItem.sort_index === undefined) ? null : Number(editItem.sort_index), active: true }; 
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
]; 
      for (const u of updates) await supabase.from('config').upsert(u); 
      logAction(user?.username || 'Admin', 'SAVE_CONFIG', 'Update');
      
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

  return (
    <div className="flex flex-col h-full bg-dark text-white p-2 pb-20">
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 border-b border-gray-800 no-scrollbar shrink-0">
        {['dash', 'gestion', 'productos', 'usuarios', 'clientes', 'logs', 'config', 'promo'].map(t => (
            <button key={t} onClick={() => { setTab(t); setSearchTerm(''); }} className={`px-4 py-2 rounded-lg font-bold capitalize whitespace-nowrap transition-all ${tab === t ? 'bg-orange-600 text-white scale-105' : 'bg-gray-800 text-gray-400'}`}>{t === 'gestion' ? 'Historial' : t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
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
        <h2 className="text-2xl font-black">Promo (Landing QR)</h2>
        <div className="text-xs text-emerald-300 font-bold">PROMO UI OK</div>
      </div>
      <div className="flex items-center gap-2">
        <a href="/promo?ref=carlos" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-gray-800 text-orange-200 font-bold">Vista previa</a>
        <button onClick={saveConf} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black">Guardar</button>
      </div>
    </div>

    <div className="bg-card border border-white/10 rounded-2xl p-4">
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-sm">
          <div className="font-bold mb-1">Promo activa</div>
          <button
            type="button"
            onClick={() => setConfig({ ...config, promo_active: (String(config.promo_active ?? 'true') !== 'false') ? 'false' : 'true' })}
            className={`w-full px-4 py-3 rounded-xl font-extrabold ${(String(config.promo_active ?? 'true') !== 'false') ? 'bg-emerald-600' : 'bg-gray-700'}`}
          >
            {(String(config.promo_active ?? 'true') !== 'false') ? 'ACTIVA' : 'INACTIVA'}
          </button>
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">Badge</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_badge || ''}
            onChange={(e) => setConfig({ ...config, promo_badge: e.target.value })}
            placeholder="Publicidad chismosa, promo real." />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">Título (línea 1)</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_headline || ''}
            onChange={(e) => setConfig({ ...config, promo_headline: e.target.value })}
            placeholder="Carlos te engaña…" />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">Título (línea 2)</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_subheadline || ''}
            onChange={(e) => setConfig({ ...config, promo_subheadline: e.target.value })}
            placeholder="pero con su dieta." />
        </label>

        <label className="text-sm md:col-span-2">
          <div className="font-bold mb-1">Texto principal</div>
          <textarea className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3 min-h-[96px]"
            value={config.promo_body || ''}
            onChange={(e) => setConfig({ ...config, promo_body: e.target.value })}
            placeholder="Pizza personal + botellita de chicha por S/10…" />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">Precio (texto)</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_price_text || ''}
            onChange={(e) => setConfig({ ...config, promo_price_text: e.target.value })}
            placeholder="S/ 10" />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">Detalle (texto)</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_detail_text || ''}
            onChange={(e) => setConfig({ ...config, promo_detail_text: e.target.value })}
            placeholder="Pizza personal + chicha…" />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">CTA (botón)</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_cta_label || ''}
            onChange={(e) => setConfig({ ...config, promo_cta_label: e.target.value })}
            placeholder="Pedir ahora" />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">Código promo</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_cta_code || ''}
            onChange={(e) => setConfig({ ...config, promo_cta_code: e.target.value })}
            placeholder="CARLOS10" />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">Teléfono</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_phone || ''}
            onChange={(e) => setConfig({ ...config, promo_phone: e.target.value })}
            placeholder="+51..." />
        </label>

        <label className="text-sm">
          <div className="font-bold mb-1">WhatsApp (número)</div>
          <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
            value={config.promo_wa_number || ''}
            onChange={(e) => setConfig({ ...config, promo_wa_number: e.target.value })}
            placeholder="51999..." />
        </label>

        <label className="text-sm md:col-span-2">
          <div className="font-bold mb-1">Mensaje WhatsApp</div>
          <textarea className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3 min-h-[80px]"
            value={config.promo_wa_message || ''}
            onChange={(e) => setConfig({ ...config, promo_wa_message: e.target.value })}
            placeholder="Hola 👋 Quiero la promo..." />
        </label>

      </div>
    </div>
  </div>
)}
        {/* Filtros Globales */}
        {(tab === 'dash' || tab === 'gestion' || tab === 'logs') && (
            <div className="flex flex-wrap gap-2 mb-4 bg-card p-3 rounded-lg items-center sticky top-0 z-10 shadow-lg border-b border-gray-800">
                <div className="flex items-center gap-2 bg-dark p-2 rounded border border-gray-700">
                    <Calendar size={16} className="text-gray-400"/>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-white text-sm outline-none w-full" />
                </div>
                {tab === 'gestion' && (
                    <select value={filterService} onChange={e => setFilterService(e.target.value)} className="bg-dark p-2 rounded border border-gray-700 text-sm flex-1">
                        <option value="Ambos">Todos</option><option value="Delivery">Delivery</option><option value="Local">Local</option>
                    </select>
                )}
                {/* NUEVO: Selector de Cantidad para Logs */}
                {tab === 'logs' && (
                    <select value={logLimit} onChange={e => setLogLimit(Number(e.target.value))} className="bg-dark p-2 rounded border border-gray-700 text-sm w-24">
                        <option value="50">50</option>
                        <option value="75">75</option>
                        <option value="100">100</option>
                        <option value="125">125</option>
                        <option value="150">150</option>
                        <option value="200">200</option>
                    </select>
                )}
                <button onClick={load} className="bg-gray-700 p-2 rounded"><RefreshCw size={18}/></button>
            </div>
        )}

        {(tab === 'usuarios' || tab === 'clientes' || tab === 'productos') && (
            <div className="mb-4 relative">
                <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                <input className="w-full bg-card p-3 pl-10 rounded-lg border border-gray-800 text-white focus:border-orange-500 outline-none" placeholder={`Buscar en ${tab}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        )}

        {tab === 'dash' && (
          <div className="space-y-4 animate-in fade-in">
             <div className="grid grid-cols-2 gap-3"><div className="bg-gradient-to-br from-green-600 to-green-900 p-4 rounded-xl shadow-lg col-span-2 flex items-center justify-between"><div><h3 className="text-green-200 font-bold">VENTA TOTAL</h3><div className="text-4xl font-black">S/ {stats.total.toFixed(2)}</div></div><DollarSign size={40} className="text-green-300 opacity-50"/></div><div className="bg-card p-4 rounded-xl border-l-4 border-blue-500"> <h3 className="text-gray-400 text-xs font-bold">PAGADO</h3> <div className="text-2xl font-bold">S/ {stats.cash.toFixed(2)}</div> </div><div className="bg-card p-4 rounded-xl border-l-4 border-orange-500"> <h3 className="text-gray-400 text-xs font-bold">POR COBRAR</h3> <div className="text-2xl font-bold text-orange-500">S/ {stats.contra.toFixed(2)}</div> </div></div>
             <div className="grid grid-cols-3 gap-3 text-center"><div className="bg-card p-3 rounded-xl"><h3 className="text-gray-400 text-xs mb-1">PEDIDOS</h3><div className="text-xl font-bold flex justify-center items-center gap-1"><ShoppingBag size={16}/> {stats.count}</div></div><div className="bg-card p-3 rounded-xl"><h3 className="text-gray-400 text-xs mb-1">DELIVERY</h3><div className="text-xl font-bold flex justify-center items-center gap-1"><Bike size={16}/> {stats.delivery}</div></div><div className="bg-card p-3 rounded-xl"><h3 className="text-gray-400 text-xs mb-1">LOCAL</h3><div className="text-xl font-bold flex justify-center items-center gap-1"><Store size={16}/> {stats.local}</div></div></div>
             <div className="bg-card rounded-xl p-4 border border-gray-800 whitespace-normal break-words max-w-full leading-snug"><h3 className="text-orange-400 font-bold mb-3 flex items-center gap-2"><TrendingUp size={18}/> TOP PRODUCTOS HOY</h3><div className="space-y-2">{topProducts.map((p, idx) => (<div key={idx} className="flex justify-between items-center border-b border-gray-800 pb-1"><span className="font-bold text-sm">#{idx+1} {p.name}</span><span className="bg-orange-900 text-orange-200 px-2 rounded-full text-xs font-bold">{p.qty} un.</span></div>))}</div></div>
          </div>
        )}

        {tab === 'gestion' && (
          <div className="pb-10">
             <div className="space-y-2">
                 {data.map((o: any) => (
                   <div key={o.id} onClick={() => setDetailOrder(o)} className="bg-card border border-gray-800 rounded-lg p-3 shadow active:bg-gray-800 transition-colors cursor-pointer flex justify-between items-center group">
                     <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${o.service_type === 'Delivery' ? 'bg-blue-600' : 'bg-orange-600'}`}>{o.service_type === 'Delivery' ? <Bike size={20}/> : <Store size={20}/>}</div>
                         <div className="flex-1 min-w-0">
                             <div className="font-bold text-sm text-white truncate">#{o.id} - {o.client_name}</div>
                             <div className="text-xs text-gray-400 flex flex-col"><span>{new Date(o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {o.payment_status} • {(o.final_payment_method || o.payment_method || '—')}</span>{o.service_type === 'Delivery' && o.client_address && (<span className="text-blue-300 truncate max-w-[200px] block mt-0.5">{o.client_address}</span>)}</div>
                         </div>
                     </div>
                     <div className="flex items-center gap-3">
                         <div className="text-right shrink-0"><div className="text-lg font-black text-green-500">S/ {Number(o.total || 0).toFixed(2)}</div>{o.delivery_cost > 0 && <div className="text-[9px] text-blue-400 font-bold">+S/{o.delivery_cost} env</div>}</div>
                         <Eye size={20} className="text-gray-600 group-hover:text-white transition-colors"/> 
                     </div>
                   </div>
                 ))}
             </div>
             
             {/* MODAL DETALLE CON BOTÓN DE TICKET */}
             {detailOrder && (<div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200"><div className="bg-card w-full max-w-sm rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                 <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center"><h3 className="font-bold text-white">Detalle Orden #{detailOrder.id}</h3><button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-white"><X size={20}/></button></div>
                 <div className="p-4 overflow-y-auto space-y-4"><div className="grid grid-cols-2 gap-2 text-sm"><div className="text-gray-400">Fecha:</div><div className="text-white text-right">{new Date(detailOrder.created_at).toLocaleString()}</div><div className="text-gray-400">Cliente:</div><div className="text-white text-right font-bold">{detailOrder.client_name}</div>
                      <div className="text-gray-400 whitespace-normal break-words max-w-full leading-snug">Pagó con:</div><div className="text-white text-right">{detailOrder.final_payment_method || detailOrder.payment_method || '—'}</div></div><div className="bg-dark/50 rounded p-2 border border-gray-700">{detailOrder.items.map((i:any, idx:number) => (<div key={(i.id || i.name || 'item') + '-' + idx} className="flex justify-between py-1 border-b border-gray-800 last:border-0 text-sm"><span className="text-white">{i.qty} x {i.name}</span><span className="text-gray-400">S/ {Number((i.price || 0) * (i.qty || 0)).toFixed(2)}</span></div>))}<div className="flex justify-between py-2 font-bold text-lg text-green-500 border-t border-gray-700 mt-1"><span>TOTAL</span><span>S/ {Number(detailOrder.total || 0).toFixed(2)}</span></div></div></div>
                 
                 {/* NUEVO BOTÓN VER TICKET */}
                 <div className="p-3 bg-gray-900 border-t border-gray-700 flex flex-col gap-2">
                     <button onClick={handlePrintTicket} className="w-full bg-yellow-600 hover:bg-yellow-500 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2"><Printer size={16}/> VER TICKET</button>
                     <div className="flex gap-2">
                        <button onClick={() => revert(detailOrder.id)} className="flex-1 bg-blue-900/50 text-blue-200 py-2 rounded font-bold text-xs flex items-center justify-center gap-1 border border-blue-800"><RotateCcw size={14}/> REABRIR</button>
                        <button onClick={() => { del('orders', detailOrder.id); setDetailOrder(null); }} className="flex-1 bg-red-900/50 text-red-200 py-2 rounded font-bold text-xs flex items-center justify-center gap-1 border border-red-800"><Trash2 size={14}/> ELIMINAR</button>
                     </div>
                 </div>
             </div></div>)}
          </div>
        )}

        {/* LOGS DETALLADOS */}
        {tab === 'logs' && (
             <div className="space-y-2 pb-10">
                {data.length === 0 ? <div className="text-center text-gray-500 py-10">Sin registros en esta fecha</div> : data.map(l => (
                    <div key={l.id} className="bg-card p-3 rounded border border-gray-800 text-xs flex gap-3 items-start">
                        <div className="mt-1 text-gray-600 font-mono text-[10px]">{new Date(l.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</div>
                        <div className="flex-1">
                            <div className="flex justify-between mb-1">
                                <span className="text-orange-500 font-bold">{l.user_name}</span>
                                <span className="text-gray-600 bg-gray-800 px-1 rounded text-[9px]">{l.action}</span>
                            </div>
                            <div className="text-gray-300 break-words font-medium">{l.details}</div>
                        </div>
                    </div>
                ))}
             </div>
        )}

        {tab === 'usuarios' && (
            <div>
                <button onClick={() => openUserModal({})} className="mb-4 bg-orange-600 px-3 py-2 rounded font-bold flex gap-2"><Plus size={18} /> Nuevo Usuario</button>
                <div className="grid gap-2">{filteredData.map((i: any) => (
                    <div key={i.id} className="bg-card p-3 rounded border border-gray-800 flex justify-between items-center"><div><div className="font-bold flex items-center gap-2"><UserIcon size={16} className="text-orange-500"/> {i.username} {i.role === 'Admin' && <span className="bg-red-900 text-red-200 text-[10px] px-2 rounded">ADMIN</span>}</div><div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-1">{(i.permissions || []).map((p:string) => (<span key={p} className="bg-gray-700 px-1 rounded">{p.replace('access_', '').toUpperCase()}</span>))}</div></div><div className="flex gap-3"><button onClick={() => openUserModal(i)} className="text-blue-400"><Edit size={18} /></button><button onClick={() => del('users', i.id)} className="text-red-500"><Trash2 size={18} /></button></div></div>
                ))}</div>
                {isModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><form onSubmit={saveUser} className="bg-card p-6 rounded-xl border border-gray-700 w-full max-w-sm max-h-[90vh] overflow-y-auto"><h3 className="text-xl font-bold mb-4">{editItem.id ? 'Editar' : 'Nuevo'} Usuario</h3><div className="space-y-4"><div><label className="text-xs text-gray-400 block mb-1">Nombre</label><input className="w-full bg-dark p-3 rounded border border-gray-600" value={editItem.username || ''} onChange={e => setEditItem({...editItem, username: e.target.value})} /></div><div><label className="text-xs text-gray-400 block mb-1">PIN</label><input className="w-full bg-dark p-3 rounded border border-gray-600" type="tel" maxLength={4} value={editItem.pin || ''} onChange={e => setEditItem({...editItem, pin: e.target.value})} /></div><div className="bg-dark/50 p-3 rounded border border-gray-700"><label className="text-xs font-bold text-orange-500 block mb-2 flex items-center gap-1"><Shield size={12}/> PERMISOS DE ACCESO</label><div className="space-y-2">{availablePermissions.map(p => (<label key={p.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/5 rounded transition-colors"><div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedPerms.includes(p.id) ? 'bg-green-600 border-green-500' : 'border-gray-500'}`}>{selectedPerms.includes(p.id) && <CheckSquare size={14} className="text-white"/>}</div><input type="checkbox" className="hidden" checked={selectedPerms.includes(p.id)} onChange={() => togglePermission(p.id)} /><span className="text-sm text-gray-300">{p.label}</span></label>))}</div></div></div><div className="flex gap-2 mt-6"><button type="button" onClick={() => setIsModal(false)} className="flex-1 bg-gray-700 p-3 rounded text-sm font-bold">Cancelar</button><button className="flex-1 bg-orange-600 p-3 rounded text-sm font-bold shadow-lg">Guardar</button></div></form></div>)}
            </div>
        )}

        {tab === 'clientes' && (
             <div>
                 <button onClick={() => openClientModal({})} className="mb-4 bg-blue-600 px-3 py-2 rounded font-bold flex gap-2 shadow-lg"><Plus size={18} /> Nuevo Cliente</button>
                 <div className="grid gap-2 whitespace-normal break-words max-w-full leading-snug">{filteredData.map((i: any) => (<div key={i.phone} className="bg-card p-3 rounded border border-gray-800 flex justify-between items-center"><div><div className="font-bold flex items-center gap-2"><Users size={16} className="text-blue-500"/> {i.name}</div><div className="text-xs text-gray-400">{i.phone} {i.address && `(${i.address})`}</div></div><div className="flex gap-3"><button onClick={() => openClientModal(i)} className="text-blue-400"><Edit size={18}/></button><button onClick={() => del('customers', i.phone)} className="text-red-500"><Trash2 size={18}/></button></div></div>))}</div>
                 {isClientModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><form onSubmit={saveClient} className="bg-card p-6 rounded-xl border border-gray-700 w-full max-w-sm"><h3 className="text-xl font-bold mb-4">{editItem.phone ? 'Editar' : 'Nuevo'} Cliente</h3><input className="w-full bg-dark p-3 rounded mb-3 border border-gray-600" placeholder="Teléfono" value={editItem.phone || ''} onChange={e => setEditItem({...editItem, phone: e.target.value})} disabled={!!editItem.phone && !!data.find(c => c.phone === editItem.phone)} /><input className="w-full bg-dark p-3 rounded mb-3 border border-gray-600" placeholder="Nombre" value={editItem.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} /><input className="w-full bg-dark p-3 rounded mb-4 border border-gray-600" placeholder="Dirección" value={editItem.address || ''} onChange={e => setEditItem({...editItem, address: e.target.value})} /><div className="flex gap-2"><button type="button" onClick={() => setIsClientModal(false)} className="flex-1 bg-gray-700 p-3 rounded">Cancelar</button><button className="flex-1 bg-blue-600 p-3 rounded font-bold">Guardar</button></div></form></div>)}
             </div>
        )}

        
{tab === 'productos' && (
  <div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { setEditItem({}); setIsModal(true); }} className="bg-green-600 px-3 py-2 rounded font-bold flex gap-2 items-center">
          <Plus size={18}/> Nuevo Producto
        </button>
        <button onClick={saveProductOrder} disabled={savingProdOrder || !Array.isArray(data) || data.length === 0}
          className="bg-orange-600 px-3 py-2 rounded font-bold flex gap-2 items-center disabled:opacity-60">
          <Save size={18}/> {savingProdOrder ? 'Guardando...' : 'Guardar orden'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input className="bg-dark px-3 py-2 rounded border border-gray-700 w-full sm:w-72" placeholder="Buscar producto..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <button onClick={() => setSearchTerm('')} className="bg-gray-800 px-3 py-2 rounded border border-gray-700" title="Limpiar">
          <X size={18}/>
        </button>
      </div>
    </div>

    <div className="text-xs text-gray-400 mb-2">
      Tip: Arrastra usando el icono <span className="inline-flex align-middle"><GripVertical size={14}/></span> y luego presiona <b>Guardar orden</b>.
    </div>

    <div className="grid gap-2">
      {(productsView as any[]).map((p: any, idx: number) => (
        <div key={p.id} draggable onDragStart={() => setDragProdId(String(p.id))} onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragProdId) reorderProducts(dragProdId, p.id); setDragProdId(null); }}
          className={`bg-card p-3 rounded border border-gray-800 flex justify-between items-center gap-3 ${dragProdId === String(p.id) ? 'ring-2 ring-orange-500/60' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-gray-400 cursor-grab active:cursor-grabbing" title="Arrastrar"><GripVertical size={18}/></div>
            <div className="min-w-0">
              <div className="font-bold whitespace-normal break-words max-w-full leading-snug">{p.name}</div>
              <div className="text-sm text-orange-500 font-bold">S/ {p.price}</div>
              <div className="text-[11px] text-gray-400">Orden: <b>{p.sort_index ?? (idx + 1)}</b> • Categoría: {p.category || '—'}</div>
            </div>
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={() => { setEditItem(p); setIsModal(true); }} className="text-blue-400"><Edit size={18}/></button>
            <button onClick={() => del('products', p.id)} className="text-red-500"><Trash2 size={18}/></button>
          </div>
        </div>
      ))}
    </div>

    {isModal && !selectedPerms.length && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <form onSubmit={saveProd} className="bg-card p-6 rounded-xl border border-gray-700 w-full max-w-sm">
          <h3 className="text-xl font-bold mb-4">{editItem.id ? 'Editar' : 'Nuevo'} Producto</h3>
          <input className="w-full bg-dark p-3 rounded mb-3 border border-gray-600" placeholder="Nombre" value={editItem.name || ''} onChange={e => setEditItem({ ...editItem, name: e.target.value })} />
          <input type="number" className="w-full bg-dark p-3 rounded mb-3 border border-gray-600" placeholder="Precio" value={editItem.price || ''} onChange={e => setEditItem({ ...editItem, price: e.target.value })} />
          <input type="number" className="w-full bg-dark p-3 rounded mb-3 border border-gray-600" placeholder="Orden (opcional)" value={editItem.sort_index || ''} onChange={e => setEditItem({ ...editItem, sort_index: e.target.value })} />
          <select className="w-full bg-dark p-3 rounded mb-4 border border-gray-600" value={editItem.category || 'Pizzas'} onChange={e => setEditItem({ ...editItem, category: e.target.value })}>
            <option value="Pizzas">Pizzas</option><option value="Bebidas">Bebidas</option><option value="Extras">Extras</option>
          </select>
          <button className="w-full bg-orange-600 py-3 rounded font-bold flex justify-center gap-2 items-center"><Save size={18}/> Guardar</button>
          <button type="button" onClick={() => setIsModal(false)} className="mt-3 w-full bg-gray-700 py-3 rounded font-bold">Cancelar</button>
        </form>
      </div>
    )}
  </div>
)}
{tab === 'config' && (
             <div className="space-y-6 max-w-6xl mx-auto pb-10">{configError && (
  <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-xl text-sm">
    <b>Config no visible:</b> {configError}
  </div>
)}


        {tab === 'promo' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-black">Promo (Landing QR)</h2>
              <div className="flex items-center gap-2">
                <a href="/promo?ref=carlos" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-gray-800 text-orange-200 font-bold">Vista previa</a>
                <button onClick={saveConf} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black">Guardar</button>
              </div>
            </div>

            <div className="bg-card border border-white/10 rounded-2xl p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm">
                  <div className="font-bold mb-1">Promo activa</div>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, promo_active: (String(config.promo_active ?? 'true') !== 'false') ? 'false' : 'true' })}
                    className={`w-full px-4 py-3 rounded-xl font-extrabold ${(String(config.promo_active ?? 'true') !== 'false') ? 'bg-emerald-600' : 'bg-gray-700'}`}
                  >
                    {(String(config.promo_active ?? 'true') !== 'false') ? 'ACTIVA' : 'INACTIVA'}
                  </button>
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">Badge</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_badge || ''}
                    onChange={(e) => setConfig({ ...config, promo_badge: e.target.value })}
                    placeholder="Publicidad chismosa, promo real." />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">Título (línea 1)</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_headline || ''}
                    onChange={(e) => setConfig({ ...config, promo_headline: e.target.value })}
                    placeholder="Carlos te engaña…" />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">Título (línea 2)</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_subheadline || ''}
                    onChange={(e) => setConfig({ ...config, promo_subheadline: e.target.value })}
                    placeholder="pero con su dieta." />
                </label>

                <label className="text-sm md:col-span-2">
                  <div className="font-bold mb-1">Texto principal</div>
                  <textarea className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3 min-h-[96px]"
                    value={config.promo_body || ''}
                    onChange={(e) => setConfig({ ...config, promo_body: e.target.value })}
                    placeholder="Pizza personal + botellita de chicha por S/10…" />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">Precio</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_price_text || ''}
                    onChange={(e) => setConfig({ ...config, promo_price_text: e.target.value })}
                    placeholder="S/ 10" />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">Detalle</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_detail_text || ''}
                    onChange={(e) => setConfig({ ...config, promo_detail_text: e.target.value })}
                    placeholder="Pizza personal + botellita de chicha (delivery gratis hoy)" />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">CTA (texto)</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_cta_label || ''}
                    onChange={(e) => setConfig({ ...config, promo_cta_label: e.target.value })}
                    placeholder="Pedir ahora" />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">Código promo (/pedido?promo=)</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_cta_code || ''}
                    onChange={(e) => setConfig({ ...config, promo_cta_code: e.target.value })}
                    placeholder="CARLOS10" />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">Teléfono</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_phone || ''}
                    onChange={(e) => setConfig({ ...config, promo_phone: e.target.value })}
                    placeholder="+51989466466" />
                </label>

                <label className="text-sm">
                  <div className="font-bold mb-1">WhatsApp</div>
                  <input className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3"
                    value={config.promo_wa_number || ''}
                    onChange={(e) => setConfig({ ...config, promo_wa_number: e.target.value })}
                    placeholder="51989466466" />
                </label>

                <label className="text-sm md:col-span-2">
                  <div className="font-bold mb-1">Mensaje WhatsApp</div>
                  <textarea className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3 min-h-[80px]"
                    value={config.promo_wa_message || ''}
                    onChange={(e) => setConfig({ ...config, promo_wa_message: e.target.value })}
                    placeholder="Hola 👋 Quiero la promo CARLOS (S/10: pizza personal + chicha)…" />
                </label>

                <label className="text-sm md:col-span-2">
                  <div className="font-bold mb-1">Promos (JSON opcional)</div>
                  <textarea className="w-full bg-dark border border-white/10 rounded-xl px-3 py-3 min-h-[120px] font-mono text-xs"
                    value={config.promo_promos || ''}
                    onChange={(e) => setConfig({ ...config, promo_promos: e.target.value })}
                    placeholder='[{"tag":"TOP","title":"Promo CARLOS","price":"S/ 10","note":"Pizza personal + chicha","promo":"CARLOS10","bullets":["Delivery gratis hoy"]}]' />
                </label>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Para que /promo lea esto sin login, ejecuta <span className="font-bold">supabase_sql/10_promo_public_read_policy.sql</span>
              </div>
            </div>
          </div>
        )}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-1 space-y-6"><div className="bg-card p-5 rounded-xl border border-gray-800 shadow-lg"><h3 className="font-bold text-lg mb-4 text-orange-500 flex items-center gap-2 border-b border-gray-800 pb-2"><Store/> Identidad</h3><div className="space-y-4"><div><label className="text-xs text-gray-400 font-bold uppercase">Nombre</label><input className="w-full bg-dark p-3 rounded-lg border border-gray-700" value={config.nombre_tienda || ''} onChange={e => setConfig({...config, nombre_tienda: e.target.value})}/></div><div><label className="text-xs text-gray-400 font-bold uppercase mb-2 block">Logo</label><div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg p-4 relative">{config.logo_url ? <div className="relative group"><img src={config.logo_url} alt="Preview" className="h-32 object-contain mb-2"/><button onClick={() => setConfig({...config, logo_url: ''})} className="absolute top-0 right-0 bg-red-600 p-1 rounded-full"><Trash2 size={14}/></button></div> : <div className="text-gray-500 py-4 text-center text-xs flex flex-col items-center"><ImageIcon size={40} className="mb-2 opacity-50"/>Sin logo</div>}<label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 px-4 rounded mt-2 flex items-center gap-2"><Upload size={14}/> Subir<input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} /></label></div></div></div></div></div>
               
               <div className="lg:col-span-2 space-y-6">
                   
                   {/* NUEVO: NUMERACIÓN DE PEDIDOS */}
                   <div className="bg-card p-5 rounded-xl border border-gray-800 shadow-lg">
                       <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2 border-b border-gray-800 pb-2"><Hash size={20}/> Numeración de Pedidos</h3>
                       <div className="flex gap-4 items-end">
                           <div className="flex-1">
                               <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Iniciar contador en:</label>
                               <input type="number" placeholder="Ej: 100" className="w-full bg-dark p-3 rounded-lg border border-gray-700" value={newOrderId} onChange={e => setNewOrderId(e.target.value)}/>
                           </div>
                           <button onClick={handleResetSequence} className="bg-red-900/50 text-red-200 border border-red-800 hover:bg-red-800 px-6 py-3 rounded-lg font-bold text-sm h-[46px] transition-colors">ACTUALIZAR ID</button>
                       </div>
                       <p className="text-[10px] text-gray-500 mt-2 italic">* Ten cuidado: Esto cambiará el número del próximo pedido generado.</p>
                   </div>

                   <div className="bg-card p-5 rounded-xl border border-gray-800 shadow-lg">
                       <h3 className="font-bold text-lg mb-4 text-purple-400 flex items-center gap-2 border-b border-gray-800 pb-2"><Instagram size={20}/> Redes Sociales y Wifi</h3>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                           <div><label className="text-xs text-gray-400 font-bold uppercase">Facebook</label><div className="flex items-center gap-2 bg-dark p-3 rounded border border-gray-700"><Facebook size={14} className="text-blue-500"/><input className="bg-transparent w-full outline-none" value={config.facebook || ''} onChange={e => setConfig({...config, facebook: e.target.value})}/></div></div>
                           <div><label className="text-xs text-gray-400 font-bold uppercase">Instagram</label><div className="flex items-center gap-2 bg-dark p-3 rounded border border-gray-700"><Instagram size={14} className="text-purple-500"/><input className="bg-transparent w-full outline-none" value={config.instagram || ''} onChange={e => setConfig({...config, instagram: e.target.value})}/></div></div>
                           <div><label className="text-xs text-gray-400 font-bold uppercase">TikTok</label><div className="flex items-center gap-2 bg-dark p-3 rounded border border-gray-700"><Video size={14} className="text-pink-500"/><input className="bg-transparent w-full outline-none" value={config.tiktok || ''} onChange={e => setConfig({...config, tiktok: e.target.value})}/></div></div>
                           <div><label className="text-xs text-gray-400 font-bold uppercase">Clave Wifi</label><div className="flex items-center gap-2 bg-dark p-3 rounded border border-gray-700"><Wifi size={14} className="text-blue-500"/><input className="bg-transparent w-full outline-none" value={config.wifi_pass || ''} onChange={e => setConfig({...config, wifi_pass: e.target.value})}/></div></div>
                           <div className="md:col-span-2"><label className="text-xs text-gray-400 font-bold uppercase">Sitio Web</label><div className="flex items-center gap-2 bg-dark p-3 rounded border border-gray-700"><Globe size={14} className="text-green-500"/><input className="bg-transparent w-full outline-none" value={config.website || ''} onChange={e => setConfig({...config, website: e.target.value})}/></div></div>
                       </div>
                       
                       <div className="border-t border-gray-800 pt-4">
                           <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Otras Redes</label>
                           <div className="space-y-2 mb-2">
                               {extraSocials.map((s, idx) => (
                                   <div key={idx} className="flex items-center gap-2 bg-dark p-2 rounded border border-gray-700 text-sm">
                                       <span className="font-bold">{s.platform}:</span>
                                       <span className="flex-1">{s.handle}</span>
                                       <button onClick={() => removeSocial(idx)} className="text-red-500 p-1"><X size={14}/></button>
                                   </div>
                               ))}
                           </div>
                           <div className="flex gap-2">
                               <input placeholder="Plataforma (ej: Twitter)" className="bg-dark p-2 rounded border border-gray-700 text-sm flex-1" value={newSocial.platform} onChange={e => setNewSocial({...newSocial, platform: e.target.value})}/>
                               <input placeholder="Usuario/Link" className="bg-dark p-2 rounded border border-gray-700 text-sm flex-1" value={newSocial.handle} onChange={e => setNewSocial({...newSocial, handle: e.target.value})}/>
                               <button onClick={addSocial} className="bg-purple-600 px-3 rounded text-white"><Plus size={16}/></button>
                           </div>
                       </div>
                   </div>

                   <div className="bg-card p-5 rounded-xl border border-gray-800 shadow-lg"><h3 className="font-bold text-lg mb-4 text-yellow-500 flex items-center gap-2 border-b border-gray-800 pb-2"><FileText/> Diseño Básico Ticket</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="text-xs text-gray-400 font-bold uppercase">Dirección Local</label><input className="w-full bg-dark p-3 rounded-lg border border-gray-700" value={config.direccion_tienda || ''} onChange={e => setConfig({...config, direccion_tienda: e.target.value})}/></div><div><label className="text-xs text-gray-400 font-bold uppercase">Teléfono Local</label><input className="w-full bg-dark p-3 rounded-lg border border-gray-700" value={config.telefono_tienda || ''} onChange={e => setConfig({...config, telefono_tienda: e.target.value})}/></div><div><label className="text-xs text-gray-400 font-bold uppercase">Ancho Papel</label><div className="flex bg-dark rounded-lg p-1 border border-gray-700 mt-1"><button onClick={() => setConfig({...config, ancho_papel: '58'})} className={`flex-1 py-2 text-xs font-bold rounded ${config.ancho_papel !== '80' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>58mm</button><button onClick={() => setConfig({...config, ancho_papel: '80'})} className={`flex-1 py-2 text-xs font-bold rounded ${config.ancho_papel === '80' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>80mm</button></div></div><div className="md:col-span-2"><label className="text-xs text-gray-400 font-bold uppercase">Pie de Página (Texto)</label><input className="w-full bg-dark p-3 rounded-lg border border-gray-700" value={config.footer_ticket || ''} onChange={e => setConfig({...config, footer_ticket: e.target.value})}/></div><div className="md:col-span-2 grid grid-cols-3 gap-2 mt-2"><button onClick={() => setConfig({...config, show_logo: !config.show_logo})} className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${config.show_logo ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-gray-700 text-gray-500'}`}>{config.show_logo ? <CheckSquare size={20}/> : <Square size={20}/>} <span className="text-xs font-bold">Logo</span></button><button onClick={() => setConfig({...config, show_client: !config.show_client})} className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${config.show_client ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-gray-700 text-gray-500'}`}>{config.show_client ? <CheckSquare size={20}/> : <Square size={20}/>} <span className="text-xs font-bold">Cliente</span></button><button onClick={() => setConfig({...config, show_notes: !config.show_notes})} className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${config.show_notes ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-gray-700 text-gray-500'}`}>{config.show_notes ? <CheckSquare size={20}/> : <Square size={20}/>} <span className="text-xs font-bold">Notas</span></button></div></div></div></div></div>
               
               
               <div className="bg-card p-5 rounded-xl border border-gray-800 shadow-lg">
                 <h3 className="font-bold text-lg mb-4 text-green-400 flex items-center gap-2"><MessageCircle size={18}/> Plantillas SMS (personalizable)</h3>
                 <p className="text-xs text-gray-400 mb-4">Variables disponibles: <span className="text-gray-200">{'{cliente}'}</span>, <span className="text-gray-200">{'{tienda}'}</span>, <span className="text-gray-200">{'{pedido}'}</span>, <span className="text-gray-200">{'{estado}'}</span>, <span className="text-gray-200">{'{track}'}</span>.</p>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">Saludo (sms_saludo)</label>
                     <input className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" value={config.sms_saludo || ''} onChange={e=>setConfig({...config, sms_saludo: e.target.value})} placeholder="Hola {cliente} 👋" />
                   </div>
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">Firma (sms_firma)</label>
                     <input className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" value={config.sms_firma || ''} onChange={e=>setConfig({...config, sms_firma: e.target.value})} placeholder="Con cariño, {tienda} 🍕" />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">Pendiente (sms_tpl_pendiente)</label>
                     <textarea rows={4} className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" value={config.sms_tpl_pendiente || ''} onChange={e=>setConfig({...config, sms_tpl_pendiente: e.target.value})} />
                   </div>
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">Horno (sms_tpl_horno)</label>
                     <textarea rows={4} className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" value={config.sms_tpl_horno || ''} onChange={e=>setConfig({...config, sms_tpl_horno: e.target.value})} />
                   </div>
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">Listo (sms_tpl_listo)</label>
                     <textarea rows={4} className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" value={config.sms_tpl_listo || ''} onChange={e=>setConfig({...config, sms_tpl_listo: e.target.value})} />
                   </div>
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">En Transporte (sms_tpl_en_transporte)</label>
                     <textarea rows={4} className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" value={config.sms_tpl_en_transporte || ''} onChange={e=>setConfig({...config, sms_tpl_en_transporte: e.target.value})} />
                   </div>
                   <div className="md:col-span-2">
                     <label className="text-xs text-gray-400 font-bold uppercase">Entregado (sms_tpl_entregado)</label>
                     <textarea rows={4} className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" value={config.sms_tpl_entregado || ''} onChange={e=>setConfig({...config, sms_tpl_entregado: e.target.value})} />
                   </div>
                 </div>

                 <div className="mt-3 text-xs text-gray-400">Guarda con el botón <span className="text-gray-200">Guardar Configuración</span>.</div>
               </div>

<div className="bg-card p-5 rounded-xl border border-yellow-900/30"><h3 className="font-bold text-lg mb-4 text-yellow-400 border-b border-gray-800 pb-2 flex items-center gap-2"><AlertTriangle/> Aviso para clientes</h3><div className="space-y-3"><label className="flex items-center gap-2 text-sm text-gray-200"><input type="checkbox" checked={!!config.customer_notice_enabled} onChange={e => setConfig({...config, customer_notice_enabled: e.target.checked})} />Activar aviso en la página de pedidos</label><textarea rows={3} className="w-full bg-dark p-3 rounded border border-gray-700 mt-1" placeholder="Mensaje visible para el cliente..." value={config.customer_notice_text || ''} onChange={e=>setConfig({...config, customer_notice_text: e.target.value})} /></div></div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6"><div className="bg-card p-5 rounded-xl border border-gray-800"><h3 className="font-bold text-lg mb-4 text-blue-400 border-b border-gray-800 pb-2"><Bike/> Costos</h3><div className="flex gap-4"><div className="flex-1"><label className="text-xs text-gray-400 font-bold uppercase">Cerca</label><input type="number" className="w-full bg-dark rounded border border-gray-700 p-3" value={config.costo_cerca || 0} onChange={e => setConfig({...config, costo_cerca: Number(e.target.value)})}/></div><div className="flex-1"><label className="text-xs text-gray-400 font-bold uppercase">Lejos</label><input type="number" className="w-full bg-dark rounded border border-gray-700 p-3" value={config.costo_lejos || 0} onChange={e => setConfig({...config, costo_lejos: Number(e.target.value)})}/></div></div></div><div className="bg-card p-5 rounded-xl border border-blue-900/30 relative overflow-hidden group"><h3 className="font-bold text-lg mb-4 text-blue-400 border-b border-gray-800 pb-2 flex items-center gap-2"><MessageCircle/> Backup Telegram</h3><div className="space-y-3 relative z-10"><input type="password" placeholder="Bot Token" className="w-full bg-dark p-2 rounded border border-gray-700 font-mono text-xs" value={config.tg_token || ''} onChange={e => setConfig({...config, tg_token: e.target.value})}/><input placeholder="Chat ID" className="w-full bg-dark p-2 rounded border border-gray-700 font-mono text-xs" value={config.tg_chat_id || ''} onChange={e => setConfig({...config, tg_chat_id: e.target.value})}/><button onClick={testTelegramBackup} className="text-xs bg-blue-600/20 hover:bg-blue-600 hover:text-white text-blue-400 px-3 py-1 rounded border border-blue-600 transition-all flex items-center gap-2"><Upload size={12}/> Probar Conexión</button></div></div></div><div className="sticky bottom-4 z-50 flex justify-center mt-6"><button onClick={saveConf} className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg shadow-2xl flex items-center gap-3 transition-all transform hover:scale-105"><Save size={24}/> GUARDAR CAMBIOS</button></div><div className="mt-10 pt-10 border-t border-gray-800 text-center opacity-40 hover:opacity-100 transition-opacity"><button onClick={nukeDb} className="text-red-500 text-xs font-bold hover:underline flex items-center justify-center gap-1 mx-auto"><AlertTriangle size={12}/> RESETEAR FÁBRICA</button></div>
             </div>
        )}
      </div>
    </div>
  );
}