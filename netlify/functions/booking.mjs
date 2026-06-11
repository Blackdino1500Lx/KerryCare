// ═══════════════════════════════════════════
// netlify/functions/booking.mjs
// Recibe citas del formulario y manda WhatsApp de confirmación
// URL: /.netlify/functions/booking
// ═══════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// service_role key → acceso completo, solo usar en servidor
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { db: { schema: 'kerrycare' } }
);

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  try {
    const { nombre, telefono, servicio, fecha, hora, mensaje } = await req.json();

    if (!nombre || !telefono || !servicio || !fecha || !hora) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Formatear teléfono con código de Costa Rica
    const telefonoLimpio = telefono.replace(/\D/g, '');
    const telefonoWA = telefonoLimpio.startsWith('506')
      ? telefonoLimpio
      : `506${telefonoLimpio}`;

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
      return Response.json({ error: 'Error al guardar la cita', detail: error.message }, { status: 500 });
    }

    // Enviar WhatsApp de confirmación inmediata (no bloquear si falla)
    enviarWhatsApp(telefonoWA, plantillaConfirmacion(nombre, servicio, fecha, hora)).catch(console.error);

    return Response.json({ ok: true, id: data.id });

  } catch (err) {
    console.error('booking handler error:', err);
    return Response.json({ error: 'Error interno', detail: err.message }, { status: 500 });
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
