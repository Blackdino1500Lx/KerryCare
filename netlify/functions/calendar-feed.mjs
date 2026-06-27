// ═══════════════════════════════════════════
// netlify/functions/calendar-feed.mjs
// Feed iCal de citas — para suscribir en Google Calendar
// GET /api/calendar-feed?token=CALENDAR_SECRET
// ═══════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  // Verificar token secreto en la URL
  const url   = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  if (!process.env.CALENDAR_SECRET || token !== process.env.CALENDAR_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Traer citas de los próximos 6 meses + las del último mes (por si acaso)
  const desde = new Date();
  desde.setMonth(desde.getMonth() - 1);
  const hasta = new Date();
  hasta.setMonth(hasta.getMonth() + 6);

  const { data: citas, error } = await supabase
    .from('citas')
    .select('*')
    .gte('fecha', desde.toISOString().split('T')[0])
    .lte('fecha', hasta.toISOString().split('T')[0])
    .order('fecha', { ascending: true })
    .order('hora',  { ascending: true });

  if (error) {
    return new Response('Error', { status: 500 });
  }

  const eventos = (citas || []).map(c => {
    const [y, m, d]  = c.fecha.split('-');
    const [hh, mm]   = c.hora.split(':');
    const dtStart    = `${y}${m}${d}T${hh}${mm}00`;
    const endHour    = String(parseInt(hh) + 1).padStart(2, '0');
    const dtEnd      = `${y}${m}${d}T${endHour}${mm}00`;
    const creado     = new Date(c.creado_en).toISOString()
                         .replace(/[-:]/g,'').split('.')[0] + 'Z';
    const uid        = `kerrycare-cita-${c.id}@kerrycare.netlify.app`;

    // Sanitizar texto plano para iCal (escapar comas, punto y coma, saltos)
    const esc = s => String(s ?? '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${creado}`,
      `DTSTART;TZID=America/Costa_Rica:${dtStart}`,
      `DTEND;TZID=America/Costa_Rica:${dtEnd}`,
      `SUMMARY:${esc(c.nombre)} — ${esc(c.servicio.split('—')[0].trim())}`,
      `DESCRIPTION:Servicio: ${esc(c.servicio)}\\nTeléfono: ${esc(c.telefono)}${c.mensaje ? '\\nNota: ' + esc(c.mensaje) : ''}`,
      'LOCATION:Kerry Care Beauty Studio\\, Alajuelita\\, San José',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      `DESCRIPTION:Cita en 1 hora: ${esc(c.nombre)}`,
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  }).join('\r\n');

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kerry Care Beauty Studio//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kerry Care — Citas',
    'X-WR-TIMEZONE:America/Costa_Rica',
    'X-WR-CALDESC:Citas agendadas en Kerry Care Beauty Studio',
    eventos,
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ical, {
    status: 200,
    headers: {
      'Content-Type':  'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'Content-Disposition': 'inline; filename="kerrycare-citas.ics"',
    },
  });
};

export const config = { path: '/api/calendar-feed' };
