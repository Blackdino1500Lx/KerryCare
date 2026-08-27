// ═══════════════════════════════════════════
// netlify/functions/booking.mjs
// Recibe citas del formulario y manda WhatsApp de confirmación
// URL: /.netlify/functions/booking
// ═══════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// ── Whitelist de servicios válidos ──
const SERVICIOS_VALIDOS = new Set([
  // Pestañas
  'Lifting Coreano — ₡15.000',
  'Pestañas pelo a pelo Clásicas — ₡18.000',
  'Volumen Natural — ₡20.000',
  'Volumen Realzado — ₡22.000',
  'Mega Volumen — ₡25.000',
  // Micropigmentación
  'Microblading — ₡45.000',
  'Shading Efecto Maquillaje — ₡45.000',
  'MicroShading (Técnica Mixta) — ₡50.000',
  'Punteo de Pestañas (Delineado) — ₡30.000',
  // Cejas
  'Laminado de Cejas — ₡15.000',
  'Diseño de Cejas con Henna',
  // Depilación
  'Depilación con Hilo — ₡6.000',
  'Labio Superior y Mentón — ₡2.000',
  'Rostro Completo — ₡10.000',
  // Limpieza Facial
  'Limpieza Facial Basic — ₡10.000',
  'Limpieza Facial Deluxe — ₡16.000',
  'Limpieza Facial Premium — ₡20.000',
  // Zibá Piercings
  'Perforación Bebé y Niña — ₡22.000',
  'Perforación Adulta — ₡18.000',
]);

// ── Rate limiter en memoria (persiste entre invocaciones calientes) ──
const _rl = new Map(); // ip → [timestamp, ...]
const RL_WINDOW  = 10 * 60 * 1000; // 10 minutos
const RL_MAX     = 5;              // máx 5 citas por IP en esa ventana

function checkRateLimit(ip) {
  const now  = Date.now();
  const hits = (_rl.get(ip) || []).filter(t => now - t < RL_WINDOW);
  if (hits.length >= RL_MAX) return false;
  hits.push(now);
  _rl.set(ip, hits);
  // Limpiar IPs viejas si el mapa crece demasiado
  if (_rl.size > 500) {
    for (const [k, ts] of _rl)
      if (ts.every(t => now - t > RL_WINDOW)) _rl.delete(k);
  }
  return true;
}

const ALLOWED_ORIGINS = new Set([
  'https://kerrycarecr.com',
  'https://www.kerrycarecr.com',
  'https://kerrycare.netlify.app',
]);

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://kerrycarecr.com';

  const corsHeaders = {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405, headers: corsHeaders });
  }

  // Validar Origin
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Rate limiting por IP (Netlify inyecta la IP real en x-nf-client-connection-ip)
  const ip = req.headers.get('x-nf-client-connection-ip')
           || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
           || 'unknown';
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: 'Demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.' },
      { status: 429, headers: corsHeaders }
    );
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Env vars faltantes: SUPABASE_URL o SUPABASE_SERVICE_KEY');
      return Response.json({ error: 'Error en servidor' }, { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let body;
    try { body = await req.json(); }
    catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers: corsHeaders }); }

    const { nombre, telefono, servicio, fecha, hora, mensaje } = body;

    // Validación de campos requeridos
    if (!nombre || !telefono || !servicio || !fecha || !hora) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400, headers: corsHeaders });
    }

    // Validación de longitudes y formatos
    if (nombre.length > 100 || telefono.length > 20) {
      return Response.json({ error: 'Datos inválidos' }, { status: 400, headers: corsHeaders });
    }
    if (!SERVICIOS_VALIDOS.has(servicio)) {
      return Response.json({ error: 'Servicio no válido' }, { status: 400, headers: corsHeaders });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
      return Response.json({ error: 'Formato de fecha u hora inválido' }, { status: 400, headers: corsHeaders });
    }
    if (mensaje && mensaje.length > 500) {
      return Response.json({ error: 'Mensaje demasiado largo' }, { status: 400, headers: corsHeaders });
    }

    // Formatear teléfono con código de Costa Rica
    const telefonoLimpio = telefono.replace(/\D/g, '');
    const telefonoWA = telefonoLimpio.startsWith('506')
      ? telefonoLimpio
      : `506${telefonoLimpio}`;

    // ── Validar día bloqueado y rango de horario permitido ──
    // (el front-end ya filtra esto, pero se re-valida acá porque
    // el endpoint puede recibirse directo sin pasar por la UI)
    const dow = new Date(`${fecha}T12:00:00`).getDay();

    const [{ data: horario, error: eHor }, { data: bloqueo, error: eBlq }] = await Promise.all([
      supabase.from('horarios').select('activo, hora_inicio, hora_fin').eq('dia_semana', dow).maybeSingle(),
      supabase.from('dias_bloqueados').select('fecha').eq('fecha', fecha).maybeSingle()
    ]);

    if (eHor || eBlq) {
      console.error('Error consultando horarios/bloqueados:', eHor || eBlq);
      return Response.json({ error: 'Error en servidor' }, { status: 500, headers: corsHeaders });
    }

    if (bloqueo) {
      return Response.json(
        { error: 'Ese día no está disponible para citas.' },
        { status: 409, headers: corsHeaders }
      );
    }

    if (!horario || !horario.activo) {
      return Response.json(
        { error: 'No se atienden citas ese día de la semana.' },
        { status: 409, headers: corsHeaders }
      );
    }

    if (hora < horario.hora_inicio || hora > horario.hora_fin) {
      return Response.json(
        { error: `Ese horario está fuera del rango disponible (${horario.hora_inicio} - ${horario.hora_fin}).` },
        { status: 409, headers: corsHeaders }
      );
    }

    // Verificar si ya hay una cita en esa fecha y hora
    const { data: existente } = await supabase
      .from('citas')
      .select('id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .maybeSingle();

    if (existente) {
      return Response.json(
        { error: 'Horario no disponible. Por favor elegí otra hora.' },
        { status: 409, headers: corsHeaders }
      );
    }

    // Guardar en Supabase
    const { data, error } = await supabase
      .from('citas')
      .insert([{
        nombre,
        telefono: telefonoWA,
        servicio,
        fecha,
        hora,
        mensaje: mensaje || '',
        recordatorio_enviado: false,
        creado_en: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', JSON.stringify(error));
      return Response.json({ error: 'Error al guardar la cita' }, { status: 500, headers: corsHeaders });
    }

    // Enviar WhatsApp de confirmación inmediata (no bloquear si falla)
    enviarWhatsApp(telefonoWA, plantillaConfirmacion(nombre, servicio, fecha, hora)).catch(console.error);

    return Response.json({ ok: true, id: data.id }, { headers: corsHeaders });

  } catch (err) {
    console.error('booking handler error:', err);
    return Response.json({ error: 'Error interno' }, { status: 500, headers: corsHeaders });
  }
};

// ── WhatsApp via Meta Cloud API ──
async function enviarWhatsApp(telefono, texto) {
  try {
    await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefono,
          type: 'text',
          text: { body: texto }
        })
      }
    );
  } catch (err) {
    console.error('WhatsApp error:', err);
  }
}

function plantillaConfirmacion(nombre, servicio, fecha, hora) {
  const fechaFormato = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  return (
    `¡Hola ${nombre}! 💛\n\n` +
    `Tu cita en *Kerry Care Beauty Studio* ha sido confirmada:\n\n` +
    `📌 *Servicio:* ${servicio}\n` +
    `📅 *Fecha:* ${fechaFormato}\n` +
    `🕐 *Hora:* ${hora}\n\n` +
    `Te enviaremos un recordatorio el día anterior. ¡Nos vemos pronto! 🌸\n\n` +
    `_Kerry Care Beauty Studio — Alajuelita, San José_`
  );
}

export const config = { path: '/api/booking' };
