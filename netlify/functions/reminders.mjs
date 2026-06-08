// ═══════════════════════════════════════════
// netlify/functions/reminders.mjs
// Cron diario a las 8pm — manda recordatorios WhatsApp
// ═══════════════════════════════════════════

import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// service_role key → acceso completo, solo usar en servidor
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { db: { schema: 'kerrycare' } }
);

// Corre todos los días a las 8:00pm hora Costa Rica (UTC-6 = 02:00 UTC)
export const handler = schedule('0 2 * * *', async () => {

  // Fecha de mañana
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fechaManana = manana.toISOString().split('T')[0];

  // Buscar citas de mañana sin recordatorio enviado
  const { data: citas, error } = await supabase
    .from('citas')
    .select('*')
    .eq('fecha', fechaManana)
    .eq('recordatorio_enviado', false);

  if (error || !citas?.length) {
    console.log('Sin citas para mañana:', fechaManana);
    return { statusCode: 200 };
  }

  let enviados = 0;

  for (const cita of citas) {
    const texto = plantillaRecordatorio(cita.nombre, cita.servicio, cita.fecha, cita.hora);
    const ok = await enviarWhatsApp(cita.telefono, texto);

    if (ok) {
      await supabase
        .from('citas')
        .update({ recordatorio_enviado: true })
        .eq('id', cita.id);
      enviados++;
    }
  }

  console.log(`Recordatorios enviados: ${enviados}/${citas.length} — ${fechaManana}`);
  return { statusCode: 200 };
});

// ── WhatsApp via Meta Cloud API ──
async function enviarWhatsApp(telefono, texto) {
  try {
    const resp = await fetch(
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
    return resp.ok;
  } catch (err) {
    console.error(`Error enviando a ${telefono}:`, err);
    return false;
  }
}

function plantillaRecordatorio(nombre, servicio, fecha, hora) {
  const fechaFormato = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  return (
    `¡Hola ${nombre}! 🌸\n\n` +
    `Te recordamos que *mañana* tienes cita en Kerry Care Beauty Studio:\n\n` +
    `📌 *Servicio:* ${servicio}\n` +
    `📅 *Fecha:* ${fechaFormato}\n` +
    `🕐 *Hora:* ${hora}\n\n` +
    `Para cancelar o cambiar escríbenos:\n` +
    `📲 wa.me/50671411368\n\n` +
    `¡Te esperamos! 💛\n` +
    `_Kerry Care Beauty Studio_`
  );
}
