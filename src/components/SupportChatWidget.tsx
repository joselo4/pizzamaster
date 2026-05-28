import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { MessageCircle, X, Send, Sparkles, BadgeCheck } from 'lucide-react';

interface ChatMessage {
  sender: 'customer' | 'assistant';
  message: string;
  timestamp: Date;
}

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [assistantName, setAssistantName] = useState('Doña Pizzita - Asistente');
  const [assistantWelcome, setAssistantWelcome] = useState('¡Hola! 🍕 Soy Doña Pizzita - Asistente, tu experta pizzera virtual. ¿Qué pizza se te antoja hoy? Puedo recomendarte sabores, darte precios, detalles de delivery o métodos de pago. ¡Pregúntame lo que gustes!');

  // Generar o recuperar sessionId único de soporte
  const [sessionId] = useState(() => {
    try {
      let id = sessionStorage.getItem('pizza_support_session_id');
      if (!id) {
        id = 'sess-' + Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem('pizza_support_session_id', id);
      }
      return id;
    } catch {
      return 'sess-' + Date.now();
    }
  });

  // Cargar configuraciones del asistente
  useEffect(() => {
    supabase.from('config').select('*').in('key', ['support_assistant_name', 'support_assistant_welcome'])
      .then(({ data }) => {
        if (data) {
          const nameRow = data.find(r => r.key === 'support_assistant_name');
          const welcomeRow = data.find(r => r.key === 'support_assistant_welcome');
          if (nameRow?.text_value) setAssistantName(nameRow.text_value);
          if (welcomeRow?.text_value) setAssistantWelcome(welcomeRow.text_value);
        }
      });
  }, []);

  // Cargar saludo inicial y restaurar mensajes locales si es necesario
  useEffect(() => {
    const greeting: ChatMessage = {
      sender: 'assistant',
      message: assistantWelcome,
      timestamp: new Date()
    };

    try {
      const local = localStorage.getItem(`support_history_${sessionId}`);
      if (local) {
        const parsed = JSON.parse(local).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(parsed.length ? parsed : [greeting]);
      } else {
        setMessages([greeting]);
      }
    } catch {
      setMessages([greeting]);
    }
  }, [sessionId, assistantWelcome]);

  // Auto-scroll al fondo al recibir mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persistir chat localmente
  const persistChat = (list: ChatMessage[]) => {
    try {
      localStorage.setItem(`support_history_${sessionId}`, JSON.stringify(list));
    } catch {}
  };

  // Guardar mensaje en base de datos de Supabase o fallback a localStorage global
  const saveMessageToDatabase = async (sender: 'customer' | 'assistant', text: string) => {
    const customerPhone = localStorage.getItem('customer_phone') || null;
    const customerName = localStorage.getItem('customer_name') || null;

    try {
      const { error } = await supabase.from('support_chats').insert({
        session_id: sessionId,
        customer_name: customerName,
        customer_phone: customerPhone,
        sender,
        message: text
      });
      if (error) throw error;
    } catch (e) {
      // Fallback silencioso a log de auditoría simulado en localStorage para el panel administrador
      try {
        const globalLogs = JSON.parse(localStorage.getItem('local_support_chats_log') || '[]');
        globalLogs.push({
          id: 'local-' + Math.random().toString(36).substring(2, 9),
          session_id: sessionId,
          customer_name: customerName || 'Cliente Anónimo',
          customer_phone: customerPhone || 'Sin celular',
          sender,
          message: text,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('local_support_chats_log', JSON.stringify(globalLogs));
      } catch {}
    }
  };

  // Procesar respuesta del Asistente
  const getAssistantResponse = (userText: string, chatHistory: ChatMessage[]): string => {
    const query = userText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .trim();

    // Obtener el mensaje anterior del asistente para mantener flujo conversacional inteligente
    const prevMsg = chatHistory.length >= 2 ? chatHistory[chatHistory.length - 2] : null;
    const prevText = prevMsg && prevMsg.sender === 'assistant' ? prevMsg.message.toLowerCase() : '';

    // A. CONTEXTO 1: Si el usuario pregunta "cuál de ellos/ellas/las dos" y antes hablamos de Pepperoni/Suprema/Hawaiana
    if (
      (query.includes('cual') ||
        query.includes('de ellos') ||
        query.includes('de ellas') ||
        query.includes('de las dos') ||
        query.includes('de los dos') ||
        query.includes('prefieres') ||
        query.includes('mejor') ||
        query.includes('sugieres') ||
        query.includes('recomiendas') ||
        query.includes('elegir')) &&
      (prevText.includes('pepperoni') || prevText.includes('suprema') || prevText.includes('hawaiana'))
    ) {
      return '¡Yo te sugeriría empezar por la **Pizza Pepperoni Premium**! 🍕 Es la favorita indiscutible de nuestros clientes: ese toque crujiente del pepperoni combinado con abundante queso mozzarella caliente nunca falla. \n\nPero si tienes antojo de algo con más variedad de ingredientes y texturas, la **Pizza Suprema** (con carne molida, champiñones, pimiento y cebolla) es una verdadera joya. \n\n¿Te animas a probar la de Pepperoni hoy o prefieres la Suprema?';
    }

    // B. CONTEXTO 2: Si el usuario pregunta "cuál" o "con cuál" y antes hablamos de Yape/Plin/Efectivo
    if (
      (query.includes('cual') ||
        query.includes('con cual') ||
        query.includes('como pagar') ||
        query.includes('yape') ||
        query.includes('plin') ||
        query.includes('efectivo') ||
        query.includes('recomiendas') ||
        query.includes('metodo') ||
        query.includes('pago')) &&
      (prevText.includes('yape') || prevText.includes('plin') || prevText.includes('efectivo'))
    ) {
      return '¡Yape es la opción más rápida y preferida por todos! ⚡ No necesitas manejar efectivo físico y haces la transferencia en un toque directamente al repartidor cuando recibes tu pizza calientita. ¡Cero riesgos y súper cómodo! ¿Te gustaría pagar con Yape o prefieres efectivo?';
    }

    // C. CONTEXTO 3: Si el usuario pregunta "cuál" o "cuánto" y antes hablamos de delivery (cerca / lejos)
    if (
      (query.includes('cual') ||
        query.includes('cuanto') ||
        query.includes('costo') ||
        query.includes('tarifa') ||
        query.includes('precio') ||
        query.includes('seria')) &&
      (prevText.includes('cerca') || prevText.includes('lejos') || prevText.includes('delivery'))
    ) {
      return '¡Depende de tu ubicación! 📍 Si estás cerca de nuestra pizzería, el envío es de solo S/ 2.00, y si es más retirado, es S/ 4.00. \n\nPara saber exactamente cuál te corresponde, solo ingresa tu dirección en el Paso 2 de tu pedido arriba y el sistema lo cotizará al instante en tiempo real. ¿Te parece bien?';
    }

    // 1. MATCH PARA PRODUCTOS ESTRELLA / RECOMENDACIONES
    if (
      query.includes('estrella') ||
      query.includes('mas vendido') ||
      query.includes('mas vendida') ||
      query.includes('favorito') ||
      query.includes('favorita') ||
      query.includes('popular') ||
      query.includes('recomiendas') ||
      query.includes('recomienda') ||
      query.includes('recomendacion') ||
      query.includes('recomendaciones') ||
      query.includes('que pedir') ||
      query.includes('cual es el') ||
      query.includes('cuales son') ||
      query.includes('cual sabor') ||
      query.includes('que sabor')
    ) {
      return '¡Sin duda nuestro gran campeón es la **Pizza Pepperoni Premium**! 🍕 Está cargada de queso mozzarella abundante y pepperoni americano crujiente. \n\nEl segundo favorito absoluto es la **Pizza Suprema** (con carne molida, champiñones, pimientos y cebolla fresca). ¡Ambas son un éxito total! ¿Te gustaría probar una de ellas o prefieres algo clásico como jamón y queso?';
    }

    // 2. MATCH PARA OPCIONES VEGETARIANAS / CARNES / SABORES ESPECÍFICOS
    if (
      query.includes('vegetariana') ||
      query.includes('vegetales') ||
      query.includes('vegetal') ||
      query.includes('sin carne') ||
      query.includes('carne') ||
      query.includes('queso')
    ) {
      return '¡Nos adaptamos a tu gusto! 🥦 Para opciones con vegetales, la **Pizza Suprema** es ideal pidiéndola sin carne (lleva champiñones, pimientos y cebolla). \n\nSi te encanta la carne, la **Pizza Suprema** con carne o la **Pepperoni Premium** te fascinarán. Y si buscas la clásica de solo queso mozzarella derretido, la **Pizza Americana** es tu mejor elección. ¡Tú decides!';
    }

    // 3. MATCH PARA HAWAIANA
    if (query.includes('hawaiana') || query.includes('pina')) {
      return '¡La Pizza Hawaiana es una delicia tropical! 🍍 Lleva jamón inglés seleccionado de primera y piña dulce caramelizada con abundante mozzarella. Tiene ese contraste agridulce perfecto que a tantos les encanta. ¿Te animas a pedirla?';
    }

    // 4. MATCH PARA PRECIO / OFERTAS / PROMOCIONES
    if (
      query.includes('precio') ||
      query.includes('costo') ||
      query.includes('cuanto cuesta') ||
      query.includes('cuanto esta') ||
      query.includes('gastar') ||
      query.includes('barato') ||
      query.includes('promo') ||
      query.includes('promocion') ||
      query.includes('promociones') ||
      query.includes('oferta') ||
      query.includes('gaseosa') ||
      query.includes('chicha')
    ) {
      return '¡Tenemos los precios más competitivos del sector! 🏷️ Te recomiendo mirar nuestra sección de **🔥 Promo** arriba. \n\nPor ejemplo, nuestra promoción personal de Pizza + Chicha/Gaseosa heladita está a solo S/ 10.00. Y nuestras pizzas familiares premium empiezan en tan solo S/ 25.00. ¡Calidad y sabor al mejor precio!';
    }

    // 5. MATCH PARA DELIVERY / ENVÍO
    if (
      query.includes('delivery') ||
      query.includes('envio') ||
      query.includes('reparto') ||
      query.includes('llegar') ||
      query.includes('direccion') ||
      query.includes('casa')
    ) {
      return '¡Llegamos directo a tu mesa! 🛵 Nuestro tiempo promedio de entrega es de **25 a 35 minutos**. \n\nEl costo de envío es súper económico:\n• 📍 **Cerca**: S/ 2.00\n• 📍 **Lejos**: S/ 4.00\n• 📍 **S/ 0**: ¡Gratis si usas un código de cupón promocional! Puedes rellenar tus datos en el Paso 2 de esta pantalla para cotizarlo al instante.';
    }

    // 6. MATCH PARA YAPE / PLIN / EFECTIVO / PAGO
    if (
      query.includes('yape') ||
      query.includes('plin') ||
      query.includes('efectivo') ||
      query.includes('pagar') ||
      query.includes('pago') ||
      query.includes('tarjeta')
    ) {
      return '¡Pago fácil y seguro! Aceptamos **Yape, Plin y Efectivo** ⚡. \n\nLo mejor de todo es que el pago es **Contra Entrega**, es decir, le pagas o yapeas directamente al repartidor cuando recibas tu pizza calientita en tu puerta. ¡Cero riesgos!';
    }

    // 7. MATCH PARA SALUDOS
    if (
      query.includes('hola') ||
      query.includes('buen') ||
      query.includes('tardes') ||
      query.includes('noches') ||
      query.includes('saludo') ||
      query.includes('ola')
    ) {
      return `¡Hola! Qué gusto saludarte 🍕. Soy ${assistantName}, tu asistente virtual de sabores. ¿Qué pizza se te antoja hoy? Puedo recomendarte sabores populares, darte costos de delivery o explicarte cómo pagar con Yape. ¡Pregúntame lo que gustes!`;
    }

    // 8. MATCH PARA AGRADECIMIENTOS
    if (
      query.includes('gracias') ||
      query.includes('ok') ||
      query.includes('vale') ||
      query.includes('entendido') ||
      query.includes('excelente') ||
      query.includes('buenisimo')
    ) {
      return '¡De nada! Es un gran placer ayudarte. Recuerda que puedes armar tu carrito agregando las pizzas en esta pantalla y confirmar con un toque. ¡Te va a encantar! 🍕✨';
    }

    // FALLBACK
    return `¡Qué interesante pregunta! Como especialista pizzera, te cuento que preparamos todas nuestras masas diariamente de forma artesanal y usamos ingredientes 100% frescos. \n\n¿Te gustaría que te cuente más sobre nuestros sabores estrella (como la Suprema o Pepperoni), el costo de delivery a tu casa o sobre cómo pagar con Yape?`;
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'customer',
      message: text.trim(),
      timestamp: new Date()
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    persistChat(nextMessages);
    setInput('');
    setIsTyping(true);

    // Guardar mensaje del cliente en base de datos
    await saveMessageToDatabase('customer', text.trim());

    // Simular tiempo de respuesta (800ms)
    setTimeout(async () => {
      const reply = getAssistantResponse(text, nextMessages);
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        message: reply,
        timestamp: new Date()
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      persistChat(finalMessages);
      setIsTyping(false);

      // Guardar respuesta del asistente en base de datos
      await saveMessageToDatabase('assistant', reply);
    }, 800);
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-16 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 via-orange-600 to-amber-500 text-white shadow-2xl transition hover:scale-105 active:scale-95 animate-float animate-pulse-glow"
        title={`Pregunta a ${assistantName}`}
      >
        <MessageCircle size={26} />
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
        </span>
      </button>

      {/* Ventana de chat */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs p-4 sm:items-center sm:justify-end sm:p-6" onClick={() => setIsOpen(false)}>
          <div
            className="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 text-zinc-900 dark:text-white shadow-2xl backdrop-blur-md transition-all sm:h-[600px] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-white/5 bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="text-xs font-black text-orange-600 dark:text-orange-355 flex items-center gap-1">
                    {assistantName}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Activo ahora
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 p-1.5 text-zinc-550 dark:text-white/60 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50 dark:bg-transparent no-scrollbar">
              {messages.map((m, idx) => {
                const isAssistant = m.sender === 'assistant';
                return (
                  <div
                    key={idx}
                    className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed ${
                        isAssistant
                          ? 'rounded-tl-none bg-white dark:bg-white/5 border border-zinc-150 dark:border-white/5 text-zinc-800 dark:text-zinc-100'
                          : 'rounded-tr-none bg-gradient-to-r from-orange-500 to-amber-500 text-white dark:text-slate-955 font-semibold'
                      }`}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-none bg-white dark:bg-white/5 border border-zinc-150 dark:border-white/5 px-4 py-3 text-xs text-zinc-400 dark:text-white/40 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chips de sugerencias rápidas */}
            <div className="px-4 py-2 border-t border-zinc-150 dark:border-white/5 bg-zinc-50/30 dark:bg-black/10 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
              {[
                { label: '🍕 Sabores', query: '¿Cuáles son los sabores?' },
                { label: '🛵 Delivery', query: '¿Cuánto cuesta el delivery?' },
                { label: '⚡ Yape / Pago', query: '¿Puedo pagar con Yape?' }
              ].map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(c.query)}
                  className="shrink-0 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-[10px] font-black text-zinc-650 dark:text-white/70 hover:border-orange-500/50 hover:text-orange-600 transition"
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Caja de entrada */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="border-t border-zinc-150 dark:border-white/5 bg-white dark:bg-slate-955 p-3 flex gap-2 shrink-0"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta sobre las pizzas..."
                className="flex-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:border-orange-500/50"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white dark:text-slate-955 shadow hover:from-orange-400 hover:to-amber-400 disabled:opacity-40 transition"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
