// ═══════════════════════════════════════════
// netlify/functions/disponibilidad.mjs
// Endpoint público — devuelve horario semanal + días bloqueados
// GET /api/disponibilidad
// ═══════════════════════════════════════════

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
    diasBloqueados: (bloqueados || []).map(d => d.fecha)
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*'
    }
  });
};

export const config = { path: '/api/disponibilidad' };
