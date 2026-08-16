import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const hoy = new Date().toISOString().split('T')[0];

  const [{ data: horarios, error: e1 }, { data: bloqueados, error: e2 }] = await Promise.all([
    supabase.from('horarios').select('*').order('dia_semana'),
    supabase.from('dias_bloqueados').select('fecha').gte('fecha', hoy).order('fecha')
  ]);

  if (e1 || e2) {
    return Response.json({ horarios: [], diasBloqueados: [] });
  }

  return Response.json({
    horarios: horarios || [],
    // Normalizamos a YYYY-MM-DD por si la columna `fecha` en Supabase
    // es timestamp/timestamptz en vez de date puro (evita que los días
    // bloqueados no coincidan con el string que compara el front-end).
    diasBloqueados: (bloqueados || []).map(d => String(d.fecha).slice(0, 10))
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*'
    }
  });
};

export const config = { path: '/api/disponibilidad' };
