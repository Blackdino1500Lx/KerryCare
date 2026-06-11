// ═══════════════════════════════════════════
// netlify/functions/admin-citas.mjs
// Retorna citas para el panel admin
// GET /api/admin-citas?rango=hoy|semana|todas
// Header: Authorization: Bearer <supabase_jwt>
// ═══════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { db: { schema: 'kerrycare' } }
);

export default async (req) => {
  // Verificar JWT de Supabase Auth
  const auth  = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim();

  if (!token) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Verificar que el token sea válido en Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: 'Sesión inválida' }, { status: 401 });
  }

  // Rango de fechas
  const url      = new URL(req.url);
  const rango    = url.searchParams.get('rango') || 'semana';
  const today    = new Date().toISOString().split('T')[0];
  let   fechaFin;

  if (rango === 'hoy') {
    fechaFin = today;
  } else if (rango === 'semana') {
    const d = new Date(); d.setDate(d.getDate() + 7);
    fechaFin = d.toISOString().split('T')[0];
  } else {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    fechaFin = d.toISOString().split('T')[0];
  }

  const { data: citas, error } = await supabase
    .from('citas')
    .select('*')
    .gte('fecha', today)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: true })
    .order('hora',  { ascending: true });

  if (error) {
    console.error('Supabase error:', error);
    return Response.json({ error: 'Error al obtener citas' }, { status: 500 });
  }

  return Response.json({ ok: true, citas: citas || [] });
};

export const config = { path: '/api/admin-citas' };
