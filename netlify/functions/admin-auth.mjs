// ═══════════════════════════════════════════
// netlify/functions/admin-auth.mjs
// Verifica credenciales del panel admin
// POST /api/admin-auth  { email, password }
// ═══════════════════════════════════════════

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  const { email, password } = await req.json();

  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret   = process.env.ADMIN_SECRET || 'kerrycare_admin_secret';

  if (!email || !password) {
    return Response.json({ error: 'Faltan campos' }, { status: 400 });
  }

  if (email.trim().toLowerCase() !== adminEmail?.toLowerCase() || password !== adminPassword) {
    // Pequeña demora para evitar fuerza bruta
    await new Promise(r => setTimeout(r, 800));
    return Response.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  }

  // Token = base64(email:secret:fecha) — válido por el día de hoy
  const today = new Date().toISOString().split('T')[0];
  const token = Buffer.from(`${email}:${adminSecret}:${today}`).toString('base64');

  return Response.json({ ok: true, token });
};

export const config = { path: '/api/admin-auth' };
